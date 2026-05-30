"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (!session.userId || !["student", "teacher", "admin"].includes(session.role)) {
    return { ok: false, message: "Login is required." };
  }

  const [offerings, courses, materials, classSessions, teachers, students, enrollments] = await Promise.all([
    readCollection("course_offerings"),
    readCollection("courses"),
    readCollection("course_materials"),
    readCollection("class_sessions"),
    ["teacher", "student", "admin"].includes(session.role) ? readCollection("teachers") : Promise.resolve([]),
    session.role === "student" ? readCollection("students") : Promise.resolve([]),
    session.role === "student" ? readCollection("enrollments") : Promise.resolve([]),
  ]);

  const teacher = session.role === "teacher" ? findByUserId(teachers, session.userId) : null;
  const student = session.role === "student" ? findByUserId(students, session.userId) : null;

  const allowedOfferingIds = resolveAllowedOfferingIds({
    role: session.role,
    sessionUserId: session.userId,
    teacher,
    student,
    offerings,
    enrollments,
  });

  const courseMap = mapById(courses);
  const offeringMap = mapById(offerings);
  const teacherMap = mapById(teachers);
  const sessionsByOfferingId = groupBy(classSessions, "course_offering_id");
  const studentIds = buildStudentIdSet(student, session.userId);
  const studentEnrollmentByOffering = session.role === "student"
    ? buildStudentEnrollmentMap(enrollments, studentIds)
    : new Map();
  const allowedCourses = offerings
    .filter((item) => allowedOfferingIds.has(item._id))
    .map((offering) => buildCourseView(offering, courseMap, sessionsByOfferingId, teacherMap, studentEnrollmentByOffering.get(offering._id) || null));

  const now = Date.now();
  const visibleMaterials = materials
    .filter((item) => allowedOfferingIds.has(String(item.course_offering_id || item.courseOfferingId || "")))
    .filter((item) => {
      if (session.role !== "student") return true;
      const offering = offeringMap.get(item.course_offering_id) || {};
      const enrollment = studentEnrollmentByOffering.get(item.course_offering_id) || {};
      return item.is_public_to_students === true && isOfferingStarted(offering, now) && materialMatchesEnrollmentTeacher(item, enrollment, offering);
    })
    .filter((item) => {
      if (session.role !== "teacher") return true;
      return materialBelongsToTeacher(item, teacher, session.userId);
    })
    .map((item) => buildMaterialView(item, offeringMap, courseMap))
    .sort((a, b) => session.role === "student"
      ? Number(a.timelineAt || 0) - Number(b.timelineAt || 0)
      : Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

  const timeline = classSessions
    .filter((item) => allowedOfferingIds.has(item.course_offering_id || item.courseOfferingId))
    .map((item) => buildSessionView(item, offeringMap, courseMap))
    .sort((a, b) => Number(a.sessionStartAt || 0) - Number(b.sessionStartAt || 0));

  return {
    ok: true,
    data: {
      courses: allowedCourses,
      materials: visibleMaterials,
      timeline,
    },
  };
};

async function readCollection(name, limit = 1000) {
  try {
    const result = await db.collection(name).limit(limit).get();
    return result.data || [];
  } catch (error) {
    console.warn(`[get-course-materials] failed to read ${name}.`, error);
    return [];
  }
}

function findByUserId(rows, userId) {
  const keys = buildUserKeys(userId);
  return (
    rows.find((item) => keys.has(String(item.user_id || item.userId || "").trim())) || null
  );
}

function resolveAllowedOfferingIds({ role, sessionUserId, teacher, student, offerings, enrollments }) {
  if (role === "admin") {
    return new Set(offerings.map((item) => item._id).filter(Boolean));
  }

  if (role === "teacher") {
    const teacherKeys = buildUserKeys(sessionUserId);
    if (teacher) {
      teacherKeys.add(String(teacher._id || "").trim());
      teacherKeys.add(String(teacher.user_id || teacher.userId || "").trim());
    }
    return new Set(
      offerings
        .filter((item) => {
          const ids = Array.isArray(item.teacher_ids) ? item.teacher_ids : [];
          return ids.some((id) => teacherKeys.has(String(id || "").trim()));
        })
        .map((item) => item._id)
        .filter(Boolean),
    );
  }

  const studentIds = buildStudentIdSet(student, sessionUserId);
  return new Set(
    enrollments
      .filter((item) => item.status !== "dropped")
      .filter((item) => studentIds.has(String(item.student_id || item.studentId || "").trim()))
      .map((item) => item.course_offering_id || item.courseOfferingId)
      .filter(Boolean),
  );
}

function buildUserKeys(userId) {
  const value = String(userId || "").trim();
  const keys = new Set(value ? [value] : []);
  addRoleAliases(keys, value, "student", "s");
  addRoleAliases(keys, value, "teacher", "t");
  return keys;
}

function addRoleAliases(keys, value, roleName, roleCode) {
  const legacyPrefix = `u_${roleName}_`;
  const userPrefix = `user_${roleCode}_`;
  const entityPrefix = `${roleName}_`;
  const lower = value.toLowerCase();
  let suffix = "";

  if (lower.startsWith(legacyPrefix)) {
    suffix = value.slice(legacyPrefix.length);
  } else if (lower.startsWith(userPrefix)) {
    suffix = value.slice(userPrefix.length);
  } else if (lower.startsWith(entityPrefix)) {
    suffix = value.slice(entityPrefix.length);
  }

  if (!suffix) {
    return;
  }

  keys.add(`${legacyPrefix}${suffix}`);
  keys.add(`${userPrefix}${suffix}`);
  keys.add(`${entityPrefix}${suffix}`);
}

function buildStudentIdSet(student, sessionUserId) {
  const ids = new Set();
  const add = (value) => {
    const normalized = String(value || "").trim();
    if (normalized) {
      ids.add(normalized);
    }
  };

  add(sessionUserId);
  if (student) {
    add(student._id);
    add(student.user_id || student.userId);
  }

  for (const value of Array.from(ids)) {
    for (const alias of buildUserKeys(value)) {
      add(alias);
    }
  }

  return ids;
}

function buildCourseView(offering, courseMap, sessionsByOfferingId = new Map(), teacherMap = new Map(), enrollment = null) {
  const course = courseMap.get(offering.course_id) || {};
  const sessions = sessionsByOfferingId.get(offering._id) || [];
  const teacherOptions = (Array.isArray(offering.teacher_ids) ? offering.teacher_ids : [])
    .map((teacherId) => {
      const teacher = teacherMap.get(teacherId);
      if (!teacher) return null;
      return {
        teacherId,
        userId: teacher.user_id || "",
        name: teacher.name || teacher.teacher_no || teacher._id,
        teacherNo: teacher.teacher_no || "",
      };
    })
    .filter(Boolean);
  return {
    _id: offering._id,
    courseOfferingId: offering._id,
    courseId: offering.course_id || "",
    code: course.course_code || course.code || "",
    name: course.name || "",
    title: [course.course_code || course.code, course.name].filter(Boolean).join(" ").trim(),
    sectionNo: offering.section_no || "",
    teacherIds: offering.teacher_ids || [],
    teacherOptions,
    teacherNames: teacherOptions.map((item) => item.name).filter(Boolean),
    selectedTeacherId: enrollment && enrollment.selected_teacher_id || "",
    selectedTeacherUserId: enrollment && enrollment.selected_teacher_user_id || "",
    selectedTeacherName: enrollment && enrollment.selected_teacher_name || "",
    teacherSelectionRequired: teacherOptions.length > 1,
    teacherSelected: teacherOptions.length <= 1 || Boolean(enrollment && enrollment.selected_teacher_id),
    capacity: Number(offering.capacity || 0),
    enrolledCount: Number(offering.enrolled_count || 0),
    selectionStatus: offering.selection_status || "",
    startDate: offering.course_start_date || "",
    endDate: offering.course_end_date || "",
    classWeekday: Number(offering.class_weekday || 0),
    classStartTime: offering.class_start_time || "",
    classEndTime: offering.class_end_time || "",
    totalSessions: Number(offering.total_sessions || sessions.length || 0),
    materialUploadDeadlineAt: Number(offering.material_upload_deadline_at || 0),
  };
}

function buildMaterialView(item, offeringMap, courseMap) {
  const offeringId = String(item.course_offering_id || item.courseOfferingId || "");
  const offering = offeringMap.get(offeringId) || {};
  const course = courseMap.get(offering.course_id) || {};
  const courseName = [course.course_code || course.code, course.name].filter(Boolean).join(" ").trim();
  return {
    _id: item._id,
    courseOfferingId: offeringId,
    courseId: offering.course_id || "",
    courseName,
    teacherId: item.teacher_id || "",
    uploaderUserId: item.uploader_user_id || "",
    title: item.title || "",
    fileUrl: item.file_url || "",
    fileType: item.file_type || "",
    isPublicToStudents: item.is_public_to_students === true,
    knowledgeDocumentId: item.knowledge_document_id || "",
    timelineAt: Number(item.available_at || item.updated_at || 0),
    createdAt: Number(item.created_at || 0),
    updatedAt: Number(item.updated_at || 0),
  };
}

function buildStudentEnrollmentMap(enrollments, studentIds) {
  const result = new Map();
  for (const item of enrollments || []) {
    const studentId = String(item.student_id || item.studentId || "").trim();
    const offeringId = String(item.course_offering_id || item.courseOfferingId || "").trim();
    if (offeringId && studentIds.has(studentId) && item.status !== "dropped") {
      result.set(offeringId, item);
    }
  }
  return result;
}

function materialBelongsToTeacher(material, teacher, sessionUserId) {
  const teacherId = String(material.teacher_id || "").trim();
  const uploaderUserId = String(material.uploader_user_id || "").trim();
  return Boolean(
    (teacherId && teacher && teacherId === String(teacher._id || "").trim()) ||
    (uploaderUserId && uploaderUserId === String(sessionUserId || "").trim()),
  );
}

function materialMatchesEnrollmentTeacher(material, enrollment, offering) {
  const teacherIds = Array.isArray(offering.teacher_ids)
    ? offering.teacher_ids.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const selectedTeacherId = String(enrollment.selected_teacher_id || "").trim() || (teacherIds.length === 1 ? teacherIds[0] : "");
  const selectedTeacherUserId = String(enrollment.selected_teacher_user_id || "").trim();
  if (!selectedTeacherId && !selectedTeacherUserId) {
    return false;
  }
  const materialTeacherId = String(material.teacher_id || "").trim();
  const uploaderUserId = String(material.uploader_user_id || "").trim();
  return Boolean(
    (selectedTeacherId && materialTeacherId && selectedTeacherId === materialTeacherId) ||
    (selectedTeacherUserId && uploaderUserId && selectedTeacherUserId === uploaderUserId) ||
    (!materialTeacherId && !selectedTeacherUserId && teacherIds.length === 1),
  );
}

function mapById(items) {
  return new Map(items.filter((item) => item && item._id).map((item) => [item._id, item]));
}

function buildSessionView(item, offeringMap, courseMap) {
  const offering = offeringMap.get(item.course_offering_id) || {};
  return {
    _id: item._id,
    courseOfferingId: item.course_offering_id || "",
    courseName: buildCourseTitle(offering, courseMap),
    sessionDate: item.session_date || "",
    startTime: item.start_time || "",
    endTime: item.end_time || "",
    sequenceNo: Number(item.sequence_no || 0),
    sessionStartAt: getSessionStartAt(item),
    sessionEndAt: getSessionEndAt(item),
    status: item.status || "scheduled",
  };
}

function buildCourseTitle(offering, courseMap) {
  const course = courseMap.get(offering.course_id) || {};
  return [course.course_code || course.code, course.name].filter(Boolean).join(" ").trim();
}

function isOfferingStarted(offering, now = Date.now()) {
  const startAt = buildDateTime(offering.course_start_date, offering.class_start_time || "00:00");
  return !startAt || now >= startAt;
}

function getSessionStartAt(item) {
  const explicit = Number(item.session_start_at || 0);
  if (explicit) return explicit;
  return buildDateTime(item.session_date || "", item.start_time || "00:00");
}

function getSessionEndAt(item) {
  const explicit = Number(item.session_end_at || 0);
  if (explicit) return explicit;
  return buildDateTime(item.session_date || "", item.end_time || "23:59");
}

function buildDateTime(date, time) {
  const timestamp = Date.parse(`${date}T${time}:00`);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function groupBy(items, field) {
  const result = new Map();
  for (const item of items || []) {
    const key = item && item[field];
    if (!key) continue;
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(item);
  }
  return result;
}
