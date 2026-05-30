"use strict";

const crypto = require("crypto");
const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (session.role !== "admin" || !session.userId) {
    return { ok: false, message: "Only administrators can manage accounts." };
  }

  const payload = normalizePayload(event);
  if (!payload.userId && (!payload.username || !payload.displayName || !payload.roleCode || !payload.password)) {
    return { ok: false, message: "Username, display name, role, and password are required for new accounts." };
  }

  const [roles, users, students, teachers, majors, departments, adminClasses, offerings, enrollments] = await Promise.all([
    readCollection("roles"),
    readCollection("users"),
    readCollection("students"),
    readCollection("teachers"),
    readCollection("majors"),
    readCollection("departments"),
    readCollection("admin_classes"),
    readCollection("course_offerings"),
    readCollection("enrollments"),
  ]);

  const roleMap = mapRolesByCode(roles);
  const existing = payload.userId ? users.find((item) => item._id === payload.userId) || null : null;
  const currentRoleCodes = existing ? resolveRoleCodes(existing.role_ids || [], roles) : [];
  const currentPrimaryRole = resolvePrimaryRole(currentRoleCodes);
  const effectiveRoleCode = existing ? currentPrimaryRole || payload.roleCode : payload.roleCode;
  const roleIds = existing ? (Array.isArray(existing.role_ids) ? existing.role_ids.slice() : []) : resolveRoleIds(buildRoleCodeList(payload.roleCode), roleMap);

  if (existing && payload.username && users.some((item) => item.username === payload.username && item._id !== existing._id)) {
    return { ok: false, message: "Username already exists." };
  }
  if (!existing && users.some((item) => item.username === payload.username)) {
    return { ok: false, message: "Username already exists." };
  }

  if (!existing && !roleIds.length) {
    return { ok: false, message: "The selected role is not available." };
  }

  const now = Date.now();
  const before = existing ? clone(existing) : null;
  const userDoc = existing ? clone(existing) : {};

  userDoc.username = payload.username || userDoc.username || `user_${now}`;
  userDoc.display_name = payload.displayName || userDoc.display_name || userDoc.username;
  userDoc.email = payload.email || userDoc.email || "";
  userDoc.phone = payload.phone || userDoc.phone || "";
  userDoc.avatar_url = userDoc.avatar_url || "";
  userDoc.status = normalizeUserStatus(payload.status || userDoc.status || "active");
  userDoc.role_ids = roleIds;
  userDoc.updated_at = now;

  if (!existing) {
    userDoc.created_at = now;
  }

  if (payload.password) {
    userDoc.password_hash = hashPassword(payload.password);
    userDoc.password_updated_at = now;
    userDoc.must_change_password = Boolean(payload.forceChangePassword);
  } else {
    userDoc.must_change_password = Boolean(existing && existing.must_change_password);
  }

  let savedUserId = existing ? existing._id : "";
  if (existing) {
    await db.collection("users").doc(existing._id).update(pickUserUpdate(userDoc));
  } else {
    const addResult = await db.collection("users").add(pickUserCreate(userDoc));
    savedUserId = addResult.id;
    userDoc._id = savedUserId;
  }

  let studentDoc = null;
  let teacherDoc = null;

  if (effectiveRoleCode === "student") {
    studentDoc = buildStudentDoc({
      userId: savedUserId,
      displayName: userDoc.display_name,
      email: userDoc.email,
      phone: userDoc.phone,
      payload: payload.studentProfile || {},
      existing: students.find((item) => item.user_id === savedUserId) || null,
      majors,
      adminClasses,
      now,
    });
    if (!studentDoc) {
      return { ok: false, message: "Student profile information is incomplete." };
    }
  }

  if (effectiveRoleCode === "teacher") {
    teacherDoc = buildTeacherDoc({
      userId: savedUserId,
      displayName: userDoc.display_name,
      payload: payload.teacherProfile || {},
      existing: teachers.find((item) => item.user_id === savedUserId) || null,
      departments,
      now,
    });
    if (!teacherDoc) {
      return { ok: false, message: "Teacher profile information is incomplete." };
    }
  }

  if (studentDoc) {
    let savedStudentId = studentDoc._id;
    if (studentDoc._exists) {
      const studentId = studentDoc._id;
      delete studentDoc._exists;
      delete studentDoc._id;
      await db.collection("students").doc(studentId).update(studentDoc);
      savedStudentId = studentId;
      studentDoc._id = studentId;
      studentDoc._exists = true;
    } else {
      const addStudent = clone(studentDoc);
      delete addStudent._exists;
      delete addStudent._id;
      const addResult = await db.collection("students").add(addStudent);
      savedStudentId = addResult.id;
      studentDoc._id = savedStudentId;
    }
    await enrollStudentInCohortOfferings({ student: { ...studentDoc, _id: savedStudentId }, offerings, enrollments, now });
  }

  if (teacherDoc) {
    if (teacherDoc._exists) {
      const teacherId = teacherDoc._id;
      delete teacherDoc._exists;
      delete teacherDoc._id;
      await db.collection("teachers").doc(teacherId).update(teacherDoc);
      teacherDoc._id = teacherId;
      teacherDoc._exists = true;
    } else {
      const addTeacher = clone(teacherDoc);
      delete addTeacher._exists;
      delete addTeacher._id;
      await db.collection("teachers").add(addTeacher);
    }
  }

  const account = buildAccountView({
    user: userDoc,
    student: studentDoc,
    teacher: teacherDoc,
    roles,
    majors,
    departments,
    adminClasses,
  });

  await writeAudit(existing ? "admin.user.update" : "admin.user.create", session, savedUserId, before, account);

  return {
    ok: true,
    data: {
      account,
    },
  };
};

async function readCollection(name, limit = 1000) {
  try {
    const result = await db.collection(name).limit(limit).get();
    return result.data || [];
  } catch (error) {
    console.warn(`[save-admin-account] failed to read ${name}.`, error);
    return [];
  }
}

async function enrollStudentInCohortOfferings({ student, offerings, enrollments, now }) {
  if (!student || !student._id) return;
  const matchedOfferings = (offerings || []).filter((offering) => studentMatchesOffering(student, offering));
  for (const offering of matchedOfferings) {
    const exists = (enrollments || []).some((item) =>
      item.student_id === student._id &&
      item.course_offering_id === offering._id &&
      item.status !== "dropped",
    );
    if (exists) continue;
    await db.collection("enrollments").add({
      student_id: student._id,
      course_offering_id: offering._id,
      status: "selected",
      selected_at: now,
      created_at: now,
      updated_at: now,
    });
  }
}

function studentMatchesOffering(student, offering) {
  if (!student || !offering) return false;
  const sameYear = student.enrollment_year && Number(offering.grade_year || 0) === Number(student.enrollment_year);
  const sameMajor = offering.major_id && student.major_id === offering.major_id;
  if (offering.major_id) {
    return Boolean(sameYear && sameMajor);
  }
  return Boolean(
    (student.training_plan_id && offering.training_plan_id === student.training_plan_id) ||
    sameYear,
  );
}

function normalizePayload(event) {
  return {
    userId: String(event.userId || event.accountId || "").trim(),
    username: String(event.username || "").trim(),
    displayName: String(event.displayName || event.display_name || "").trim(),
    email: String(event.email || "").trim(),
    phone: String(event.phone || "").trim(),
    status: String(event.status || "active").trim(),
    roleCode: String(event.roleCode || event.role || "").trim(),
    password: String(event.password || event.newPassword || "").trim(),
    forceChangePassword: event.forceChangePassword === true || event.mustChangePassword === true,
    studentProfile: event.studentProfile || {},
    teacherProfile: event.teacherProfile || {},
  };
}

function buildStudentDoc(input) {
  const existing = input.existing;
  const payload = input.payload || {};
  const majorId = String(payload.majorId || payload.major_id || existing && existing.major_id || "").trim();
  const adminClassId = String(payload.adminClassId || payload.admin_class_id || existing && existing.admin_class_id || "").trim();
  const major = majorId ? lookupLabel(input.majors, majorId) : String(payload.majorName || payload.major || existing && existing.major_name || existing && existing.major || "").trim();
  const adminClass = adminClassId ? lookupLabel(input.adminClasses, adminClassId) : String(payload.adminClassName || payload.adminClass || existing && existing.admin_class_name || existing && existing.admin_class || "").trim();
  const enrollmentYear = Number(payload.enrollmentYear || payload.enrollment_year || existing && existing.enrollment_year || 0);
  const studentNo = String(payload.studentNo || payload.student_no || existing && existing.student_no || "").trim();

  if (!studentNo || !majorId || !Number.isFinite(enrollmentYear) || !enrollmentYear) {
    return null;
  }

  return {
    _exists: Boolean(existing),
    _id: existing ? existing._id : `stu_${input.userId}`,
    user_id: input.userId,
    student_no: studentNo,
    name: input.displayName,
    major_id: majorId,
    major_name: major,
    admin_class_id: adminClassId,
    admin_class_name: adminClass,
    enrollment_year: enrollmentYear,
    training_plan_id: String(payload.trainingPlanId || payload.training_plan_id || existing && existing.training_plan_id || "").trim(),
    photo_url: String(payload.photoUrl || payload.photo_url || existing && existing.photo_url || "").trim(),
    contact: {
      ...(existing && existing.contact ? existing.contact : {}),
      email: input.email || existing && existing.contact && existing.contact.email || "",
      phone: input.phone || existing && existing.contact && existing.contact.phone || "",
    },
    family_info: existing && existing.family_info ? existing.family_info : {},
    status: normalizeStudentStatus(String(payload.status || existing && existing.status || "active").trim()),
    created_at: existing && existing.created_at ? existing.created_at : input.now,
    updated_at: input.now,
  };
}

function buildTeacherDoc(input) {
  const existing = input.existing;
  const payload = input.payload || {};
  const departmentId = String(payload.departmentId || payload.department_id || existing && existing.department_id || "").trim();
  const department = departmentId ? lookupLabel(input.departments, departmentId) : String(payload.departmentName || payload.department || existing && existing.department_name || existing && existing.department || "").trim();
  const teacherNo = String(payload.teacherNo || payload.teacher_no || existing && existing.teacher_no || "").trim();

  if (!teacherNo || !departmentId) {
    return null;
  }

  return {
    _exists: Boolean(existing),
    _id: existing ? existing._id : `tea_${input.userId}`,
    user_id: input.userId,
    teacher_no: teacherNo,
    name: input.displayName,
    department_id: departmentId,
    department_name: department,
    title: String(payload.title || existing && existing.title || "").trim(),
    research_fields: normalizeStringArray(payload.researchFields || payload.research_fields || existing && existing.research_fields || []),
    teaching_experience: String(payload.teachingExperience || payload.teaching_experience || existing && existing.teaching_experience || "").trim(),
    office: String(payload.office || existing && existing.office || "").trim(),
    public_profile: {
      ...(existing && existing.public_profile ? existing.public_profile : {}),
      officeHours: String(payload.officeHours || payload.office_hours || existing && existing.public_profile && existing.public_profile.officeHours || "").trim(),
      homepage: String(payload.homepage || existing && existing.public_profile && existing.public_profile.homepage || "").trim(),
    },
    status: normalizeTeacherStatus(String(payload.status || existing && existing.status || "active").trim()),
    created_at: existing && existing.created_at ? existing.created_at : input.now,
    updated_at: input.now,
  };
}

function buildAccountView(input) {
  const user = input.user;
  const roleCodes = resolveRoleCodes(user.role_ids || [], input.roles);
  const primaryRole = resolvePrimaryRole(roleCodes);
  const student = input.student && !input.student._exists ? input.student : input.student || null;
  const teacher = input.teacher && !input.teacher._exists ? input.teacher : input.teacher || null;

  return {
    _id: user._id,
    username: user.username || "",
    displayName: user.display_name || user.displayName || user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    avatarUrl: user.avatar_url || "",
    status: user.status || "active",
    primaryRole,
    roleCodes,
    roleIds: Array.isArray(user.role_ids) ? user.role_ids.slice() : [],
    mustChangePassword: Boolean(user.must_change_password),
    passwordUpdatedAt: Number(user.password_updated_at || 0),
    lastLoginAt: Number(user.last_login_at || 0),
    createdAt: Number(user.created_at || 0),
    updatedAt: Number(user.updated_at || 0),
    linkedProfileType: student ? "student" : teacher ? "teacher" : "",
    studentProfile: student ? buildStudentProfile(student, input.majors, input.adminClasses) : null,
    teacherProfile: teacher ? buildTeacherProfile(teacher, input.departments) : null,
  };
}

function buildStudentProfile(student, majors, adminClasses) {
  const major = student.major_id ? findById(majors, student.major_id) : null;
  const adminClass = student.admin_class_id ? findById(adminClasses, student.admin_class_id) : null;
  return {
    _id: student._id,
    userId: student.user_id || "",
    studentNo: student.student_no || "",
    name: student.name || "",
    majorId: student.major_id || "",
    majorName: major ? major.name || major.code || major._id : student.major_name || "",
    adminClassId: student.admin_class_id || "",
    adminClassName: adminClass ? adminClass.name || adminClass.code || adminClass._id : student.admin_class_name || "",
    enrollmentYear: Number(student.enrollment_year || 0),
    trainingPlanId: student.training_plan_id || "",
    status: student.status || "active",
    contact: clone(student.contact || {}),
    familyInfo: clone(student.family_info || {}),
  };
}

function buildTeacherProfile(teacher, departments) {
  const department = teacher.department_id ? findById(departments, teacher.department_id) : null;
  return {
    _id: teacher._id,
    userId: teacher.user_id || "",
    teacherNo: teacher.teacher_no || "",
    name: teacher.name || "",
    departmentId: teacher.department_id || "",
    departmentName: department ? department.name || department.code || department._id : teacher.department_name || "",
    title: teacher.title || "",
    researchFields: Array.isArray(teacher.research_fields) ? teacher.research_fields.slice() : [],
    teachingExperience: teacher.teaching_experience || "",
    office: teacher.office || "",
    status: teacher.status || "active",
  };
}

function resolveRoleCodes(roleIds, roles) {
  const roleMap = mapRolesByCode(roles);
  return (roleIds || [])
    .map((roleId) => roleMap.get(roleId))
    .filter(Boolean)
    .map((role) => role.code)
    .filter(Boolean);
}

function resolvePrimaryRole(roleCodes) {
  const priority = ["admin", "academic_staff", "teacher", "counselor", "student", "guardian"];
  const code = priority.find((item) => roleCodes.includes(item));
  if (code === "academic_staff") {
    return "admin";
  }
  if (code === "counselor") {
    return "teacher";
  }
  return code || "";
}

function buildRoleCodeList(roleCode) {
  if (roleCode === "admin") {
    return ["admin", "academic_staff"];
  }
  if (roleCode === "teacher") {
    return ["teacher"];
  }
  if (roleCode === "student") {
    return ["student"];
  }
  return [roleCode];
}

function resolveRoleIds(roleCodes, roleMap) {
  return (roleCodes || [])
    .map((roleCode) => roleMap.get(roleCode))
    .filter(Boolean)
    .map((role) => role._id);
}

function mapRolesByCode(roles) {
  const result = new Map();
  for (const role of roles || []) {
    if (role && role.code) {
      result.set(role.code, role);
    }
  }
  return result;
}

function normalizeUserStatus(status) {
  const allowed = ["active", "disabled", "pending"];
  return allowed.includes(status) ? status : "active";
}

function normalizeStudentStatus(status) {
  const allowed = ["active", "suspended", "graduated", "withdrawn"];
  return allowed.includes(status) ? status : "active";
}

function normalizeTeacherStatus(status) {
  const allowed = ["active", "inactive"];
  return allowed.includes(status) ? status : "active";
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[;,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function lookupLabel(items, id) {
  const item = findById(items, id);
  return item ? item.name || item.code || item._id : "";
}

function findById(items, id) {
  for (const item of items || []) {
    if (item && item._id === id) {
      return item;
    }
  }
  return null;
}

function pickUserCreate(user) {
  return {
    username: user.username,
    password_hash: user.password_hash,
    role_ids: user.role_ids,
    display_name: user.display_name,
    email: user.email,
    phone: user.phone,
    avatar_url: user.avatar_url || "",
    status: user.status,
    created_at: user.created_at,
    updated_at: user.updated_at,
    password_updated_at: user.password_updated_at || 0,
    must_change_password: Boolean(user.must_change_password),
    last_login_at: user.last_login_at || 0,
  };
}

function pickUserUpdate(user) {
  return {
    username: user.username,
    password_hash: user.password_hash,
    role_ids: user.role_ids,
    display_name: user.display_name,
    email: user.email,
    phone: user.phone,
    avatar_url: user.avatar_url || "",
    status: user.status,
    updated_at: user.updated_at,
    password_updated_at: user.password_updated_at || 0,
    must_change_password: Boolean(user.must_change_password),
    last_login_at: user.last_login_at || 0,
  };
}

function hashPassword(password) {
  const iterations = 210000;
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return `pbkdf2_sha256$${iterations}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function writeAudit(action, session, targetId, before, after) {
  try {
    await db.collection("audit_logs").add({
      action,
      actor_user_id: session.userId,
      target_collection: "users",
      target_id: targetId,
      before,
      after,
      created_at: Date.now(),
    });
  } catch (error) {
    console.warn("[save-admin-account] audit write skipped.", error);
  }
}
