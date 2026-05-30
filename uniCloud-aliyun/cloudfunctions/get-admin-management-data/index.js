"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (session.role !== "admin" || !session.userId) {
    return { ok: false, message: "Only administrators can manage accounts and courses." };
  }

  const [users, roles, students, teachers, departments, majors, adminClasses, semesters, trainingPlans, courses, offerings, materials, classSessions, classrooms] = await Promise.all([
    readCollection("users"),
    readCollection("roles"),
    readCollection("students"),
    readCollection("teachers"),
    readCollection("departments"),
    readCollection("majors"),
    readCollection("admin_classes"),
    readCollection("semesters"),
    readCollection("training_plans"),
    readCollection("courses"),
    readCollection("course_offerings"),
    readCollection("course_materials"),
    readCollection("class_sessions"),
    readCollection("classrooms"),
  ]);

  const roleMap = mapById(roles);
  const usersById = mapById(users);
  const studentsByUserId = mapByField(students, "user_id");
  const teachersByUserId = mapByField(teachers, "user_id");
  const departmentsById = mapById(departments);
  const majorsById = mapById(majors);
  const adminClassesById = mapById(adminClasses);
  const semestersById = mapById(semesters);
  const coursesById = mapById(courses);
  const offeringsById = mapById(offerings);
  const teachersById = mapById(teachers);
  const classroomsById = mapById(classrooms);
  const materialsByOfferingId = groupBy(materials, "course_offering_id");
  const sessionsByOfferingId = groupBy(classSessions, "course_offering_id");

  const options = {
    roles: roles
      .map((item) => ({
        value: item.code || item._id,
        label: item.name || item.code || item._id,
        roleId: item._id,
      }))
      .sort((left, right) => String(left.label).localeCompare(String(right.label))),
    departments: departments
      .map((item) => ({
        value: item._id,
        label: item.name || item.code || item._id,
      }))
      .sort((left, right) => String(left.label).localeCompare(String(right.label))),
    majors: majors
      .map((item) => ({
        value: item._id,
        label: item.name || item.code || item._id,
      }))
      .sort((left, right) => String(left.label).localeCompare(String(right.label))),
    adminClasses: adminClasses
      .map((item) => ({
        value: item._id,
        label: item.name || item.code || item._id,
      }))
      .sort((left, right) => String(left.label).localeCompare(String(right.label))),
    semesters: semesters
      .map((item) => ({
        value: item._id,
        label: item.name || item.term || item.code || item._id,
      }))
      .sort((left, right) => String(left.label).localeCompare(String(right.label))),
    trainingPlans: trainingPlans
      .map((item) => ({
        value: item._id,
        label: item.name || item._id,
        majorId: item.major_id || "",
        gradeYear: Number(item.grade_year || 0),
      }))
      .sort((left, right) => String(left.label).localeCompare(String(right.label))),
    teachers: teachers
      .map((item) => {
        const user = usersById.get(item.user_id) || {};
        const department = item.department_id ? departmentsById.get(item.department_id) : null;
        return {
          value: item._id,
          label: item.name || user.display_name || user.username || item.teacher_no || item._id,
          subtitle: [item.teacher_no || "", department ? department.name || department.code || department._id : ""].filter(Boolean).join(" - "),
        };
      })
      .sort((left, right) => String(left.label).localeCompare(String(right.label))),
    classrooms: classrooms
      .map((item) => ({
        value: item._id,
        label: [item.name || "", item.building && item.room_no ? `${item.building}-${item.room_no}` : ""].filter(Boolean).join(" / ") || item._id,
        capacity: Number(item.capacity || 0),
      }))
      .sort((left, right) => String(left.label).localeCompare(String(right.label))),
  };

  const accounts = users
    .map((user) => buildAccountView(user, {
      roleMap,
      studentsByUserId,
      teachersByUserId,
      majorsById,
      departmentsById,
      adminClassesById,
    }))
    .sort((left, right) => String(left.displayName || left.username).localeCompare(String(right.displayName || right.username)));

  const courseViews = offerings
    .map((offering) => buildCourseView(offering, {
      coursesById,
      teachersById,
      usersById,
      departmentsById,
      majorsById,
      semestersById,
      materialsByOfferingId,
      sessionsByOfferingId,
      classroomsById,
    }))
    .sort((left, right) => String(left.courseCode || left.courseName).localeCompare(String(right.courseCode || right.courseName)));

  const materialViews = materials
    .map((item) => buildMaterialView(item, {
      usersById,
      teachersById,
      offeringsById,
      coursesById,
    }))
    .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));

  return {
    ok: true,
    data: {
      accounts,
      courses: courseViews,
      materials: materialViews,
      options,
      summary: {
        users: users.length,
        students: students.length,
        teachers: teachers.length,
        courses: courses.length,
        offerings: offerings.length,
        materials: materials.length,
        trainingPlans: trainingPlans.length,
        classrooms: classrooms.length,
      },
      meta: {
        source: "unicloud",
        generatedAt: Date.now(),
      },
    },
  };
};

async function readCollection(name, limit = 1000) {
  try {
    const result = await db.collection(name).limit(limit).get();
    return result.data || [];
  } catch (error) {
    console.warn(`[get-admin-management-data] failed to read ${name}.`, error);
    return [];
  }
}

function buildAccountView(user, indexes) {
  const roleCodes = resolveRoleCodes(user.role_ids || [], indexes.roleMap);
  const primaryRole = resolvePrimaryRole(roleCodes);
  const student = indexes.studentsByUserId.get(user._id) || null;
  const teacher = indexes.teachersByUserId.get(user._id) || null;

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
    studentProfile: student ? buildStudentProfile(student, indexes) : null,
    teacherProfile: teacher ? buildTeacherProfile(teacher, indexes) : null,
  };
}

function buildStudentProfile(student, indexes) {
  const major = student.major_id ? indexes.majorsById.get(student.major_id) : null;
  const adminClass = student.admin_class_id ? indexes.adminClassesById.get(student.admin_class_id) : null;
  return {
    _id: student._id,
    userId: student.user_id || "",
    studentNo: student.student_no || "",
    name: student.name || "",
    majorId: student.major_id || "",
    majorName: major ? major.name || major.code || major._id : "",
    adminClassId: student.admin_class_id || "",
    adminClassName: adminClass ? adminClass.name || adminClass.code || adminClass._id : "",
    enrollmentYear: Number(student.enrollment_year || 0),
    trainingPlanId: student.training_plan_id || "",
    status: student.status || "active",
    contact: clone(student.contact || {}),
    familyInfo: clone(student.family_info || {}),
  };
}

function buildTeacherProfile(teacher, indexes) {
  const department = teacher.department_id ? indexes.departmentsById.get(teacher.department_id) : null;
  return {
    _id: teacher._id,
    userId: teacher.user_id || "",
    teacherNo: teacher.teacher_no || "",
    name: teacher.name || "",
    departmentId: teacher.department_id || "",
    departmentName: department ? department.name || department.code || department._id : "",
    title: teacher.title || "",
    researchFields: Array.isArray(teacher.research_fields) ? teacher.research_fields.slice() : [],
    teachingExperience: teacher.teaching_experience || "",
    office: teacher.office || "",
    status: teacher.status || "active",
  };
}

function buildCourseView(offering, indexes) {
  const course = indexes.coursesById.get(offering.course_id) || {};
  const department = course.department_id ? indexes.departmentsById.get(course.department_id) : null;
  const major = offering.major_id ? indexes.majorsById.get(offering.major_id) : null;
  const semester = offering.semester_id ? indexes.semestersById.get(offering.semester_id) : null;
  const teacherNames = (offering.teacher_ids || [])
    .map((teacherId) => {
      const teacher = indexes.teachersById.get(teacherId);
      if (!teacher) {
        return "";
      }
      const user = indexes.usersById.get(teacher.user_id) || {};
      return teacher.name || user.display_name || user.username || teacher.teacher_no || teacherId;
    })
    .filter(Boolean);
  const materialCount = (indexes.materialsByOfferingId.get(offering._id) || []).length;
  const sessions = indexes.sessionsByOfferingId.get(offering._id) || [];
  const sessionCount = sessions.length;
  const classroomId = offering.classroom_id || (sessions[0] && sessions[0].classroom_id) || "";
  const classroom = classroomId ? indexes.classroomsById.get(classroomId) : null;

  return {
    _id: offering._id,
    courseId: course._id || offering.course_id || "",
    courseOfferingId: offering._id,
    courseCode: course.course_code || "",
    courseName: course.name || "",
    departmentId: course.department_id || "",
    departmentName: department ? department.name || department.code || department._id : "",
    description: course.description || "",
    status: course.status || "active",
    credits: Number(course.credits || 0),
    courseType: course.course_type || "",
    difficultyLevel: Number(course.difficulty_level || 0),
    semesterId: offering.semester_id || "",
    semesterName: semester ? semester.name || semester.term || semester.code || semester._id : "",
    majorId: offering.major_id || "",
    majorName: major ? major.name || major.code || major._id : "",
    trainingPlanId: offering.training_plan_id || "",
    gradeYear: Number(offering.grade_year || 0),
    classroomId,
    classroomName: classroom ? classroom.name || [classroom.building, classroom.room_no].filter(Boolean).join("-") || classroom._id : "",
    sectionNo: offering.section_no || "",
    teacherIds: Array.isArray(offering.teacher_ids) ? offering.teacher_ids.slice() : [],
    teacherNames,
    capacity: Number(offering.capacity || 0),
    enrolledCount: Number(offering.enrolled_count || 0),
    selectionStatus: offering.selection_status || "not_started",
    syllabusUrl: offering.syllabus_url || "",
    startDate: offering.course_start_date || "",
    endDate: offering.course_end_date || "",
    classWeekday: Number(offering.class_weekday || 0),
    classStartTime: offering.class_start_time || "",
    classEndTime: offering.class_end_time || "",
    totalSessions: Number(offering.total_sessions || sessionCount || 0),
    materialUploadDeadlineAt: Number(offering.material_upload_deadline_at || 0),
    materialCount,
    sessionCount,
    createdAt: Number(offering.created_at || 0),
    updatedAt: Number(offering.updated_at || 0),
  };
}

function buildMaterialView(item, indexes) {
  const offering = indexes.offeringsById.get(item.course_offering_id) || {};
  const course = indexes.coursesById.get(offering.course_id) || {};
  const uploader = indexes.usersById.get(item.uploader_user_id) || null;
  const teacher = indexes.teachersById.get(item.teacher_id) || null;
  return {
    _id: item._id,
    courseOfferingId: item.course_offering_id || "",
    courseId: offering.course_id || "",
    courseCode: course.course_code || "",
    courseName: [course.course_code, course.name].filter(Boolean).join(" ").trim(),
    teacherId: item.teacher_id || "",
    teacherName: teacher ? teacher.name || teacher.teacher_no || teacher._id : "",
    uploaderUserId: item.uploader_user_id || "",
    uploaderName: uploader ? uploader.display_name || uploader.username || "" : "",
    title: item.title || "",
    fileUrl: item.file_url || "",
    fileType: item.file_type || "",
    isPublicToStudents: item.is_public_to_students === true,
    knowledgeDocumentId: item.knowledge_document_id || "",
    createdAt: Number(item.created_at || 0),
    updatedAt: Number(item.updated_at || 0),
  };
}

function resolveRoleCodes(roleIds, roleMap) {
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

function mapById(items) {
  return new Map((items || []).filter((item) => item && item._id).map((item) => [item._id, item]));
}

function mapByField(items, field) {
  const result = new Map();
  for (const item of items || []) {
    if (item && item[field]) {
      result.set(item[field], item);
    }
  }
  return result;
}

function groupBy(items, field) {
  const result = new Map();
  for (const item of items || []) {
    const key = item && item[field];
    if (!key) {
      continue;
    }
    if (!result.has(key)) {
      result.set(key, []);
    }
    result.get(key).push(item);
  }
  return result;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
