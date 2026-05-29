"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (!session.userId || !["student", "teacher", "admin"].includes(session.role)) {
    return { ok: false, message: "Login is required." };
  }

  const [
    users,
    students,
    teachers,
    departments,
    majors,
    trainingPlans,
    courses,
    offerings,
    classSessions,
    enrollments,
    grades,
    attendance,
    leaves,
    evaluations,
    materials,
    profileChanges,
    recommendations,
    academicAlerts,
    interestTags,
    studentInterestTags,
  ] = await Promise.all([
    readCollection("users"),
    readCollection("students"),
    readCollection("teachers"),
    readCollection("departments"),
    readCollection("majors"),
    readCollection("training_plans"),
    readCollection("courses"),
    readCollection("course_offerings"),
    readCollection("class_sessions"),
    readCollection("enrollments"),
    readCollection("grades"),
    readCollection("attendance_records"),
    readCollection("leave_requests"),
    readCollection("course_evaluations"),
    readCollection("course_materials"),
    readCollection("profile_change_requests"),
    readCollection("course_recommendations"),
    readCollection("academic_alerts"),
    readCollection("interest_tags"),
    readCollection("student_interest_tags"),
  ]);

  const context = buildContext({
    session,
    users,
    students,
    teachers,
    departments,
    majors,
    trainingPlans,
    courses,
    offerings,
    classSessions,
    enrollments,
    grades,
    attendance,
    leaves,
    evaluations,
    materials,
    profileChanges,
    recommendations,
    academicAlerts,
    interestTags,
    studentInterestTags,
  });

  return {
    ok: true,
    data: {
      user: session,
      profile: context.profile,
      teacherProfile: context.teacherProfile,
      systemStats: context.systemStats,
      courses: context.courseViews,
      attendance: context.attendanceViews,
      leaveRequests: context.leaveViews,
      evaluationSummary: context.evaluationSummary,
      materials: context.materialViews,
      profileChangeRequests: context.profileChangeViews,
      recommendations: context.recommendationViews,
      academicAlerts: context.academicAlertViews,
      atRiskStudents: context.atRiskStudents,
      metrics: context.metrics,
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
    console.warn(`[get-dashboard-data] failed to read ${name}.`, error);
    return [];
  }
}

function buildContext(data) {
  const indexes = buildIndexes(data);
  const currentStudent = data.students.find((item) => item.user_id === data.session.userId) || null;
  const currentTeacher = data.teachers.find((item) => item.user_id === data.session.userId) || null;
  const relevantOfferingIds = resolveRelevantOfferingIds(data.session.role, currentStudent, currentTeacher, data);
  const relevantOfferings = data.offerings.filter((item) => relevantOfferingIds.includes(item._id));
  const courseViews = relevantOfferings.map((offering) => buildCourseView(offering, indexes));
  const attendanceViews = buildAttendanceViews(data.session.role, currentStudent, relevantOfferingIds, data.attendance, indexes);
  const leaveViews = buildLeaveViews(data.session.role, currentStudent, relevantOfferingIds, data.leaves, indexes);
  const relevantEvaluations = filterEvaluations(data.session.role, currentTeacher, relevantOfferingIds, data.evaluations);
  const evaluationSummary = buildEvaluationSummary(relevantEvaluations, indexes);
  const materialViews = buildMaterialViews(data.session.role, relevantOfferingIds, data.materials, indexes);
  const profileChangeViews = buildProfileChangeViews(data.session, currentStudent, currentTeacher, data.profileChanges, indexes);
  const recommendationViews = buildRecommendationViews(currentStudent, relevantOfferingIds, data.recommendations, evaluationSummary, data, indexes);
  const academicAlertViews = buildAcademicAlertViews(currentStudent, data.academicAlerts, attendanceViews, indexes);
  const atRiskStudents = buildAtRiskStudents(attendanceViews);

  return {
    profile: buildStudentProfile(currentStudent, data.grades, data.studentInterestTags, indexes),
    teacherProfile: buildTeacherProfile(currentTeacher, relevantOfferingIds, data.enrollments, indexes),
    systemStats: buildSystemStats(data),
    courseViews,
    attendanceViews,
    leaveViews,
    evaluationSummary,
    materialViews,
    profileChangeViews,
    recommendationViews,
    academicAlertViews,
    atRiskStudents,
    metrics: {
      courses: courseViews.length,
      pendingLeaves: leaveViews.filter((item) => item.status === "pending").length,
      evaluations: relevantEvaluations.length,
      attendance: attendanceViews.length,
      profileChanges: profileChangeViews.filter((item) => item.status === "pending").length,
      riskStudents: atRiskStudents.length,
    },
  };
}

function buildIndexes(data) {
  const usersById = mapById(data.users);
  const studentsById = mapById(data.students);
  const teachersById = mapById(data.teachers);
  const departmentsById = mapById(data.departments);
  const majorsById = mapById(data.majors);
  const trainingPlansById = mapById(data.trainingPlans);
  const coursesById = mapById(data.courses);
  const offeringsById = mapById(data.offerings);
  const sessionsByOfferingId = groupBy(data.classSessions, "course_offering_id");
  const interestTagsById = mapById(data.interestTags || []);

  return {
    usersById,
    studentsById,
    teachersById,
    departmentsById,
    majorsById,
    trainingPlansById,
    coursesById,
    offeringsById,
    sessionsByOfferingId,
    interestTagsById,
  };
}

function resolveRelevantOfferingIds(role, currentStudent, currentTeacher, data) {
  if (role === "admin") {
    return unique(data.offerings.map((item) => item._id));
  }

  if (role === "teacher") {
    if (!currentTeacher) {
      return [];
    }
    return unique(
      data.offerings
        .filter((item) => Array.isArray(item.teacher_ids) && item.teacher_ids.includes(currentTeacher._id))
        .map((item) => item._id),
    );
  }

  if (!currentStudent) {
    return [];
  }

  return unique(
    data.enrollments
      .filter((item) => item.student_id === currentStudent._id && item.status !== "dropped")
      .map((item) => item.course_offering_id),
  );
}

function buildCourseView(offering, indexes) {
  const course = indexes.coursesById.get(offering.course_id) || {};
  const sessions = indexes.sessionsByOfferingId.get(offering._id) || [];
  const teacherNames = (offering.teacher_ids || [])
    .map((teacherId) => {
      const teacher = indexes.teachersById.get(teacherId);
      const user = teacher ? indexes.usersById.get(teacher.user_id) : null;
      return teacher ? teacher.name || (user && user.display_name) || "" : "";
    })
    .filter(Boolean);

  return {
    _id: offering._id,
    courseOfferingId: offering._id,
    courseId: course._id || offering.course_id,
    code: course.course_code || "",
    name: course.name || "",
    credits: Number(course.credits || 0),
    courseType: course.course_type || "",
    difficultyLevel: course.difficulty_level || 0,
    semesterId: offering.semester_id || "",
    sectionNo: offering.section_no || "",
    teacherIds: offering.teacher_ids || [],
    teacherNames,
    enrolledCount: Number(offering.enrolled_count || 0),
    capacity: Number(offering.capacity || 0),
    selectionStatus: offering.selection_status || "",
    schedule: formatSchedule(sessions),
  };
}

function buildAttendanceViews(role, currentStudent, relevantOfferingIds, attendance, indexes) {
  return attendance
    .filter((item) => {
      if (role === "student") {
        return currentStudent && item.student_id === currentStudent._id;
      }
      if (role === "teacher") {
        return relevantOfferingIds.includes(item.course_offering_id);
      }
      return true;
    })
    .map((item) => {
      const student = indexes.studentsById.get(item.student_id);
      const offering = indexes.offeringsById.get(item.course_offering_id) || {};
      return {
        _id: item._id,
        studentId: item.student_id,
        courseOfferingId: item.course_offering_id,
        courseId: offering.course_id || "",
        date: item.attendance_date,
        status: item.status || "",
        source: item.source || "",
        leaveRequestId: item.leave_request_id || "",
        studentName: student ? student.name : "",
        courseName: courseNameFromOffering(item.course_offering_id, indexes),
        createdAt: Number(item.created_at || 0),
        updatedAt: Number(item.updated_at || 0),
      };
    })
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function buildLeaveViews(role, currentStudent, relevantOfferingIds, leaves, indexes) {
  return leaves
    .filter((item) => {
      if (role === "student") {
        return currentStudent && item.student_id === currentStudent._id;
      }
      if (role === "teacher") {
        return item.status === "pending" && relevantOfferingIds.includes(item.course_offering_id);
      }
      return item.status === "pending";
    })
    .map((item) => {
      const student = indexes.studentsById.get(item.student_id);
      const reviewer = indexes.usersById.get(item.reviewer_user_id);
      const offering = indexes.offeringsById.get(item.course_offering_id) || {};
      const date = item.leave_date || dateFromTimestamp(item.start_at);
      return {
        _id: item._id,
        studentId: item.student_id,
        studentName: student ? student.name : "",
        courseOfferingId: item.course_offering_id,
        courseId: offering.course_id || "",
        courseName: courseNameFromOffering(item.course_offering_id, indexes),
        leaveDate: date,
        date,
        startAt: Number(item.start_at || 0),
        endAt: Number(item.end_at || 0),
        reasonType: item.reason_type || "",
        reasonDetail: item.reason_detail || "",
        reason: item.reason_detail || "",
        status: item.status || "",
        reviewerUserId: item.reviewer_user_id || "",
        reviewerName: reviewer ? reviewer.display_name || reviewer.username : "",
        reviewComment: item.review_comment || "",
        reviewedAt: Number(item.reviewed_at || 0),
        createdAt: Number(item.created_at || 0),
        updatedAt: Number(item.updated_at || 0),
      };
    })
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function filterEvaluations(role, currentTeacher, relevantOfferingIds, evaluations) {
  return evaluations.filter((item) => {
    if (item.status === "hidden") {
      return false;
    }
    if (role === "teacher") {
      return currentTeacher && Array.isArray(item.teacher_ids) && item.teacher_ids.includes(currentTeacher._id);
    }
    if (role === "student") {
      return relevantOfferingIds.includes(item.course_offering_id);
    }
    return true;
  });
}

function buildEvaluationSummary(evaluations, indexes) {
  const groups = new Map();
  for (const item of evaluations) {
    const key = item.course_offering_id || item.course_id || item._id;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }

  return Array.from(groups.values())
    .map((items) => {
      const first = items[0];
      const average = round1(
        items.reduce((sum, item) => sum + overallScore(item), 0) / Math.max(items.length, 1),
      );
      const courseName = courseNameFromOffering(first.course_offering_id, indexes) || courseNameFromCourse(first.course_id, indexes);
      return {
        courseId: first.course_id || "",
        courseOfferingId: first.course_offering_id || "",
        courseName,
        count: items.length,
        average,
        averageRating: average.toFixed(1),
        feedback: items.map((item) => item.feedback_text).filter(Boolean),
      };
    })
    .sort((a, b) => String(a.courseName).localeCompare(String(b.courseName)));
}

function buildMaterialViews(role, relevantOfferingIds, materials, indexes) {
  return (materials || [])
    .filter((item) => relevantOfferingIds.includes(item.course_offering_id))
    .filter((item) => role !== "student" || item.is_public_to_students === true)
    .map((item) => ({
      _id: item._id,
      courseOfferingId: item.course_offering_id || "",
      courseId: (indexes.offeringsById.get(item.course_offering_id) || {}).course_id || "",
      courseName: courseNameFromOffering(item.course_offering_id, indexes),
      uploaderUserId: item.uploader_user_id || "",
      title: item.title || "",
      fileUrl: item.file_url || "",
      fileType: item.file_type || "link",
      isPublicToStudents: item.is_public_to_students === true,
      knowledgeDocumentId: item.knowledge_document_id || "",
      createdAt: Number(item.created_at || 0),
      updatedAt: Number(item.updated_at || 0),
    }))
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

function buildProfileChangeViews(session, currentStudent, currentTeacher, profileChanges, indexes) {
  return (profileChanges || [])
    .filter((item) => {
      if (session.role === "admin") {
        return item.status === "pending";
      }
      return item.requester_user_id === session.userId;
    })
    .map((item) => {
      const requester = indexes.usersById.get(item.requester_user_id) || {};
      return {
        _id: item._id,
        requesterUserId: item.requester_user_id || "",
        requesterName: requester.display_name || requester.username || "",
        targetType: item.target_type || "",
        targetId: item.target_id || "",
        changes: item.changes || {},
        status: item.status || "",
        reviewerUserId: item.reviewer_user_id || "",
        reviewComment: item.review_comment || "",
        reviewedAt: Number(item.reviewed_at || 0),
        createdAt: Number(item.created_at || 0),
        updatedAt: Number(item.updated_at || 0),
      };
    })
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function buildRecommendationViews(currentStudent, relevantOfferingIds, recommendations, evaluationSummary, data, indexes) {
  if (!currentStudent) {
    return [];
  }

  const stored = (recommendations || [])
    .filter((item) => item.student_id === currentStudent._id && item.status !== "dismissed")
    .map((item) => ({
      _id: item._id,
      courseId: item.recommended_course_id || "",
      courseOfferingId: item.recommended_offering_id || "",
      courseName:
        courseNameFromOffering(item.recommended_offering_id, indexes) ||
        courseNameFromCourse(item.recommended_course_id, indexes),
      pathName: item.path_name || "",
      score: Number(item.score || 0),
      reason: item.reason || "",
      evidence: item.evidence || {},
      status: item.status || "new",
      createdAt: Number(item.created_at || 0),
    }));

  if (stored.length) {
    return stored.sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 3);
  }

  const enrolled = new Set(relevantOfferingIds);
  const summaryByOffering = new Map(evaluationSummary.map((item) => [item.courseOfferingId, item]));
  const completedCourseIds = new Set(
    (data.grades || [])
      .filter((item) => item.student_id === currentStudent._id && item.status !== "withdrawn")
      .map((item) => item.course_id),
  );

  return (data.offerings || [])
    .filter((offering) => !enrolled.has(offering._id))
    .map((offering) => {
      const course = indexes.coursesById.get(offering.course_id) || {};
      const summary = summaryByOffering.get(offering._id) || {};
      const evaluationAverage = Number(summary.average || 0);
      const score = Math.round(40 + evaluationAverage * 10 + (completedCourseIds.size ? 10 : 0));
      return {
        _id: `generated_${currentStudent._id}_${offering._id}`,
        courseId: course._id || offering.course_id,
        courseOfferingId: offering._id,
        courseName: courseNameFromCourse(offering.course_id, indexes),
        pathName: String(course.name || "").toLowerCase().includes("data")
          ? "Data Analysis Direction"
          : "Software Engineering Direction",
        score,
        reason: [
          evaluationAverage ? `evaluation average ${evaluationAverage}/5` : "no evaluation average yet",
          completedCourseIds.size ? "completed-course history available" : "foundation courses still sparse",
          `difficulty ${course.difficulty_level || "unknown"}`,
        ].join("; "),
        evidence: {
          completedCourseIds: Array.from(completedCourseIds),
          evaluationAverage,
          difficultyLevel: course.difficulty_level || 0,
        },
        status: "new",
      };
    })
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 3);
}

function buildAcademicAlertViews(currentStudent, storedAlerts, attendanceViews) {
  if (!currentStudent) {
    return [];
  }

  const alerts = (storedAlerts || [])
    .filter((item) => item.student_id === currentStudent._id && item.status !== "resolved" && item.status !== "ignored")
    .map((item) => ({
      _id: item._id,
      studentId: item.student_id || "",
      courseOfferingId: item.course_offering_id || "",
      alertType: item.alert_type || "",
      severity: item.severity || "",
      triggerRule: item.trigger_rule || {},
      message: item.message || "",
      status: item.status || "open",
      createdAt: Number(item.created_at || 0),
    }));

  const absenceCount = attendanceViews.filter((item) => item.studentId === currentStudent._id && item.status === "absent").length;
  if (absenceCount >= 3 && !alerts.some((item) => item.alertType === "absence")) {
    alerts.push({
      _id: `generated_absence_${currentStudent._id}`,
      studentId: currentStudent._id,
      alertType: "absence",
      severity: absenceCount >= 5 ? "critical" : "high",
      triggerRule: { absentGreaterOrEqual: 3 },
      message: `${absenceCount} absence records detected.`,
      status: "open",
      createdAt: Date.now(),
    });
  }

  return alerts;
}

function buildAtRiskStudents(attendanceViews) {
  const grouped = new Map();
  for (const item of attendanceViews || []) {
    if (item.status !== "absent") {
      continue;
    }
    if (!grouped.has(item.studentId)) {
      grouped.set(item.studentId, { absenceCount: 0, courseIds: new Set(), studentName: item.studentName || item.studentId });
    }
    const row = grouped.get(item.studentId);
    row.absenceCount += 1;
    row.courseIds.add(item.courseOfferingId);
  }
  return Array.from(grouped.entries())
    .filter(([, item]) => item.absenceCount >= 3)
    .map(([studentId, item]) => ({
      studentId,
      studentName: item.studentName,
      absenceCount: item.absenceCount,
      courseCount: item.courseIds.size,
      severity: item.absenceCount >= 5 ? "critical" : "high",
    }));
}

function buildStudentProfile(student, grades, studentInterestTags, indexes) {
  if (!student) {
    return {
      major: "",
      gpa: "0.0",
      creditsEarned: 0,
      totalCredits: 0,
      enrollmentYear: "",
      contact: {},
      familyInfo: {},
      moduleCredits: {},
      interestTags: [],
    };
  }

  const studentGrades = grades.filter((item) => item.student_id === student._id && item.status !== "withdrawn");
  const creditsEarned = studentGrades.reduce((sum, item) => sum + Number(item.credits_earned || 0), 0);
  const weightedCredits = studentGrades.reduce((sum, item) => sum + Number(item.gpa_point || 0) * Number(item.credits_earned || 0), 0);
  const gpa = creditsEarned ? round1(weightedCredits / creditsEarned).toFixed(1) : "0.0";
  const trainingPlan = indexes.trainingPlansById.get(student.training_plan_id) || {};
  const major = indexes.majorsById.get(student.major_id) || {};
  const interestTags = (studentInterestTags || [])
    .filter((item) => item.student_id === student._id)
    .map((item) => {
      const tag = indexes.interestTagsById.get(item.tag_id);
      return tag ? tag.name || tag.code || "" : "";
    })
    .filter(Boolean);

  return {
    studentId: student._id,
    studentNo: student.student_no || "",
    name: student.name || "",
    gender: student.gender || "",
    major: major.name || "",
    adminClassId: student.admin_class_id || "",
    gpa,
    creditsEarned,
    totalCredits: Number(trainingPlan.total_required_credits || 0),
    enrollmentYear: student.enrollment_year || "",
    contact: student.contact || {},
    familyInfo: student.family_info || {},
    moduleCredits: buildModuleCredits(studentGrades, trainingPlan),
    gpaTrend: buildGpaTrend(studentGrades),
    percentileRank: Number(student.percentile_rank || 0),
    interestTags,
  };
}

function buildModuleCredits(studentGrades, trainingPlan) {
  const totalCredits = Number(trainingPlan.total_required_credits || 0);
  const earned = studentGrades.reduce((sum, item) => sum + Number(item.credits_earned || 0), 0);
  return {
    general: {
      current: Math.round(earned * 0.25),
      total: Math.round(totalCredits * 0.25),
    },
    majorRequired: {
      current: Math.round(earned * 0.45),
      total: Math.round(totalCredits * 0.45),
    },
    majorElective: {
      current: Math.round(earned * 0.2),
      total: Math.round(totalCredits * 0.2),
    },
    practice: {
      current: Math.max(0, earned - Math.round(earned * 0.9)),
      total: Math.max(0, totalCredits - Math.round(totalCredits * 0.9)),
    },
  };
}

function buildGpaTrend(studentGrades) {
  const sorted = studentGrades
    .slice()
    .sort((a, b) => String(a.term_code || a.semester_id || "").localeCompare(String(b.term_code || b.semester_id || "")));
  if (!sorted.length) {
    return [];
  }

  let credits = 0;
  let weighted = 0;
  return sorted.map((item, index) => {
    const earned = Number(item.credits_earned || 0);
    credits += earned;
    weighted += Number(item.gpa_point || 0) * earned;
    return {
      term: item.term_code || item.semester_id || `Term ${index + 1}`,
      gpa: credits ? round1(weighted / credits) : 0,
    };
  });
}

function buildTeacherProfile(teacher, relevantOfferingIds, enrollments, indexes) {
  if (!teacher) {
    return {
      department: "",
      title: "",
      studentCount: 0,
    };
  }

  const department = indexes.departmentsById.get(teacher.department_id) || {};
  const studentIds = unique(
    enrollments
      .filter((item) => relevantOfferingIds.includes(item.course_offering_id) && item.status !== "dropped")
      .map((item) => item.student_id),
  );

  return {
    teacherId: teacher._id,
    teacherNo: teacher.teacher_no || "",
    name: teacher.name || "",
    department: department.name || "",
    title: teacher.title || "",
    office: teacher.office || "",
    researchFields: Array.isArray(teacher.research_fields) ? teacher.research_fields : [],
    teachingExperience: teacher.teaching_experience || "",
    publicProfile: teacher.public_profile || {},
    studentCount: studentIds.length,
  };
}

function buildSystemStats(data) {
  return {
    totalStudents: data.students.length,
    totalTeachers: data.teachers.length,
    activeCourses: data.courses.filter((item) => item.status !== "archived").length,
    activeOfferings: data.offerings.filter((item) => item.selection_status !== "cancelled").length,
  };
}

function courseNameFromOffering(offeringId, indexes) {
  const offering = indexes.offeringsById.get(offeringId);
  if (!offering) {
    return "";
  }
  return courseNameFromCourse(offering.course_id, indexes);
}

function courseNameFromCourse(courseId, indexes) {
  const course = indexes.coursesById.get(courseId);
  if (!course) {
    return "";
  }
  return [course.course_code, course.name].filter(Boolean).join(" ").trim();
}

function formatSchedule(sessions) {
  return sessions
    .slice()
    .sort((a, b) => Number(a.weekday || 0) - Number(b.weekday || 0))
    .map((item) => {
      const day = item.weekday ? `Weekday ${item.weekday}` : "";
      const time = [item.start_time, item.end_time].filter(Boolean).join("-");
      const date = item.session_date || "";
      return [date, day, time].filter(Boolean).join(" ");
    })
    .join("; ");
}

function overallScore(item) {
  const scores = item.scores && typeof item.scores === "object" ? item.scores : {};
  return Number(scores.overall || item.rating || 0);
}

function dateFromTimestamp(value) {
  const timestamp = Number(value || 0);
  if (!timestamp) {
    return "";
  }
  return new Date(timestamp).toISOString().slice(0, 10);
}

function mapById(items) {
  return new Map(items.filter((item) => item && item._id).map((item) => [item._id, item]));
}

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items) {
    const value = item[key];
    if (!grouped.has(value)) {
      grouped.set(value, []);
    }
    grouped.get(value).push(item);
  }
  return grouped;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function round1(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 10) / 10;
}
