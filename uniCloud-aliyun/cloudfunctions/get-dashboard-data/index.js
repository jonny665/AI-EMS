"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (!session.userId || !["student", "teacher", "admin"].includes(session.role)) {
    return { ok: false, message: "Login is required." };
  }

  const [courses, offerings, enrollments, students, teachers, attendance, leaves, evaluations, classSessions, materials, trainingPlans, adminClasses, majors] = await Promise.all([
    readCollection("courses"),
    readCollection("course_offerings"),
    readCollection("enrollments"),
    readCollection("students"),
    readCollection("teachers"),
    readCollection("attendance_records"),
    readCollection("leave_requests"),
    readCollection("course_evaluations"),
    readCollection("class_sessions"),
    readCollection("course_materials"),
    readCollection("training_plans"),
    readCollection("admin_classes"),
    readCollection("majors"),
  ]);

  const student = findByUserId(students, session.userId);
  const teacher = findByUserId(teachers, session.userId);
  const allowedOfferingIds = resolveAllowedOfferingIds({
    role: session.role,
    sessionUserId: session.userId,
    student,
    teacher,
    offerings,
    enrollments,
  });

  const courseMap = mapById(courses);
  const offeringMap = mapById(offerings);
  const teacherMap = mapById(teachers);
  const trainingPlanMap = mapById(trainingPlans);
  const adminClassMap = mapById(adminClasses);
  const majorMap = mapById(majors);
  const sessionsByOfferingId = groupBy(classSessions, "course_offering_id");
  const studentIds = buildStudentIdSet(student, session.userId);
  const studentEnrollmentByOffering = session.role === "student"
    ? buildStudentEnrollmentMap(enrollments, studentIds)
    : new Map();
  const teacherStudentIds = session.role === "teacher"
    ? buildTeacherStudentIdSet({ teacher, sessionUserId: session.userId, enrollments, allowedOfferingIds })
    : new Set();
  const coursesView = offerings
    .filter((item) => allowedOfferingIds.has(item._id))
    .map((offering) => buildCourseView(offering, courseMap, teacherMap, sessionsByOfferingId, {
      enrollment: studentEnrollmentByOffering.get(offering._id) || null,
      enrollments,
    }));

  const attendanceView = attendance
    .map(normalizeAttendance)
    .filter((item) => {
      if (session.role === "admin") return true;
      if (session.role === "teacher") {
        return allowedOfferingIds.has(item.courseOfferingId) && (!teacherStudentIds.size || teacherStudentIds.has(item.studentId));
      }
      return studentIds.has(item.studentId);
    })
    .map((item) => ({
      ...item,
      courseName: buildCourseName(offeringMap.get(item.courseOfferingId), courseMap),
    }));

  const classSessionView = classSessions
    .filter((item) => allowedOfferingIds.has(item.course_offering_id || item.courseOfferingId))
    .map((item) => normalizeClassSession(item, offeringMap, courseMap))
    .sort((a, b) => Number(a.sessionStartAt || 0) - Number(b.sessionStartAt || 0));

  const leaveView = leaves
    .map(normalizeLeave)
    .filter((item) => {
      if (session.role === "admin") {
        return item.status === "pending";
      }
      if (session.role === "teacher") {
        return item.status === "pending" && allowedOfferingIds.has(item.courseOfferingId) && (!teacherStudentIds.size || teacherStudentIds.has(item.studentId));
      }
      return studentIds.has(item.studentId);
    })
    .map((item) => ({
      ...item,
      courseName: item.courseName || buildCourseName(offeringMap.get(item.courseOfferingId), courseMap),
    }));

  const summary = buildEvaluationSummary(coursesView, evaluations);
  const materialView = buildVisibleMaterials({
    role: session.role,
    sessionUserId: session.userId,
    teacher,
    studentEnrollmentByOffering,
    materials,
    allowedOfferingIds,
    offeringMap,
    courseMap,
    now: Date.now(),
  });
  const profile = session.role === "student"
    ? buildStudentProfile({
        student,
        session,
        offerings,
        courses,
        enrollments,
        attendance,
        classSessions,
        trainingPlanMap,
        adminClassMap,
        majorMap,
      })
    : {};
  const teacherProfile = session.role === "teacher"
    ? buildTeacherProfile({ teacher, session, offerings, enrollments, teachers, courses, allowedOfferingIds })
    : {};
  const courseStudents = ["teacher", "admin"].includes(session.role)
    ? buildCourseStudents({ role: session.role, allowedOfferingIds, enrollments, students, teacher, sessionUserId: session.userId })
    : [];

  return {
    ok: true,
    data: {
      user: session,
      courses: coursesView,
      attendance: attendanceView,
      classSessions: classSessionView,
      courseStudents,
      leaveRequests: leaveView,
      evaluationSummary: summary,
      materials: materialView,
      profile,
      teacherProfile,
      systemStats: {
        totalStudents: students.length,
        totalTeachers: teachers.length,
        activeCourses: courses.length,
        activeOfferings: offerings.length,
      },
      metrics: {
        courses: coursesView.length,
        pendingLeaves: leaveView.filter((item) => item.status === "pending").length,
        evaluations: summary.reduce((sum, item) => sum + Number(item.count || 0), 0),
        attendance: attendanceView.length,
      },
      meta: {
        source: "unicloud",
        sessionUserId: session.userId,
        normalizedStudentId: student && student._id ? student._id : "",
        normalizedTeacherId: teacher && teacher._id ? teacher._id : "",
        allowedOfferingCount: allowedOfferingIds.size,
        collectionCounts: {
          courses: courses.length,
          courseOfferings: offerings.length,
          enrollments: enrollments.length,
          students: students.length,
          teachers: teachers.length,
          attendanceRecords: attendance.length,
          leaveRequests: leaves.length,
          courseEvaluations: evaluations.length,
          classSessions: classSessions.length,
          courseMaterials: materials.length,
        },
      },
    },
  };
};

async function readCollection(name, limit = 1000) {
  try {
    const result = await db.collection(name).limit(limit).get();
    return result.data || [];
  } catch (error) {
    console.warn(`[get-dashboard-data] failed to read ${name}.`, error);
    return [];
  }
}

function findByUserId(rows, userId) {
  const keys = buildUserKeys(userId);
  return (
    rows.find((item) => {
      const candidate = String(item.user_id || item.userId || "").trim();
      return keys.has(candidate);
    }) || null
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

  for (const key of Array.from(ids)) {
    for (const alias of buildUserKeys(key)) {
      add(alias);
    }
  }

  return ids;
}

function buildStudentEnrollmentMap(enrollments, studentIds) {
  const result = new Map();
  for (const item of enrollments || []) {
    const studentId = String(item.student_id || item.studentId || "").trim();
    const offeringId = String(item.course_offering_id || item.courseOfferingId || "").trim();
    if (!offeringId || !studentIds.has(studentId) || item.status === "dropped") {
      continue;
    }
    result.set(offeringId, item);
  }
  return result;
}

function buildTeacherStudentIdSet({ teacher, sessionUserId, enrollments, allowedOfferingIds }) {
  const result = new Set();
  for (const item of enrollments || []) {
    const offeringId = String(item.course_offering_id || item.courseOfferingId || "").trim();
    if (!allowedOfferingIds.has(offeringId) || item.status === "dropped") {
      continue;
    }
    if (enrollmentBelongsToTeacher(item, teacher, sessionUserId)) {
      const studentId = String(item.student_id || item.studentId || "").trim();
      if (studentId) result.add(studentId);
    }
  }
  return result;
}

function enrollmentBelongsToTeacher(enrollment, teacher, sessionUserId) {
  const selectedTeacherId = String(enrollment.selected_teacher_id || enrollment.selectedTeacherId || "").trim();
  const selectedTeacherUserId = String(enrollment.selected_teacher_user_id || enrollment.selectedTeacherUserId || "").trim();
  if (!selectedTeacherId && !selectedTeacherUserId) {
    return true;
  }
  return Boolean(
    (teacher && selectedTeacherId && selectedTeacherId === String(teacher._id || "").trim()) ||
    (selectedTeacherUserId && selectedTeacherUserId === String(sessionUserId || "").trim()),
  );
}

function resolveAllowedOfferingIds({ role, sessionUserId, student, teacher, offerings, enrollments }) {
  if (role === "admin") {
    return new Set(offerings.map((item) => item._id).filter(Boolean));
  }

  if (role === "teacher") {
    const teacherKeys = buildUserKeys(sessionUserId);
    if (teacher) {
      teacherKeys.add(String(teacher._id || ""));
      teacherKeys.add(String(teacher.user_id || teacher.userId || ""));
    }
    return new Set(
      offerings
        .filter((item) => {
          const ids = Array.isArray(item.teacher_ids) ? item.teacher_ids.map((value) => String(value || "")) : [];
          return ids.some((id) => teacherKeys.has(id));
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

function buildCourseView(offering, courseMap, teacherMap = new Map(), sessionsByOfferingId = new Map(), options = {}) {
  const course = courseMap.get(offering.course_id) || {};
  const sessions = sessionsByOfferingId.get(offering._id) || [];
  const teacherIds = Array.isArray(offering.teacher_ids) ? offering.teacher_ids : [];
  const teacherOptions = teacherIds
    .map((teacherId) => {
      const teacher = teacherMap.get(teacherId);
      if (!teacher) return null;
      return {
        teacherId,
        userId: teacher.user_id || "",
        name: teacher.name || teacher.display_name || teacher.teacher_no || teacher._id,
        teacherNo: teacher.teacher_no || "",
      };
    })
    .filter(Boolean);
  const teacherNames = teacherOptions.map((item) => item.name).filter(Boolean);
  const enrollment = options.enrollment || {};
  const completed = isOfferingCompleted(offering, sessions);
  return {
    _id: offering._id,
    courseOfferingId: offering._id,
    courseId: offering.course_id || "",
    code: course.course_code || course.code || "",
    name: course.name || "",
    sectionNo: offering.section_no || "",
    teacherIds,
    teacherNames,
    teacherOptions,
    selectedTeacherId: enrollment.selected_teacher_id || "",
    selectedTeacherUserId: enrollment.selected_teacher_user_id || "",
    selectedTeacherName: enrollment.selected_teacher_name || "",
    teacherSelectedAt: Number(enrollment.teacher_selected_at || 0),
    teacherSelectionRequired: teacherOptions.length > 1,
    teacherSelected: teacherOptions.length <= 1 || Boolean(enrollment.selected_teacher_id),
    schedule: offering.schedule || buildSchedule(offering),
    credits: Number(course.credits || course.credit || 0),
    courseType: course.course_type || "",
    majorId: offering.major_id || "",
    trainingPlanId: offering.training_plan_id || "",
    gradeYear: Number(offering.grade_year || 0),
    capacity: Number(offering.capacity || 0),
    enrolledCount: Number(offering.enrolled_count || 0),
    startDate: offering.course_start_date || "",
    endDate: offering.course_end_date || "",
    classWeekday: Number(offering.class_weekday || 0),
    classStartTime: offering.class_start_time || "",
    classEndTime: offering.class_end_time || "",
    totalSessions: Number(offering.total_sessions || sessions.length || 0),
    materialUploadDeadlineAt: Number(offering.material_upload_deadline_at || 0),
    completed,
    enrollmentStatus: completed ? "completed" : enrollment.status || "",
    selectionStatus: offering.selection_status || "",
  };
}

function normalizeAttendance(item) {
  return {
    ...item,
    studentId: String(item.student_id || item.studentId || ""),
    courseOfferingId: String(item.course_offering_id || item.courseOfferingId || ""),
    date: item.attendance_date || item.date || "",
    status: item.status || "",
    source: item.source || "",
    createdAt: Number(item.created_at || item.createdAt || 0),
    updatedAt: Number(item.updated_at || item.updatedAt || 0),
  };
}

function normalizeClassSession(item, offeringMap, courseMap) {
  const offeringId = String(item.course_offering_id || item.courseOfferingId || "");
  return {
    _id: item._id,
    courseOfferingId: offeringId,
    courseName: buildCourseName(offeringMap.get(offeringId), courseMap),
    sessionDate: item.session_date || item.sessionDate || "",
    weekday: Number(item.weekday || 0),
    startTime: item.start_time || item.startTime || "",
    endTime: item.end_time || item.endTime || "",
    sequenceNo: Number(item.sequence_no || item.sequenceNo || 0),
    sessionStartAt: getSessionStartAt(item),
    sessionEndAt: getSessionEndAt(item),
    status: item.status || "scheduled",
  };
}

function normalizeLeave(item) {
  return {
    ...item,
    studentId: String(item.student_id || item.studentId || ""),
    courseOfferingId: String(item.course_offering_id || item.courseOfferingId || ""),
    courseName: item.course_name || item.courseName || "",
    date: item.leave_date || item.date || "",
    reasonType: item.reason_type || item.reasonType || "",
    reasonDetail: item.reason_detail || item.reasonDetail || item.reason || "",
    status: item.status || "pending",
    reviewComment: item.review_comment || item.reviewComment || "",
    createdAt: Number(item.created_at || item.createdAt || 0),
    updatedAt: Number(item.updated_at || item.updatedAt || 0),
  };
}

function buildCourseName(offering, courseMap) {
  if (!offering) {
    return "";
  }
  const course = courseMap.get(offering.course_id) || {};
  return [course.course_code || course.code, course.name].filter(Boolean).join(" ").trim();
}

function buildSchedule(offering) {
  if (!offering.class_weekday || !offering.class_start_time || !offering.class_end_time) {
    return "";
  }
  const weekday = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][Number(offering.class_weekday)] || "";
  return [weekday, `${offering.class_start_time}-${offering.class_end_time}`].filter(Boolean).join(" ");
}

function buildEvaluationSummary(courses, evaluations) {
  const allowedIds = new Set(
    courses.map((item) => item.courseOfferingId || item._id).filter(Boolean),
  );
  const normalized = evaluations
    .map((item) => {
      const scores = item.scores && typeof item.scores === "object" ? item.scores : {};
      return {
        courseOfferingId: item.course_offering_id || item.courseOfferingId || "",
        courseId: item.course_id || item.courseId || "",
        rating: Number(item.rating || scores.overall || item.average_rating || 0),
        feedback: item.feedback_text || item.feedback || item.content || "",
      };
    })
    .filter((item) => item.courseOfferingId && allowedIds.has(item.courseOfferingId));

  return courses.map((course) => {
    const rows = normalized.filter((item) => item.courseOfferingId === course.courseOfferingId);
    const average = rows.length
      ? Math.round((rows.reduce((sum, item) => sum + Number(item.rating || 0), 0) / rows.length) * 10) / 10
      : 0;
    return {
      courseId: course.courseId || "",
      courseOfferingId: course.courseOfferingId || "",
      courseName: [course.code, course.name].filter(Boolean).join(" ").trim() || course.name || "",
      count: rows.length,
      average,
      feedback: rows.map((item) => item.feedback).filter(Boolean),
    };
  });
}

function buildVisibleMaterials({ role, sessionUserId, teacher, studentEnrollmentByOffering, materials, allowedOfferingIds, offeringMap, courseMap, now }) {
  return materials
    .filter((item) => allowedOfferingIds.has(String(item.course_offering_id || item.courseOfferingId || "")))
    .filter((item) => {
      const offeringId = String(item.course_offering_id || item.courseOfferingId || "");
      const offering = offeringMap.get(offeringId) || {};
      if (role === "teacher") {
        return materialBelongsToTeacher(item, teacher, sessionUserId);
      }
      if (role !== "student") return true;
      const enrollment = studentEnrollmentByOffering.get(offeringId) || {};
      return item.is_public_to_students === true &&
        isOfferingStarted(offering, now) &&
        materialMatchesEnrollmentTeacher(item, enrollment, offering);
    })
    .map((item) => {
      const offering = offeringMap.get(item.course_offering_id) || {};
      const courseName = buildCourseName(offering, courseMap);
      return {
        _id: item._id,
        courseOfferingId: item.course_offering_id || "",
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
    })
    .sort((a, b) => role === "student"
      ? Number(a.timelineAt || 0) - Number(b.timelineAt || 0)
      : Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

function materialBelongsToTeacher(material, teacher, sessionUserId) {
  const teacherId = String(material.teacher_id || material.teacherId || "").trim();
  const uploaderUserId = String(material.uploader_user_id || material.uploaderUserId || "").trim();
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

function buildStudentProfile(input) {
  const student = input.student;
  if (!student) {
    return { major: "", gpa: "0.0", creditsEarned: 0, totalCredits: 0, enrollmentYear: "" };
  }
  const major = input.majorMap.get(student.major_id) || {};
  const adminClass = input.adminClassMap.get(student.admin_class_id) || {};
  const plan = input.trainingPlanMap.get(student.training_plan_id) || {};
  const studentIds = buildStudentIdSet(student, input.session.userId);
  const enrolledOfferingIds = new Set(
    input.enrollments
      .filter((item) => item.status !== "dropped" && studentIds.has(String(item.student_id || item.studentId || "").trim()))
      .map((item) => item.course_offering_id || item.courseOfferingId)
      .filter(Boolean),
  );
  const planOfferings = input.offerings.filter((offering) => studentMatchesPlanOffering(student, offering));
  const planCourseIds = new Set();
  const uniquePlanOfferings = planOfferings.filter((offering) => {
    const key = offering.course_id;
    if (!key || planCourseIds.has(key)) return false;
    planCourseIds.add(key);
    return true;
  });
  const completedCourseIds = new Set();
  const completedOfferings = input.offerings
    .filter((offering) => enrolledOfferingIds.has(offering._id))
    .filter((offering) => isOfferingCompleted(offering, input.classSessions.filter((item) => item.course_offering_id === offering._id)))
    .filter((offering) => {
      if (completedCourseIds.has(offering.course_id)) return false;
      completedCourseIds.add(offering.course_id);
      return true;
    });
  const moduleCredits = buildModuleCredits({
    planOfferings: uniquePlanOfferings,
    completedOfferings,
    courseMap: mapById(input.courses),
  });
  const totalCredits = uniquePlanOfferings.length
    ? uniquePlanOfferings.reduce((sum, offering) => sum + Number((mapById(input.courses).get(offering.course_id) || {}).credits || 0), 0)
    : Number(plan.total_required_credits || 0);
  const creditsEarned = completedOfferings.reduce((sum, offering) => sum + Number((mapById(input.courses).get(offering.course_id) || {}).credits || 0), 0);
  const attendanceStats = calculateAttendanceStats({
    studentIds,
    enrolledOfferingIds,
    classSessions: input.classSessions,
    attendance: input.attendance,
  });

  return {
    studentId: student._id,
    studentNo: student.student_no || "",
    name: student.name || "",
    gender: student.gender || "",
    major: major.name || student.major_name || "",
    adminClass: adminClass.name || student.admin_class_name || "",
    gpa: "0.0",
    creditsEarned,
    totalCredits,
    completedCourseCount: completedOfferings.length,
    attendanceRate: attendanceStats.attendanceRate,
    attendanceStats,
    enrollmentYear: Number(student.enrollment_year || 0),
    trainingPlanId: student.training_plan_id || "",
    contact: student.contact || {},
    familyInfo: student.family_info || {},
    moduleCredits,
    gpaTrend: [],
    percentileRank: Number(student.percentile_rank || 0),
    interestTags: [],
  };
}

function studentMatchesPlanOffering(student, offering) {
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

function buildTeacherProfile({ teacher, session, offerings, enrollments, allowedOfferingIds }) {
  if (!teacher) {
    return { department: "", title: "", studentCount: 0 };
  }
  const studentCount = new Set(
    enrollments
      .filter((item) => allowedOfferingIds.has(item.course_offering_id || item.courseOfferingId) && item.status !== "dropped")
      .map((item) => item.student_id || item.studentId)
      .filter(Boolean),
  ).size;
  return {
    teacherId: teacher._id,
    teacherNo: teacher.teacher_no || "",
    name: teacher.name || session.displayName || "",
    department: teacher.department_name || teacher.department_id || "",
    title: teacher.title || "",
    office: teacher.office || "",
    researchFields: Array.isArray(teacher.research_fields) ? teacher.research_fields : [],
    teachingExperience: teacher.teaching_experience || "",
    studentCount,
    courseCount: offerings.filter((item) => allowedOfferingIds.has(item._id)).length,
  };
}

function buildCourseStudents({ role, allowedOfferingIds, enrollments, students, teacher, sessionUserId }) {
  const studentMap = mapById(students);
  return enrollments
    .filter((item) => allowedOfferingIds.has(item.course_offering_id || item.courseOfferingId) && item.status !== "dropped")
    .filter((item) => {
      if (role !== "teacher") return true;
      return enrollmentBelongsToTeacher(item, teacher, sessionUserId);
    })
    .map((item) => {
      const student = studentMap.get(item.student_id || item.studentId) || {};
      return {
        studentId: item.student_id || item.studentId || "",
        studentName: student.name || item.student_id || "",
        studentNo: student.student_no || "",
        courseOfferingId: item.course_offering_id || item.courseOfferingId || "",
        enrollmentStatus: item.status || "enrolled",
        selectedTeacherId: item.selected_teacher_id || "",
        selectedTeacherUserId: item.selected_teacher_user_id || "",
        selectedTeacherName: item.selected_teacher_name || "",
      };
    });
}

function buildModuleCredits({ planOfferings, completedOfferings, courseMap }) {
  const modules = {
    general: { current: 0, total: 0 },
    majorRequired: { current: 0, total: 0 },
    majorElective: { current: 0, total: 0 },
    practice: { current: 0, total: 0 },
  };
  for (const offering of planOfferings) {
    const course = courseMap.get(offering.course_id) || {};
    const key = moduleKey(course.course_type || "major_required");
    if (!modules[key]) modules[key] = { current: 0, total: 0 };
    modules[key].total += Number(course.credits || 0);
  }
  for (const offering of completedOfferings) {
    const course = courseMap.get(offering.course_id) || {};
    const key = moduleKey(course.course_type || "major_required");
    if (!modules[key]) modules[key] = { current: 0, total: 0 };
    modules[key].current += Number(course.credits || 0);
  }
  return modules;
}

function moduleKey(value) {
  return String(value || "").replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function calculateAttendanceStats({ studentIds, enrolledOfferingIds, classSessions, attendance, now = Date.now() }) {
  const pastSessions = classSessions.filter((item) =>
    enrolledOfferingIds.has(item.course_offering_id || item.courseOfferingId) &&
    getSessionEndAt(item) < now &&
    item.status !== "cancelled",
  );
  let attended = 0;
  let leave = 0;
  for (const classSession of pastSessions) {
    const offeringId = classSession.course_offering_id || classSession.courseOfferingId;
    const sessionDate = classSession.session_date || classSession.sessionDate;
    const record = attendance.find((item) =>
      studentIds.has(String(item.student_id || item.studentId || "").trim()) &&
      String(item.course_offering_id || item.courseOfferingId || "") === offeringId &&
      String(item.attendance_date || item.date || "") === sessionDate,
    );
    if (record && record.status === "on_leave") {
      leave += 1;
    } else if (record && ["present", "late", "excused"].includes(record.status)) {
      attended += 1;
    }
  }
  const counted = Math.max(pastSessions.length - leave, 0);
  return {
    attendedSessions: attended,
    leaveSessions: leave,
    pastSessions: pastSessions.length,
    countedSessions: counted,
    attendanceRate: counted ? Math.round((attended / counted) * 100) : 0,
  };
}

function isOfferingStarted(offering, now = Date.now()) {
  const startAt = buildDateTime(offering.course_start_date, offering.class_start_time || "00:00");
  return !startAt || now >= startAt;
}

function isOfferingCompleted(offering, sessions = [], now = Date.now()) {
  if (sessions.length) {
    return sessions.every((item) => getSessionEndAt(item) && getSessionEndAt(item) < now);
  }
  const endAt = buildDateTime(offering.course_end_date, offering.class_end_time || "23:59");
  return Boolean(endAt && endAt < now);
}

function getSessionStartAt(item) {
  const explicit = Number(item.session_start_at || item.sessionStartAt || 0);
  if (explicit) return explicit;
  return buildDateTime(item.session_date || item.sessionDate || "", item.start_time || item.startTime || "00:00");
}

function getSessionEndAt(item) {
  const explicit = Number(item.session_end_at || item.sessionEndAt || 0);
  if (explicit) return explicit;
  return buildDateTime(item.session_date || item.sessionDate || "", item.end_time || item.endTime || "23:59");
}

function buildDateTime(date, time) {
  const timestamp = Date.parse(`${date}T${time}:00`);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mapById(rows) {
  return new Map(rows.filter((item) => item && item._id).map((item) => [item._id, item]));
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
