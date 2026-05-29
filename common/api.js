const CACHE_TTL_MS = {
  "get-dashboard-data": 30000,
  "get-admin-management-data": 30000,
  "get-evaluation-summary": 60000,
  "get-course-materials": 60000,
  "get-ai-history": 30000,
};

const WRITE_FUNCTIONS = new Set([
  "submit-leave",
  "review-leave",
  "cancel-leave",
  "submit-evaluation",
  "save-course-material",
  "save-admin-account",
  "save-admin-course",
  "submit-profile-change",
  "review-profile-change",
  "submit-attendance-checkin",
  "ask-assistant",
]);

const responseCache = new Map();
const inFlightReads = new Map();
const AI_HISTORY_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

const fallbackState = {
  users: [
    {
      _id: "u_student_001",
      username: "student001",
      password: "demo123",
      role: "student",
      displayName: "Alice Chen",
      email: "alice.chen@ai-ems.demo",
      phone: "13700001001",
      major: "Software Engineering",
    },
    {
      _id: "u_student_002",
      username: "student002",
      password: "demo123",
      role: "student",
      displayName: "Ben Zhang",
      email: "ben.zhang@ai-ems.demo",
      phone: "13700001002",
      major: "Software Engineering",
    },
    {
      _id: "u_teacher_001",
      username: "teacher001",
      password: "demo123",
      role: "teacher",
      displayName: "Dr. Zhang",
      email: "teacher001@ai-ems.demo",
      phone: "13900001001",
      department: "Computer Science",
    },
    {
      _id: "u_admin_001",
      username: "admin001",
      password: "demo123",
      role: "admin",
      displayName: "Academic Admin",
      email: "admin001@ai-ems.demo",
      phone: "13800000001",
      department: "Academic Office",
    },
  ],
  students: [
    {
      _id: "stu_001",
      userId: "u_student_001",
      studentNo: "S2026001",
      name: "Alice Chen",
      gender: "Female",
      major: "Software Engineering",
      adminClass: "SE 2026-1",
      enrollmentYear: 2024,
      contact: {
        email: "alice.chen@ai-ems.demo",
        phone: "13700001001",
        address: "Student Apartment A-501",
      },
      familyInfo: {
        guardianName: "Mary Chen",
        guardianPhone: "13600001001",
      },
      interestTags: ["Data Analysis", "Software Engineering"],
      totalCredits: 120,
      creditsEarned: 72,
      moduleCredits: {
        general: { current: 22, total: 30 },
        majorRequired: { current: 32, total: 45 },
        majorElective: { current: 12, total: 30 },
        practice: { current: 6, total: 15 },
      },
      grades: [
        { courseId: "c_programming", score: 88, credits: 15, gpaPoint: 3.7 },
        { courseId: "c_database", score: 84, credits: 12, gpaPoint: 3.5 },
        { courseId: "c_software_design", score: 91, credits: 15, gpaPoint: 3.9 },
      ],
      gpaTrend: [
        { term: "2025 Fall", gpa: 3.4 },
        { term: "2026 Spring", gpa: 3.7 },
      ],
      percentileRank: 82,
      gpa: "3.7",
    },
    {
      _id: "stu_002",
      userId: "u_student_002",
      studentNo: "S2026002",
      name: "Ben Zhang",
      gender: "Male",
      major: "Software Engineering",
      adminClass: "SE 2026-1",
      enrollmentYear: 2024,
      contact: {
        email: "ben.zhang@ai-ems.demo",
        phone: "13700001002",
        address: "Student Apartment B-406",
      },
      familyInfo: {
        guardianName: "Wei Zhang",
        guardianPhone: "13600001002",
      },
      interestTags: ["Artificial Intelligence"],
      totalCredits: 120,
      creditsEarned: 44,
      moduleCredits: {
        general: { current: 14, total: 30 },
        majorRequired: { current: 20, total: 45 },
        majorElective: { current: 6, total: 30 },
        practice: { current: 4, total: 15 },
      },
      grades: [
        { courseId: "c_programming", score: 62, credits: 15, gpaPoint: 1.9 },
        { courseId: "c_database", score: 58, credits: 0, gpaPoint: 0 },
      ],
      gpaTrend: [
        { term: "2025 Fall", gpa: 2.6 },
        { term: "2026 Spring", gpa: 2.1 },
      ],
      percentileRank: 31,
      gpa: "2.1",
    },
  ],
  teachers: [
    {
      _id: "tea_001",
      userId: "u_teacher_001",
      teacherNo: "T1001",
      name: "Dr. Zhang",
      department: "Computer Science",
      title: "Associate Professor",
      office: "Teaching Building 3-502",
      researchFields: ["Software Engineering", "Learning Analytics"],
      teachingExperience:
        "Ten years of software engineering teaching and capstone mentoring.",
      publicProfile: {
        officeHours: "Tue 14:00-16:00",
        homepage: "https://ai-ems.demo/teachers/zhang",
      },
    },
  ],
  courses: [
    {
      _id: "c_software_design",
      courseOfferingId: "co_software_design",
      courseId: "c_software_design",
      code: "JC3506",
      name: "Software Design and Implementation",
      teacherId: "u_teacher_001",
      teacherIds: ["tea_001"],
      teacherNames: ["Dr. Zhang"],
      schedule: "Mon 10:00-12:00",
      credits: 15,
      courseType: "major_required",
      difficultyLevel: 3,
      capacity: 50,
      enrolledCount: 32,
      classroom: {
        name: "A101",
        latitude: 31.230416,
        longitude: 121.473701,
        radius: 50,
      },
      keywords: ["software", "project", "engineering", "软件工程"],
    },
    {
      _id: "c_process_management",
      courseOfferingId: "co_process_management",
      courseId: "c_process_management",
      code: "PM3506",
      name: "Software Process Management",
      teacherId: "u_teacher_001",
      teacherIds: ["tea_001"],
      teacherNames: ["Dr. Zhang"],
      schedule: "Wed 14:00-16:00",
      credits: 15,
      courseType: "major_elective",
      difficultyLevel: 2,
      capacity: 45,
      enrolledCount: 28,
      classroom: {
        name: "A103",
        latitude: 31.230416,
        longitude: 121.473701,
        radius: 50,
      },
      keywords: ["process", "scrum", "project management", "软件过程"],
    },
    {
      _id: "c_data_analysis",
      courseOfferingId: "co_data_analysis",
      courseId: "c_data_analysis",
      code: "DA3506",
      name: "Educational Data Analysis",
      teacherId: "u_teacher_001",
      teacherIds: ["tea_001"],
      teacherNames: ["Dr. Zhang"],
      schedule: "Fri 09:00-11:00",
      credits: 12,
      courseType: "major_elective",
      difficultyLevel: 3,
      capacity: 40,
      enrolledCount: 22,
      classroom: {
        name: "B208",
        latitude: 31.230416,
        longitude: 121.473701,
        radius: 50,
      },
      keywords: ["data", "analysis", "analytics", "数据分析"],
    },
  ],
  enrollments: [
    { studentId: "u_student_001", courseOfferingId: "co_software_design", status: "enrolled" },
    { studentId: "u_student_001", courseOfferingId: "co_process_management", status: "enrolled" },
    { studentId: "u_student_002", courseOfferingId: "co_software_design", status: "enrolled" },
    { studentId: "u_student_002", courseOfferingId: "co_process_management", status: "enrolled" },
  ],
  attendance: [
    {
      _id: "a_001",
      studentId: "u_student_001",
      student_id: "u_student_001",
      studentName: "Alice Chen",
      courseOfferingId: "co_software_design",
      course_offering_id: "co_software_design",
      classSessionId: "cs_001",
      class_session_id: "cs_001",
      attendanceDate: "2026-05-25",
      attendance_date: "2026-05-25",
      date: "2026-05-25",
      status: "absent",
      source: "location",
      createdAt: 1,
      created_at: 1,
      updatedAt: 1,
      updated_at: 1,
    },
    {
      _id: "a_002",
      studentId: "u_student_001",
      student_id: "u_student_001",
      studentName: "Alice Chen",
      courseOfferingId: "co_process_management",
      course_offering_id: "co_process_management",
      classSessionId: "cs_002",
      class_session_id: "cs_002",
      attendanceDate: "2026-05-27",
      attendance_date: "2026-05-27",
      date: "2026-05-27",
      status: "present",
      source: "location",
      createdAt: 1,
      created_at: 1,
      updatedAt: 1,
      updated_at: 1,
    },
    ...["2026-05-18", "2026-05-20", "2026-05-25"].map((date, index) => ({
      _id: `a_risk_${index + 1}`,
      studentId: "u_student_002",
      student_id: "u_student_002",
      studentName: "Ben Zhang",
      courseOfferingId: index === 1 ? "co_process_management" : "co_software_design",
      course_offering_id: index === 1 ? "co_process_management" : "co_software_design",
      classSessionId: `cs_risk_${index + 1}`,
      class_session_id: `cs_risk_${index + 1}`,
      attendanceDate: date,
      attendance_date: date,
      date,
      status: "absent",
      source: "system_import",
      createdAt: index + 2,
      created_at: index + 2,
      updatedAt: index + 2,
      updated_at: index + 2,
    })),
  ],
  leaves: [],
  leaveRequestSessions: [],
  auditLogs: [],
  evaluations: [
    {
      _id: "e_001",
      courseId: "c_software_design",
      courseOfferingId: "co_software_design",
      teacherIds: ["tea_001"],
      tokenHash: "anon-demo-1",
      rating: 5,
      scores: {
        content: 5,
        teaching_method: 5,
        difficulty: 3,
        workload: 4,
        achievement: 5,
        overall: 5,
      },
      feedback:
        "The course is practical and useful for project architecture, but it expects basic programming experience.",
      submittedAt: 1779595200000,
      status: "submitted",
    },
    {
      _id: "e_002",
      courseId: "c_data_analysis",
      courseOfferingId: "co_data_analysis",
      teacherIds: ["tea_001"],
      tokenHash: "anon-demo-2",
      rating: 4,
      scores: {
        content: 5,
        teaching_method: 4,
        difficulty: 3,
        workload: 3,
        achievement: 4,
        overall: 4,
      },
      feedback:
        "Good fit for students interested in data analysis and learning analytics.",
      submittedAt: 1779596200000,
      status: "submitted",
    },
  ],
  materials: [
    {
      _id: "mat_001",
      courseOfferingId: "co_software_design",
      uploaderUserId: "u_teacher_001",
      title: "Syllabus and Project Rubric",
      fileUrl: "https://example.com/ai-ems/software-design-syllabus.pdf",
      fileType: "document",
      isPublicToStudents: true,
      knowledgeDocumentId: "kb_syllabus_software_design",
      createdAt: 1779595200000,
      updatedAt: 1779595200000,
    },
  ],
  profileChangeRequests: [
    {
      _id: "pcr_demo_001",
      requesterUserId: "u_student_001",
      requesterName: "Alice Chen",
      targetType: "student",
      targetId: "stu_001",
      changes: {
        "contact.phone": {
          oldValue: "13700001001",
          newValue: "13700009999",
          label: "Phone",
        },
      },
      status: "pending",
      reviewerUserId: "",
      reviewComment: "",
      reviewedAt: 0,
      createdAt: 1779598000000,
      updatedAt: 1779598000000,
    },
  ],
  knowledge: [
    {
      _id: "kb_graduation",
      title: "Graduation credit requirement",
      keywords: ["graduation", "credit", "credits", "学分", "毕业"],
      answer:
        "Students should track total credits, module credits, GPA trend, and remaining required courses before graduation. This demo dashboard shows those progress indicators and recommended elective paths.",
      category: "policy",
    },
    {
      _id: "kb_leave",
      title: "Leave approval workflow",
      keywords: ["leave", "absence", "请假", "缺勤", "attendance", "on leave"],
      answer:
        "Students submit a leave request for a specific course session. After approval by an authorised teacher or administrator, the attendance record for that date is updated to on_leave. Cancelling an approved leave restores the previous attendance status.",
      category: "policy",
    },
    {
      _id: "kb_evaluation",
      title: "Anonymous course evaluation",
      keywords: ["evaluation", "feedback", "anonymous", "评价", "匿名", "course selection"],
      answer:
        "Course evaluations are aggregated before teachers and administrators see them. The assistant can use anonymous course feedback to support course-selection questions without exposing student identity.",
      category: "course",
    },
  ],
  aiConversations: [
    {
      _id: "ai_conv_demo_student",
      userId: "u_student_001",
      title: "Graduation credit requirement",
      scenario: "graduation_check",
      contextSummary: "What should I check before graduation?",
      messageCount: 2,
      status: "active",
      createdAt: 1779595200000,
      updatedAt: 1779595300000,
    },
  ],
  aiMessages: [
    {
      _id: "ai_msg_demo_001",
      conversationId: "ai_conv_demo_student",
      role: "user",
      content: "What should I check before graduation?",
      fallbackUsed: false,
      latencyMs: 0,
      createdAt: 1779595200000,
    },
    {
      _id: "ai_msg_demo_002",
      conversationId: "ai_conv_demo_student",
      role: "assistant",
      content:
        "Students should track total credits, module credits, GPA trend, and remaining required courses before graduation.",
      model: "local-keyword-kb",
      citations: [{ knowledgeBaseId: "kb_graduation", title: "Graduation credit requirement" }],
      fallbackUsed: false,
      latencyMs: 25,
      createdAt: 1779595300000,
    },
  ],
};

export async function callAiemsFunction(name, data = {}, options = {}) {
  const request = stripClientOnlyFields(data);
  const forceRefresh = Boolean(options.forceRefresh || data.forceRefresh || data.__forceRefresh);
  const cacheKey = buildCacheKey(name, request);
  const ttl = CACHE_TTL_MS[name] || 0;

  if (ttl && !forceRefresh) {
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < ttl) {
      return clone(cached.result);
    }
    if (inFlightReads.has(cacheKey)) {
      return clone(await inFlightReads.get(cacheKey));
    }
  }

  const runner = runFunction(name, request).then((result) => {
    const normalized = normalizeResult(result);
    if (normalized.ok && ttl) {
      responseCache.set(cacheKey, {
        createdAt: Date.now(),
        result: clone(normalized),
      });
    }
    if (normalized.ok && WRITE_FUNCTIONS.has(name)) {
      invalidateAiemsCache();
    }
    return normalized;
  });

  if (ttl) {
    inFlightReads.set(cacheKey, runner);
  }

  try {
    return clone(await runner);
  } finally {
    if (ttl) {
      inFlightReads.delete(cacheKey);
    }
  }
}

export function invalidateAiemsCache() {
  responseCache.clear();
  inFlightReads.clear();
}

export function getFallbackCourses() {
  return fallbackState.courses.map(clone);
}

async function runFunction(name, data) {
  if (typeof uniCloud === "undefined") {
    return fallbackResult(name, data);
  }

  try {
    const response = await uniCloud.callFunction({ name, data });
    return response.result || response;
  } catch (error) {
    console.warn(`[AI-EMS] Cloud function ${name} failed, using local fallback.`, error);
    return fallbackResult(name, data);
  }
}

function fallbackResult(name, data = {}) {
  const session = data.session || {};

  if (name === "auth-login") {
    return loginFallback(data);
  }

  if (name === "get-dashboard-data") {
    return dashboardFallback(session);
  }

  if (name === "get-admin-management-data") {
    return getAdminManagementDataFallback(session);
  }

  if (name === "submit-leave") {
    return submitLeaveFallback(session, data);
  }

  if (name === "review-leave") {
    return reviewLeaveFallback(session, data);
  }

  if (name === "cancel-leave") {
    return cancelLeaveFallback(session, data);
  }

  if (name === "submit-attendance-checkin") {
    return submitAttendanceCheckinFallback(session, data);
  }

  if (name === "submit-evaluation") {
    return submitEvaluationFallback(session, data);
  }

  if (name === "get-evaluation-summary") {
    return { ok: true, data: buildEvaluationSummary(session), summary: buildEvaluationSummary(session) };
  }

  if (name === "get-course-materials") {
    return getCourseMaterialsFallback(session);
  }

  if (name === "save-course-material") {
    return saveCourseMaterialFallback(session, data);
  }

  if (name === "save-admin-account") {
    return saveAdminAccountFallback(session, data);
  }

  if (name === "save-admin-course") {
    return saveAdminCourseFallback(session, data);
  }

  if (name === "get-ai-history") {
    return getAiHistoryFallback(session, data);
  }

  if (name === "submit-profile-change") {
    return submitProfileChangeFallback(session, data);
  }

  if (name === "review-profile-change") {
    return reviewProfileChangeFallback(session, data);
  }

  if (name === "ask-assistant") {
    return askAssistantFallback(session, data);
  }

  return { ok: false, message: `No fallback for ${name}.` };
}

function loginFallback(data) {
  const user = fallbackState.users.find(
    (item) => item.username === data.username && item.password === data.password,
  );
  if (!user || (user.status && user.status !== "active")) {
    return { ok: false, message: "Invalid demo account or password." };
  }
  recordAudit("login", user._id, "users", user._id, null, null);
  return {
    ok: true,
    user: {
      userId: user._id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      email: user.email || "",
      phone: user.phone || "",
    },
  };
}

function dashboardFallback(session) {
  if (!session.userId || !["student", "teacher", "admin"].includes(session.role)) {
    return { ok: false, message: "Login is required." };
  }

  const courses = resolveCoursesForSession(session);
  const attendance = resolveAttendanceForSession(session);
  const leaveRequests = resolveLeavesForSession(session);
  const profileChangeRequests = resolveProfileChangeRequests(session);
  const evaluationSummary = buildEvaluationSummary(session);
  const atRiskStudents = buildAtRiskStudents();
  const profile = buildStudentProfile(session);
  const teacherProfile = buildTeacherProfile(session);

  return {
    ok: true,
    data: {
      user: session,
      profile,
      teacherProfile,
      systemStats: {
        totalStudents: fallbackState.students.length,
        totalTeachers: fallbackState.teachers.length,
        activeCourses: fallbackState.courses.length,
        activeOfferings: fallbackState.courses.length,
      },
      courses,
      attendance,
      leaveRequests,
      evaluationSummary,
      materials: resolveMaterialsForSession(session).slice(0, 3),
      profileChangeRequests,
      recommendations: session.role === "student" ? buildRecommendations(session) : [],
      academicAlerts: session.role === "student" ? buildAcademicAlertsForStudent(session.userId) : [],
      atRiskStudents,
      metrics: {
        courses: courses.length,
        pendingLeaves: leaveRequests.filter((item) => item.status === "pending").length,
        evaluations: evaluationSummary.reduce((sum, item) => sum + item.count, 0),
        attendance: attendance.length,
        profileChanges: profileChangeRequests.filter((item) => item.status === "pending").length,
        riskStudents: atRiskStudents.length,
      },
      meta: {
        source: "local-fallback",
        cacheTtlMs: CACHE_TTL_MS["get-dashboard-data"],
        generatedAt: Date.now(),
      },
    },
  };
}

function submitLeaveFallback(session, data) {
  if (session.role !== "student") {
    return { ok: false, message: "Only students can submit leave requests." };
  }

  const courseOfferingId = String(data.courseOfferingId || data.courseId || "").trim();
  const leaveDate = String(data.leaveDate || data.date || "").trim();
  const reasonType = normalizeReasonType(data.reasonType);
  const reasonDetail = String(data.reasonDetail || data.reason || "").trim();

  if (!courseOfferingId || !leaveDate || !reasonDetail) {
    return { ok: false, message: "Course, leave date, and reason are required." };
  }

  const course = findCourse(courseOfferingId);
  if (!course || !canStudentAccessCourse(session.userId, courseOfferingId)) {
    return { ok: false, message: "You are not enrolled in this course offering." };
  }

  let range = null;
  try {
    range = buildLeaveRange(leaveDate);
  } catch (error) {
    return { ok: false, message: error.message || "Invalid leave date." };
  }

  const now = Date.now();
  const leave = normalizeLeaveView({
    _id: `leave_${now}`,
    studentId: session.userId,
    student_id: session.userId,
    studentName: session.displayName,
    student_name: session.displayName,
    courseOfferingId,
    course_offering_id: courseOfferingId,
    courseId: course.courseId || course._id,
    course_id: course.courseId || course._id,
    courseName: buildCourseName(course, courseOfferingId),
    course_name: buildCourseName(course, courseOfferingId),
    leaveDate,
    leave_date: leaveDate,
    date: leaveDate,
    reasonType,
    reason_type: reasonType,
    reasonDetail,
    reason_detail: reasonDetail,
    reason: reasonDetail,
    startAt: range.startAt,
    start_at: range.startAt,
    endAt: range.endAt,
    end_at: range.endAt,
    status: "pending",
    reviewerUserId: "",
    reviewer_user_id: "",
    reviewerName: "",
    reviewer_name: "",
    reviewComment: "",
    review_comment: "",
    reviewedAt: 0,
    reviewed_at: 0,
    createdAt: now,
    created_at: now,
    updatedAt: now,
    updated_at: now,
  });

  fallbackState.leaves.unshift(clone(leave));
  recordAudit("leave.submit", session.userId, "leave_requests", leave._id, null, leave);
  return { ok: true, leave };
}

function reviewLeaveFallback(session, data) {
  if (!["teacher", "admin"].includes(session.role)) {
    return { ok: false, message: "Only teachers or administrators can review leave requests." };
  }

  const decision = String(data.decision || "").trim();
  if (!["approved", "rejected"].includes(decision)) {
    return { ok: false, message: 'Decision must be "approved" or "rejected".' };
  }

  const leave = fallbackState.leaves.find((item) => item._id === data.leaveId);
  if (!leave) {
    return { ok: false, message: "Leave request not found." };
  }

  if (leave.status !== "pending") {
    return { ok: false, message: "Leave request has already been processed." };
  }

  if (session.role === "teacher" && !canTeacherAccessCourse(session.userId, leave.courseOfferingId)) {
    return { ok: false, message: "You do not have permission to review this leave request." };
  }

  const now = Date.now();
  const before = clone(leave);
  leave.status = decision;
  leave.reviewerUserId = session.userId;
  leave.reviewer_user_id = session.userId;
  leave.reviewerName = session.displayName || "";
  leave.reviewer_name = session.displayName || "";
  leave.reviewComment = String(data.reviewComment || data.comment || "").trim();
  leave.review_comment = leave.reviewComment;
  leave.reviewedAt = now;
  leave.reviewed_at = now;
  leave.updatedAt = now;
  leave.updated_at = now;

  let sync = null;
  if (decision === "approved") {
    sync = syncAttendanceFallback(leave, now);
  }

  recordAudit("leave.review", session.userId, "leave_requests", leave._id, before, leave);
  return { ok: true, leave: clone(leave), sync };
}

function cancelLeaveFallback(session, data) {
  if (session.role !== "student") {
    return { ok: false, message: "Only students can cancel their leave requests." };
  }

  const leave = fallbackState.leaves.find((item) => item._id === data.leaveId);
  if (!leave) {
    return { ok: false, message: "Leave request not found." };
  }

  if (leave.studentId !== session.userId) {
    return { ok: false, message: "You can only cancel your own leave request." };
  }

  if (leave.status === "cancelled") {
    return { ok: true, leave: clone(leave) };
  }

  if (!["pending", "approved"].includes(leave.status)) {
    return { ok: false, message: "This leave request can no longer be cancelled." };
  }

  const now = Date.now();
  const before = clone(leave);
  leave.status = "cancelled";
  leave.updatedAt = now;
  leave.updated_at = now;

  let restore = null;
  if (before.status === "approved") {
    restore = restoreAttendanceFallback(leave, now);
  }

  recordAudit("leave.cancel", session.userId, "leave_requests", leave._id, before, leave);
  return { ok: true, leave: clone(leave), restore };
}

function submitAttendanceCheckinFallback(session, data) {
  if (session.role !== "student") {
    return { ok: false, message: "Only students can check in." };
  }

  const courseOfferingId = String(data.courseOfferingId || data.courseId || "").trim();
  const course = findCourse(courseOfferingId);
  if (!course || !canStudentAccessCourse(session.userId, courseOfferingId)) {
    return { ok: false, message: "You are not enrolled in this course offering." };
  }

  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, message: "Location coordinates are required for check-in." };
  }

  const classroom = course.classroom || {};
  const distance = distanceMeters(latitude, longitude, classroom.latitude, classroom.longitude);
  const radius = Number(classroom.radius || 50);
  const now = Date.now();
  const date = String(data.attendanceDate || data.date || new Date(now).toISOString().slice(0, 10));
  const status = distance <= radius ? "present" : "absent";
  const existing = fallbackState.attendance.find(
    (item) =>
      item.studentId === session.userId &&
      item.courseOfferingId === courseOfferingId &&
      item.date === date,
  );
  const record = existing || {
    _id: `att_${now}`,
    studentId: session.userId,
    student_id: session.userId,
    studentName: session.displayName,
    courseOfferingId,
    course_offering_id: courseOfferingId,
    classSessionId: `${courseOfferingId}_${date}`,
    class_session_id: `${courseOfferingId}_${date}`,
    attendanceDate: date,
    attendance_date: date,
    date,
    createdAt: now,
    created_at: now,
  };

  Object.assign(record, {
    status,
    source: "location",
    checkinAt: now,
    checkin_at: now,
    checkinLatitude: latitude,
    checkin_latitude: latitude,
    checkinLongitude: longitude,
    checkin_longitude: longitude,
    distanceToClassroomM: Math.round(distance),
    distance_to_classroom_m: Math.round(distance),
    updatedAt: now,
    updated_at: now,
  });

  if (!existing) {
    fallbackState.attendance.unshift(record);
  }

  recordAudit("attendance.checkin", session.userId, "attendance_records", record._id, existing, record);
  return {
    ok: true,
    data: {
      attendance: normalizeAttendanceView(record),
      withinGeofence: status === "present",
      distanceMeters: Math.round(distance),
      radiusMeters: radius,
    },
  };
}

function submitEvaluationFallback(session, data) {
  if (session.role !== "student") {
    return { ok: false, code: 403, message: "Only students can submit course evaluations.", data: null };
  }

  const courseOfferingId = String(data.courseOfferingId || data.courseId || "").trim();
  const course = findCourse(courseOfferingId);
  const feedback = String(data.feedbackText || data.feedback_text || data.feedback || "").trim();
  const rating = Number(data.rating || (data.scores && data.scores.overall));

  if (!course || !canStudentAccessCourse(session.userId, courseOfferingId)) {
    return { ok: false, message: "You are not enrolled in this course offering." };
  }
  if (!feedback || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { ok: false, message: "Valid course, rating and feedback are required." };
  }

  const tokenHash = hashString(`${session.userId}:${courseOfferingId}`);
  if (fallbackState.evaluations.some((item) => item.tokenHash === tokenHash)) {
    return { ok: false, message: "You have already submitted an evaluation for this course." };
  }

  const now = Date.now();
  const scores = buildScores({ rating, scores: data.scores });
  const evaluation = {
    _id: `eval_${now}`,
    courseId: course.courseId || course._id,
    courseOfferingId,
    teacherIds: course.teacherIds || [],
    tokenHash,
    rating,
    scores,
    feedback,
    feedbackText: feedback,
    submittedAt: now,
    status: "submitted",
  };

  fallbackState.evaluations.unshift(evaluation);
  syncEvaluationKnowledgeFallback(course, evaluation);
  recordAudit("submit_evaluation", session.userId, "course_evaluations", evaluation._id, null, evaluation);

  return {
    ok: true,
    code: 200,
    message: "Evaluation submitted successfully.",
    data: { evaluation: clone(evaluation) },
    evaluation: clone(evaluation),
  };
}

function getCourseMaterialsFallback(session) {
  if (!session.userId || !["student", "teacher", "admin"].includes(session.role)) {
    return { ok: false, message: "Login is required." };
  }
  return {
    ok: true,
    data: {
      courses: resolveCoursesForSession(session),
      materials: resolveMaterialsForSession(session),
    },
  };
}

function saveCourseMaterialFallback(session, data) {
  if (!["teacher", "admin"].includes(session.role)) {
    return { ok: false, message: "Only teachers or administrators can save course materials." };
  }

  const courseOfferingId = String(data.courseOfferingId || "").trim();
  const title = String(data.title || "").trim();
  const fileUrl = String(data.fileUrl || "").trim();
  if (!courseOfferingId || !title || !fileUrl) {
    return { ok: false, message: "Course, title, and file URL are required." };
  }
  if (session.role === "teacher" && !canTeacherAccessCourse(session.userId, courseOfferingId)) {
    return { ok: false, message: "You do not have permission to manage this course offering." };
  }

  const now = Date.now();
  const before = fallbackState.materials.find((item) => item._id === data.materialId) || null;
  const material = before || { _id: `mat_${now}`, createdAt: now };
  Object.assign(material, {
    courseOfferingId,
    uploaderUserId: session.userId,
    title,
    fileUrl,
    fileType: String(data.fileType || "link").trim(),
    isPublicToStudents: data.isPublicToStudents !== false,
    knowledgeDocumentId: String(data.knowledgeDocumentId || "").trim(),
    updatedAt: now,
  });
  if (!before) {
    fallbackState.materials.unshift(material);
  }
  recordAudit(
    before ? "course_material.update" : "course_material.create",
    session.userId,
    "course_materials",
    material._id,
    before,
    material,
  );
  return { ok: true, data: { material: buildMaterialView(material) } };
}

function getAdminManagementDataFallback(session) {
  if (!session.userId || session.role !== "admin") {
    return { ok: false, message: "Only administrators can manage accounts and courses." };
  }

  const options = buildFallbackManagementOptions();
  return {
    ok: true,
    data: {
      accounts: fallbackState.users.map((user) => buildAdminAccountViewFallback(user, options)),
      courses: fallbackState.courses.map((course) => buildAdminCourseViewFallback(course, options)),
      materials: fallbackState.materials.map((item) => buildAdminMaterialViewFallback(item)),
      options,
      summary: {
        users: fallbackState.users.length,
        students: fallbackState.students.length,
        teachers: fallbackState.teachers.length,
        courses: fallbackState.courses.length,
        materials: fallbackState.materials.length,
      },
      meta: {
        source: "local-fallback",
        generatedAt: Date.now(),
      },
    },
  };
}

function saveAdminAccountFallback(session, data) {
  if (session.role !== "admin") {
    return { ok: false, message: "Only administrators can manage accounts." };
  }

  const options = buildFallbackManagementOptions();
  const payload = normalizeAdminAccountPayload(data);
  const existing = payload.userId ? fallbackState.users.find((item) => item._id === payload.userId) || null : null;
  const roleCode = existing ? existing.role : normalizeRoleCode(payload.roleCode);

  if (!existing && (!payload.username || !payload.displayName || !payload.password)) {
    return { ok: false, message: "Username, display name, and password are required for new accounts." };
  }

  if (!existing && !roleCode) {
    return { ok: false, message: "Role is required for new accounts." };
  }

  if (payload.username && fallbackState.users.some((item) => item.username === payload.username && (!existing || item._id !== existing._id))) {
    return { ok: false, message: "Username already exists." };
  }

  const now = Date.now();
  const before = existing ? clone(existing) : null;
  const account = existing || { _id: `u_${roleCode}_${now}`, password: "", createdAt: now };

  account.username = payload.username || account.username || `user_${now}`;
  account.role = roleCode || account.role || "student";
  account.displayName = payload.displayName || account.displayName || account.username;
  account.email = payload.email || account.email || "";
  account.phone = payload.phone || account.phone || "";
  account.status = normalizeUserStatus(payload.status || account.status || "active");
  account.updatedAt = now;
  account.updated_at = now;
  account.createdAt = account.createdAt || now;
  account.created_at = account.created_at || account.createdAt;

  if (payload.password) {
    account.password = payload.password;
    account.must_change_password = Boolean(payload.forceChangePassword);
  } else {
    account.must_change_password = Boolean(account.must_change_password);
  }

  const studentPayload = payload.studentProfile || {};
  const teacherPayload = payload.teacherProfile || {};
  let studentProfile = null;
  let teacherProfile = null;

  if (account.role === "student") {
    studentProfile = upsertFallbackStudentProfile({
      userId: account._id,
      displayName: account.displayName,
      email: account.email,
      phone: account.phone,
      payload: studentPayload,
      existing: fallbackState.students.find((item) => item.userId === account._id) || null,
      options,
      now,
    });
    if (!studentProfile) {
      return { ok: false, message: "Student profile information is incomplete." };
    }
  }

  if (account.role === "teacher") {
    teacherProfile = upsertFallbackTeacherProfile({
      userId: account._id,
      displayName: account.displayName,
      payload: teacherPayload,
      existing: fallbackState.teachers.find((item) => item.userId === account._id) || null,
      options,
      now,
    });
    if (!teacherProfile) {
      return { ok: false, message: "Teacher profile information is incomplete." };
    }
  }

  if (existing) {
    Object.assign(existing, account);
  } else {
    fallbackState.users.unshift(account);
  }

  if (studentProfile) {
    const existingStudent = fallbackState.students.find((item) => item.userId === account._id);
    if (existingStudent) {
      Object.assign(existingStudent, studentProfile);
    } else {
      fallbackState.students.unshift(studentProfile);
    }
  }

  if (teacherProfile) {
    const existingTeacher = fallbackState.teachers.find((item) => item.userId === account._id);
    if (existingTeacher) {
      Object.assign(existingTeacher, teacherProfile);
    } else {
      fallbackState.teachers.unshift(teacherProfile);
    }
  }

  const view = buildAdminAccountViewFallback(account, options);
  recordAudit(existing ? "admin.user.update" : "admin.user.create", session.userId, "users", account._id, before, view);

  return { ok: true, data: { account: view } };
}

function saveAdminCourseFallback(session, data) {
  if (session.role !== "admin") {
    return { ok: false, message: "Only administrators can manage courses." };
  }

  const options = buildFallbackManagementOptions();
  const payload = normalizeAdminCoursePayload(data);
  if (!payload.courseCode || !payload.courseName || !payload.departmentId || !payload.semesterId || !payload.sectionNo || !payload.teacherIds.length || !payload.capacity) {
    return { ok: false, message: "Course code, name, department, semester, section, teachers, and capacity are required." };
  }

  const teacherNames = payload.teacherIds
    .map((teacherId) => fallbackState.teachers.find((item) => item._id === teacherId))
    .filter(Boolean)
    .map((teacher) => teacher.name || teacher.teacherNo || teacher._id);

  if (teacherNames.length !== payload.teacherIds.length) {
    return { ok: false, message: "One or more selected teachers are invalid." };
  }

  const currentCourse = payload.courseId ? fallbackState.courses.find((item) => item.courseId === payload.courseId || item._id === payload.courseId) || null : null;
  const currentOffering = payload.courseOfferingId ? fallbackState.courses.find((item) => item.courseOfferingId === payload.courseOfferingId || item._id === payload.courseOfferingId) || null : null;
  const compareCourseId = currentCourse ? currentCourse.courseId || currentCourse._id : currentOffering ? currentOffering.courseId || currentOffering._id : "";
  const duplicateCourse = fallbackState.courses.find((item) => item.code === payload.courseCode && (item.courseId || item._id) !== compareCourseId);
  if (duplicateCourse && !currentCourse) {
    return { ok: false, message: "Course code already exists." };
  }

  const duplicateOffering = fallbackState.courses.find((item) => {
    if (currentOffering && (item.courseOfferingId === currentOffering.courseOfferingId || item._id === currentOffering._id)) {
      return false;
    }
    return (item.courseId || item._id) === compareCourseId && item.semesterId === payload.semesterId && item.sectionNo === payload.sectionNo;
  });
  if (duplicateOffering && !currentOffering) {
    return { ok: false, message: "An offering for the same course, semester, and section already exists." };
  }

  const now = Date.now();
  const before = currentOffering ? clone(currentOffering) : currentCourse ? clone(currentCourse) : null;
  const courseId = currentCourse ? currentCourse.courseId || currentCourse._id : `c_${now}`;
  const offeringId = currentOffering ? currentOffering.courseOfferingId || currentOffering._id : `co_${now}`;
  const departmentName = resolveFallbackOptionLabel(options.departments, payload.departmentId);
  const semesterName = resolveFallbackOptionLabel(options.semesters, payload.semesterId);

  const course = currentCourse || currentOffering || {
    _id: courseId,
    courseId,
    courseOfferingId: offeringId,
    createdAt: now,
    created_at: now,
    enrolledCount: 0,
  };

  course.courseId = courseId;
  course.courseOfferingId = offeringId;
  course.code = payload.courseCode;
  course.name = payload.courseName;
  course.departmentId = payload.departmentId;
  course.departmentName = departmentName;
  course.description = payload.description;
  course.status = payload.status;
  course.credits = payload.credits;
  course.courseType = payload.courseType;
  course.difficultyLevel = payload.difficultyLevel;
  course.semesterId = payload.semesterId;
  course.semesterName = semesterName;
  course.sectionNo = payload.sectionNo;
  course.teacherIds = payload.teacherIds.slice();
  course.teacherNames = teacherNames;
  course.capacity = payload.capacity;
  course.enrolledCount = Number(course.enrolledCount || 0);
  course.selectionStatus = payload.selectionStatus;
  course.syllabusUrl = payload.syllabusUrl;
  course.updatedAt = now;
  course.updated_at = now;

  if (currentCourse || currentOffering) {
    const existingIndex = fallbackState.courses.findIndex((item) => item.courseOfferingId === course.courseOfferingId || item._id === course.courseOfferingId);
    if (existingIndex >= 0) {
      fallbackState.courses.splice(existingIndex, 1, course);
    } else {
      fallbackState.courses.unshift(course);
    }
  } else {
    fallbackState.courses.unshift(course);
  }

  const view = buildAdminCourseViewFallback(course, options);
  recordAudit(currentOffering || currentCourse ? "admin.course.update" : "admin.course.create", session.userId, "course_offerings", course.courseOfferingId, before, view);

  return { ok: true, data: { course: view } };
}

function buildAdminManagementOptions() {
  return {
    roles: [
      { value: "student", label: "Student" },
      { value: "teacher", label: "Teacher" },
      { value: "admin", label: "Administrator" },
    ],
    departments: uniqueByLabel(fallbackState.teachers.map((item) => item.department).filter(Boolean).concat(["Academic Office"]), "dep"),
    majors: uniqueByLabel(fallbackState.students.map((item) => item.major).filter(Boolean), "major"),
    adminClasses: uniqueByLabel(fallbackState.students.map((item) => item.adminClass).filter(Boolean), "class"),
    semesters: [
      { value: "sem_2026_spring", label: "2026 Spring" },
      { value: "sem_2026_fall", label: "2026 Fall" },
    ],
    teachers: fallbackState.teachers.map((item) => ({
      value: item._id,
      label: item.name || item.teacherNo || item._id,
      subtitle: [item.teacherNo || "", item.department || ""].filter(Boolean).join(" - "),
    })),
  };
}

function buildAdminAccountViewFallback(user, options) {
  const student = fallbackState.students.find((item) => item.userId === user._id) || null;
  const teacher = fallbackState.teachers.find((item) => item.userId === user._id) || null;
  const roleCode = normalizeRoleCode(user.role || "student");
  return {
    _id: user._id,
    username: user.username || "",
    displayName: user.displayName || user.display_name || user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    avatarUrl: user.avatarUrl || user.avatar_url || "",
    status: user.status || "active",
    primaryRole: roleCode,
    roleCodes: [roleCode],
    roleIds: [roleCode],
    mustChangePassword: Boolean(user.must_change_password),
    passwordUpdatedAt: Number(user.passwordUpdatedAt || user.password_updated_at || 0),
    lastLoginAt: Number(user.lastLoginAt || user.last_login_at || 0),
    createdAt: Number(user.createdAt || user.created_at || 0),
    updatedAt: Number(user.updatedAt || user.updated_at || 0),
    linkedProfileType: student ? "student" : teacher ? "teacher" : "",
    studentProfile: student ? buildFallbackStudentProfileView(student, options) : null,
    teacherProfile: teacher ? buildFallbackTeacherProfileView(teacher, options) : null,
  };
}

function buildAdminCourseViewFallback(course, options) {
  const materials = fallbackState.materials.filter((item) => item.courseOfferingId === course.courseOfferingId);
  return {
    _id: course.courseOfferingId || course._id || "",
    courseId: course.courseId || course._id || "",
    courseOfferingId: course.courseOfferingId || course._id || "",
    courseCode: course.code || "",
    courseName: course.name || "",
    departmentId: course.departmentId || "",
    departmentName: course.departmentName || resolveFallbackOptionLabel(options.departments, course.departmentId),
    description: course.description || "",
    status: course.status || "active",
    credits: Number(course.credits || 0),
    courseType: course.courseType || "",
    difficultyLevel: Number(course.difficultyLevel || 0),
    semesterId: course.semesterId || "",
    semesterName: course.semesterName || resolveFallbackOptionLabel(options.semesters, course.semesterId),
    sectionNo: course.sectionNo || "",
    teacherIds: Array.isArray(course.teacherIds) ? course.teacherIds.slice() : [],
    teacherNames: Array.isArray(course.teacherNames) ? course.teacherNames.slice() : [],
    capacity: Number(course.capacity || 0),
    enrolledCount: Number(course.enrolledCount || 0),
    selectionStatus: course.selectionStatus || "not_started",
    syllabusUrl: course.syllabusUrl || "",
    materialCount: materials.length,
    createdAt: Number(course.createdAt || course.created_at || 0),
    updatedAt: Number(course.updatedAt || course.updated_at || 0),
  };
}

function buildAdminMaterialViewFallback(item) {
  const course = findCourse(item.courseOfferingId) || {};
  const uploader = fallbackState.users.find((user) => user._id === item.uploaderUserId) || null;
  return {
    _id: item._id,
    courseOfferingId: item.courseOfferingId || "",
    courseId: course.courseId || course._id || "",
    courseCode: course.code || "",
    courseName: buildCourseName(course, item.courseOfferingId),
    uploaderUserId: item.uploaderUserId || "",
    uploaderName: uploader ? uploader.displayName || uploader.username || "" : "",
    title: item.title || "",
    fileUrl: item.fileUrl || "",
    fileType: item.fileType || "",
    isPublicToStudents: item.isPublicToStudents === true,
    knowledgeDocumentId: item.knowledgeDocumentId || "",
    createdAt: Number(item.createdAt || 0),
    updatedAt: Number(item.updatedAt || 0),
  };
}

function upsertFallbackStudentProfile(input) {
  const existing = input.existing;
  const payload = input.payload || {};
  const existingMajorLabel = existing ? existing.majorName || existing.major || "" : "";
  const existingAdminClassLabel = existing ? existing.adminClassName || existing.adminClass || "" : "";
  const majorId = String(payload.majorId || payload.major_id || existing && existing.majorId || existing && existing.major_id || (existingMajorLabel ? slugify(existingMajorLabel) : slugify(input.displayName || ""))).trim();
  const adminClassId = String(payload.adminClassId || payload.admin_class_id || existing && existing.adminClassId || existing && existing.admin_class_id || (existingAdminClassLabel ? slugify(existingAdminClassLabel) : slugify(input.displayName || ""))).trim();
  const studentNo = String(payload.studentNo || payload.student_no || existing && existing.studentNo || existing && existing.student_no || "").trim();
  const enrollmentYear = Number(payload.enrollmentYear || payload.enrollment_year || existing && existing.enrollmentYear || existing && existing.enrollment_year || 0);
  if (!studentNo || !majorId || !Number.isFinite(enrollmentYear) || !enrollmentYear) {
    return null;
  }

  const majorLabel = resolveFallbackOptionLabel(input.options.majors, majorId) || existingMajorLabel || payload.majorName || payload.major || input.displayName || "";
  const adminClassLabel = resolveFallbackOptionLabel(input.options.adminClasses, adminClassId) || existingAdminClassLabel || payload.adminClassName || payload.adminClass || "";

  return {
    _exists: Boolean(existing),
    _id: existing ? existing._id : `stu_${input.userId}`,
    userId: input.userId,
    studentNo,
    name: input.displayName,
    majorId,
    major: majorLabel,
    majorName: majorLabel,
    adminClassId,
    adminClass: adminClassLabel,
    adminClassName: adminClassLabel,
    enrollmentYear,
    trainingPlanId: String(payload.trainingPlanId || payload.training_plan_id || existing && existing.trainingPlanId || existing && existing.training_plan_id || "").trim(),
    status: normalizeStudentStatus(String(payload.status || existing && existing.status || "active").trim()),
    contact: {
      ...(existing && existing.contact ? existing.contact : {}),
      email: input.email || existing && existing.contact && existing.contact.email || "",
      phone: input.phone || existing && existing.contact && existing.contact.phone || "",
    },
    familyInfo: existing && existing.familyInfo ? existing.familyInfo : existing && existing.family_info ? existing.family_info : {},
    createdAt: existing && existing.createdAt ? existing.createdAt : nowTimestamp(),
    created_at: existing && existing.created_at ? existing.created_at : nowTimestamp(),
    updatedAt: nowTimestamp(),
    updated_at: nowTimestamp(),
  };
}

function upsertFallbackTeacherProfile(input) {
  const existing = input.existing;
  const payload = input.payload || {};
  const existingDepartmentLabel = existing ? existing.departmentName || existing.department || "" : "";
  const departmentId = String(payload.departmentId || payload.department_id || existing && existing.departmentId || existing && existing.department_id || (existingDepartmentLabel ? slugify(existingDepartmentLabel) : slugify(input.displayName || ""))).trim();
  const teacherNo = String(payload.teacherNo || payload.teacher_no || existing && existing.teacherNo || existing && existing.teacher_no || "").trim();
  if (!teacherNo || !departmentId) {
    return null;
  }

  const departmentLabel = resolveFallbackOptionLabel(input.options.departments, departmentId) || existingDepartmentLabel || payload.departmentName || payload.department || "";
  return {
    _exists: Boolean(existing),
    _id: existing ? existing._id : `tea_${input.userId}`,
    userId: input.userId,
    teacherNo,
    name: input.displayName,
    departmentId,
    department: departmentLabel,
    departmentName: departmentLabel,
    title: String(payload.title || existing && existing.title || "").trim(),
    researchFields: normalizeStringArray(payload.researchFields || payload.research_fields || existing && existing.researchFields || existing && existing.research_fields || []),
    teachingExperience: String(payload.teachingExperience || payload.teaching_experience || existing && existing.teachingExperience || existing && existing.teaching_experience || "").trim(),
    office: String(payload.office || existing && existing.office || "").trim(),
    publicProfile: {
      ...(existing && existing.publicProfile ? existing.publicProfile : existing && existing.public_profile ? existing.public_profile : {}),
      officeHours: String(payload.officeHours || payload.office_hours || existing && existing.publicProfile && existing.publicProfile.officeHours || existing && existing.public_profile && existing.public_profile.officeHours || "").trim(),
      homepage: String(payload.homepage || existing && existing.publicProfile && existing.publicProfile.homepage || existing && existing.public_profile && existing.public_profile.homepage || "").trim(),
    },
    status: normalizeTeacherStatus(String(payload.status || existing && existing.status || "active").trim()),
    createdAt: existing && existing.createdAt ? existing.createdAt : nowTimestamp(),
    created_at: existing && existing.created_at ? existing.created_at : nowTimestamp(),
    updatedAt: nowTimestamp(),
    updated_at: nowTimestamp(),
  };
}

function buildFallbackStudentProfileView(student, options) {
  return {
    _id: student._id,
    userId: student.userId || student.user_id || "",
    studentNo: student.studentNo || student.student_no || "",
    name: student.name || "",
    majorId: student.majorId || student.major_id || "",
    majorName: student.majorName || student.major || resolveFallbackOptionLabel(options.majors, student.majorId || student.major_id),
    adminClassId: student.adminClassId || student.admin_class_id || "",
    adminClassName: student.adminClassName || student.adminClass || resolveFallbackOptionLabel(options.adminClasses, student.adminClassId || student.admin_class_id),
    enrollmentYear: Number(student.enrollmentYear || student.enrollment_year || 0),
    trainingPlanId: student.trainingPlanId || student.training_plan_id || "",
    status: student.status || "active",
    contact: clone(student.contact || {}),
    familyInfo: clone(student.familyInfo || student.family_info || {}),
  };
}

function buildFallbackTeacherProfileView(teacher, options) {
  return {
    _id: teacher._id,
    userId: teacher.userId || teacher.user_id || "",
    teacherNo: teacher.teacherNo || teacher.teacher_no || "",
    name: teacher.name || "",
    departmentId: teacher.departmentId || teacher.department_id || "",
    departmentName: teacher.departmentName || teacher.department || resolveFallbackOptionLabel(options.departments, teacher.departmentId || teacher.department_id),
    title: teacher.title || "",
    researchFields: Array.isArray(teacher.researchFields) ? teacher.researchFields.slice() : Array.isArray(teacher.research_fields) ? teacher.research_fields.slice() : [],
    teachingExperience: teacher.teachingExperience || teacher.teaching_experience || "",
    office: teacher.office || "",
    status: teacher.status || "active",
  };
}

function buildFallbackManagementOptions() {
  return {
    roles: [
      { value: "student", label: "Student" },
      { value: "teacher", label: "Teacher" },
      { value: "admin", label: "Administrator" },
    ],
    departments: uniqueByLabel(fallbackState.teachers.map((item) => item.department || item.departmentName).filter(Boolean).concat(["Academic Office"]), "dep"),
    majors: uniqueByLabel(fallbackState.students.map((item) => item.major || item.majorName).filter(Boolean), "major"),
    adminClasses: uniqueByLabel(fallbackState.students.map((item) => item.adminClass || item.adminClassName).filter(Boolean), "class"),
    semesters: [
      { value: "sem_2026_spring", label: "2026 Spring" },
      { value: "sem_2026_fall", label: "2026 Fall" },
    ],
    teachers: fallbackState.teachers.map((item) => ({
      value: item._id,
      label: item.name || item.teacherNo || item.teacher_no || item._id,
      subtitle: [item.teacherNo || item.teacher_no || "", item.department || item.departmentName || ""].filter(Boolean).join(" - "),
    })),
  };
}

function normalizeAdminAccountPayload(data) {
  return {
    userId: String(data.userId || data.accountId || "").trim(),
    username: String(data.username || "").trim(),
    displayName: String(data.displayName || data.display_name || "").trim(),
    email: String(data.email || "").trim(),
    phone: String(data.phone || "").trim(),
    status: String(data.status || "active").trim(),
    roleCode: String(data.roleCode || data.role || "").trim(),
    password: String(data.password || data.newPassword || "").trim(),
    forceChangePassword: data.forceChangePassword === true || data.mustChangePassword === true,
    studentProfile: data.studentProfile || {},
    teacherProfile: data.teacherProfile || {},
  };
}

function normalizeAdminCoursePayload(data) {
  return {
    courseId: String(data.courseId || "").trim(),
    courseOfferingId: String(data.courseOfferingId || "").trim(),
    courseCode: String(data.courseCode || data.code || "").trim(),
    courseName: String(data.courseName || data.name || "").trim(),
    departmentId: String(data.departmentId || "").trim(),
    description: String(data.description || "").trim(),
    status: normalizeCourseStatus(String(data.status || "active").trim()),
    credits: Number(data.credits || 0),
    courseType: normalizeCourseType(String(data.courseType || "major_required").trim()),
    difficultyLevel: normalizeDifficultyLevel(data.difficultyLevel),
    semesterId: String(data.semesterId || "").trim(),
    sectionNo: String(data.sectionNo || "").trim(),
    teacherIds: normalizeTeacherIds(data.teacherIds),
    capacity: Number(data.capacity || 0),
    selectionStatus: normalizeSelectionStatus(String(data.selectionStatus || "not_started").trim()),
    syllabusUrl: String(data.syllabusUrl || "").trim(),
  };
}

function resolveFallbackOptionLabel(options = [], value) {
  const found = (options || []).find((item) => item.value === value || item.id === value);
  return found ? found.label || found.name || "" : "";
}

function uniqueByLabel(values = [], prefix = "item") {
  const seen = new Map();
  for (const value of values || []) {
    const label = String(value || "").trim();
    if (!label || seen.has(label)) {
      continue;
    }
    seen.set(label, {
      value: slugify(`${prefix}_${label}`),
      label,
    });
  }
  return Array.from(seen.values());
}

function normalizeRoleCode(roleCode) {
  const allowed = ["student", "teacher", "admin"];
  return allowed.includes(roleCode) ? roleCode : "student";
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

function normalizeCourseStatus(status) {
  const allowed = ["active", "inactive"];
  return allowed.includes(status) ? status : "active";
}

function normalizeCourseType(courseType) {
  const allowed = ["general", "major_required", "major_elective", "public_elective", "practice"];
  return allowed.includes(courseType) ? courseType : "major_required";
}

function normalizeSelectionStatus(selectionStatus) {
  const allowed = ["not_started", "open", "closed", "cancelled"];
  return allowed.includes(selectionStatus) ? selectionStatus : "not_started";
}

function normalizeDifficultyLevel(value) {
  const level = Number(value || 0);
  if (!Number.isFinite(level)) {
    return 1;
  }
  return Math.max(1, Math.min(5, Math.round(level)));
}

function normalizeTeacherIds(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item || "").trim()).filter(Boolean)));
  }
  return Array.from(
    new Set(
      String(value || "")
        .split(/[;,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
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

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item";
}

function nowTimestamp() {
  return Date.now();
}

function submitProfileChangeFallback(session, data) {
  if (!["student", "teacher"].includes(session.role)) {
    return { ok: false, message: "Only students or teachers can submit profile changes." };
  }

  const target = resolveProfileTarget(session);
  if (!target) {
    return { ok: false, message: "Profile was not found." };
  }

  const changes = normalizeProfileChanges(session.role, target, data.changes || data);
  if (!Object.keys(changes).length) {
    return { ok: false, message: "No editable profile fields were changed." };
  }

  const now = Date.now();
  const request = {
    _id: `pcr_${now}`,
    requesterUserId: session.userId,
    requester_user_id: session.userId,
    requesterName: session.displayName || "",
    targetType: session.role,
    target_type: session.role,
    targetId: target._id,
    target_id: target._id,
    changes,
    status: "pending",
    reviewerUserId: "",
    reviewer_user_id: "",
    reviewComment: "",
    review_comment: "",
    reviewedAt: 0,
    reviewed_at: 0,
    createdAt: now,
    created_at: now,
    updatedAt: now,
    updated_at: now,
  };

  fallbackState.profileChangeRequests.unshift(request);
  recordAudit("profile.submit", session.userId, "profile_change_requests", request._id, null, request);
  return { ok: true, data: { request: clone(request) }, request: clone(request) };
}

function reviewProfileChangeFallback(session, data) {
  if (session.role !== "admin") {
    return { ok: false, message: "Only administrators can review profile changes." };
  }

  const requestId = String(data.requestId || data.profileChangeRequestId || "").trim();
  const decision = String(data.decision || "").trim();
  if (!requestId || !["approved", "rejected"].includes(decision)) {
    return { ok: false, message: 'Request id and decision "approved" or "rejected" are required.' };
  }

  const request = fallbackState.profileChangeRequests.find((item) => item._id === requestId);
  if (!request) {
    return { ok: false, message: "Profile change request not found." };
  }
  if (request.status !== "pending") {
    return { ok: false, message: "Profile change request has already been processed." };
  }

  const now = Date.now();
  const before = clone(request);
  request.status = decision;
  request.reviewerUserId = session.userId;
  request.reviewer_user_id = session.userId;
  request.reviewComment = String(data.reviewComment || data.comment || "").trim();
  request.review_comment = request.reviewComment;
  request.reviewedAt = now;
  request.reviewed_at = now;
  request.updatedAt = now;
  request.updated_at = now;

  if (decision === "approved") {
    applyProfileChanges(request);
  }

  recordAudit("profile.review", session.userId, "profile_change_requests", request._id, before, request);
  return { ok: true, data: { request: clone(request) }, request: clone(request) };
}

function askAssistantFallback(session, data) {
  if (!session.userId || !["student", "teacher", "admin"].includes(session.role)) {
    return { ok: false, message: "Login is required." };
  }

  purgeExpiredAiHistoryFallback();
  const query = String(data.query || data.question || "").trim();
  const now = Date.now();
  const conversation = resolveAiConversationFallback(session, data, query, now);
  const historyText = Array.isArray(data.history)
    ? data.history
        .slice(-5)
        .map((item) => item && item.content)
        .filter(Boolean)
        .join(" ")
    : "";
  const queryText = (historyText + " " + query).toLowerCase();
  const keywords = buildQueryKeywords(queryText);
  const rows = buildKnowledgeRows();
  const hit = rows
    .map((item) => ({
      ...item,
      score: scoreKnowledgeHit(item, queryText, keywords),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  const answer = hit
    ? hit.answer || hit.content || ""
    : "The current local knowledge base does not have enough information. Please contact academic staff for confirmation.";
  const assistantCreatedAt = Date.now();

  fallbackState.aiMessages.push({
    _id: "ai_msg_user_" + now,
    conversationId: conversation._id,
    role: "user",
    content: query,
    fallbackUsed: false,
    latencyMs: 0,
    createdAt: now,
  });
  fallbackState.aiMessages.push({
    _id: "ai_msg_assistant_" + assistantCreatedAt,
    conversationId: conversation._id,
    role: "assistant",
    content: answer,
    model: "local-keyword-kb",
    citations: hit ? [{ knowledgeBaseId: hit._id, title: hit.title || "" }] : [],
    fallbackUsed: !hit,
    latencyMs: assistantCreatedAt - now,
    createdAt: assistantCreatedAt,
  });
  conversation.messageCount = Number(conversation.messageCount || 0) + 2;
  conversation.contextSummary = query.slice(0, 120);
  conversation.updatedAt = assistantCreatedAt;

  recordAudit("ask_assistant", session.userId, "knowledge_base", hit ? hit._id : "", null, {
    query,
    grounded: Boolean(hit),
    conversation_id: conversation._id,
    context_turns: Array.isArray(data.history) ? Math.min(data.history.length, 5) : 0,
  });

  return {
    ok: true,
    data: {
      answer,
      source: hit ? hit.title || "" : "",
      sourceTitle: hit ? hit.title || "" : "",
      grounded: Boolean(hit),
      fallbackUsed: !hit,
      knowledgeBaseId: hit ? hit._id : "",
      conversationId: conversation._id,
    },
  };
}

function getAiHistoryFallback(session, data) {
  if (!session.userId || !["student", "teacher", "admin"].includes(session.role)) {
    return { ok: false, message: "Login is required." };
  }

  purgeExpiredAiHistoryFallback();
  const conversations = fallbackState.aiConversations
    .filter((item) => item.userId === session.userId)
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  const requestedId = String(data.conversationId || "").trim();
  const active = conversations.find((item) => item._id === requestedId) || conversations[0] || null;
  const messages = active
    ? fallbackState.aiMessages
        .filter((item) => item.conversationId === active._id)
        .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))
    : [];

  return {
    ok: true,
    data: {
      userId: session.userId,
      conversations: conversations.map(clone),
      activeConversationId: active ? active._id : "",
      messages: messages.map(clone),
      retentionDays: 60,
    },
  };
}

function resolveAiConversationFallback(session, data, query, now) {
  const requestedId = String(data.conversationId || "").trim();
  const requested = fallbackState.aiConversations.find(
    (item) => item._id === requestedId && item.userId === session.userId,
  );
  if (requested) {
    return requested;
  }

  const scenario = resolveAiScenario(query);
  const active = fallbackState.aiConversations.find(
    (item) => item.userId === session.userId && item.scenario === scenario && item.status === "active",
  );
  if (active) {
    return active;
  }

  const conversation = {
    _id: "ai_conv_" + session.userId + "_" + now,
    userId: session.userId,
    title: query.slice(0, 40) || "AI Assistant Conversation",
    scenario,
    contextSummary: "",
    messageCount: 0,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  fallbackState.aiConversations.unshift(conversation);
  return conversation;
}

function purgeExpiredAiHistoryFallback(now = Date.now()) {
  const cutoff = now - AI_HISTORY_RETENTION_MS;
  fallbackState.aiMessages = fallbackState.aiMessages.filter((item) => Number(item.createdAt || 0) >= cutoff);
  const aliveConversationIds = new Set(fallbackState.aiMessages.map((item) => item.conversationId));
  fallbackState.aiConversations = fallbackState.aiConversations.filter(
    (item) => Number(item.updatedAt || 0) >= cutoff || aliveConversationIds.has(item._id),
  );
}

function resolveAiScenario(query) {
  const value = String(query || "").toLowerCase();
  if (/(course|selection|elective|课程|选课)/.test(value)) return "course_selection";
  if (/(schedule|timetable|课表|安排)/.test(value)) return "schedule_query";
  if (/(exam|考试)/.test(value)) return "exam_query";
  if (/(graduation|credit|毕业|学分)/.test(value)) return "graduation_check";
  if (/(policy|rule|制度|政策)/.test(value)) return "policy_qa";
  return "other";
}

function resolveCoursesForSession(session) {
  if (session.role === "admin") {
    return fallbackState.courses.map(clone);
  }
  if (session.role === "teacher") {
    return fallbackState.courses.filter((item) => canTeacherAccessCourse(session.userId, item.courseOfferingId)).map(clone);
  }
  return fallbackState.enrollments
    .filter((item) => item.studentId === session.userId && item.status !== "dropped")
    .map((item) => findCourse(item.courseOfferingId))
    .filter(Boolean)
    .map(clone);
}

function resolveAttendanceForSession(session) {
  return fallbackState.attendance
    .filter((item) => {
      if (session.role === "student") {
        return item.studentId === session.userId;
      }
      if (session.role === "teacher") {
        return canTeacherAccessCourse(session.userId, item.courseOfferingId);
      }
      return true;
    })
    .map((item) => ({
      ...normalizeAttendanceView(item),
      courseName: buildCourseName(findCourse(item.courseOfferingId), item.courseOfferingId),
    }))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function resolveLeavesForSession(session) {
  return fallbackState.leaves
    .filter((item) => {
      if (session.role === "student") {
        return item.studentId === session.userId;
      }
      if (session.role === "teacher") {
        return item.status === "pending" && canTeacherAccessCourse(session.userId, item.courseOfferingId);
      }
      return item.status === "pending";
    })
    .map(clone);
}

function resolveMaterialsForSession(session) {
  return fallbackState.materials
    .filter((item) => {
      if (session.role === "student") {
        return item.isPublicToStudents && canStudentAccessCourse(session.userId, item.courseOfferingId);
      }
      if (session.role === "teacher") {
        return canTeacherAccessCourse(session.userId, item.courseOfferingId);
      }
      return true;
    })
    .map(buildMaterialView)
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

function resolveProfileChangeRequests(session) {
  return fallbackState.profileChangeRequests
    .filter((item) => {
      if (session.role === "admin") {
        return item.status === "pending";
      }
      return item.requesterUserId === session.userId;
    })
    .map(clone)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function buildStudentProfile(session) {
  const student = fallbackState.students.find((item) => item.userId === session.userId);
  if (!student) {
    return {
      major: "",
      gpa: "0.0",
      creditsEarned: 0,
      totalCredits: 0,
      enrollmentYear: "",
    };
  }
  return clone({
    studentId: student._id,
    studentNo: student.studentNo,
    name: student.name,
    gender: student.gender,
    major: student.major,
    adminClass: student.adminClass,
    gpa: student.gpa,
    creditsEarned: student.creditsEarned,
    totalCredits: student.totalCredits,
    enrollmentYear: student.enrollmentYear,
    contact: student.contact,
    familyInfo: student.familyInfo,
    moduleCredits: student.moduleCredits,
    gpaTrend: student.gpaTrend,
    percentileRank: student.percentileRank,
    interestTags: student.interestTags,
  });
}

function buildTeacherProfile(session) {
  const teacher = fallbackState.teachers.find((item) => item.userId === session.userId);
  if (!teacher) {
    return { department: "", title: "", studentCount: 0 };
  }
  const offeringIds = fallbackState.courses
    .filter((item) => canTeacherAccessCourse(session.userId, item.courseOfferingId))
    .map((item) => item.courseOfferingId);
  const studentCount = new Set(
    fallbackState.enrollments
      .filter((item) => offeringIds.includes(item.courseOfferingId) && item.status !== "dropped")
      .map((item) => item.studentId),
  ).size;
  return clone({
    teacherId: teacher._id,
    teacherNo: teacher.teacherNo,
    name: teacher.name,
    department: teacher.department,
    title: teacher.title,
    office: teacher.office,
    researchFields: teacher.researchFields,
    teachingExperience: teacher.teachingExperience,
    publicProfile: teacher.publicProfile,
    studentCount,
  });
}

function buildEvaluationSummary(session = {}) {
  const allowedOfferingIds = resolveCoursesForSession(session.role ? session : { role: "admin" }).map(
    (course) => course.courseOfferingId,
  );
  const groups = new Map();
  for (const evaluation of fallbackState.evaluations) {
    if (session.role && session.role !== "admin" && !allowedOfferingIds.includes(evaluation.courseOfferingId)) {
      continue;
    }
    if (evaluation.status === "hidden") {
      continue;
    }
    const key = evaluation.courseOfferingId || evaluation.courseId;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(evaluation);
  }

  return Array.from(groups.values()).map((items) => {
    const first = items[0];
    const course = findCourse(first.courseOfferingId || first.courseId);
    const averageScores = {};
    for (const key of ["content", "teaching_method", "difficulty", "workload", "achievement", "overall"]) {
      averageScores[key] = round1(
        items.reduce((sum, item) => sum + Number((item.scores && item.scores[key]) || item.rating || 0), 0) /
          Math.max(items.length, 1),
      );
    }
    return {
      courseId: first.courseId,
      courseOfferingId: first.courseOfferingId,
      courseName: buildCourseName(course, first.courseOfferingId),
      count: items.length,
      average: averageScores.overall,
      averageRating: averageScores.overall.toFixed(1),
      averageScores,
      feedback: items.map((item) => item.feedbackText || item.feedback).filter(Boolean),
    };
  });
}

function buildRecommendations(session) {
  const student = fallbackState.students.find((item) => item.userId === session.userId);
  if (!student) {
    return [];
  }
  const enrolledOfferingIds = new Set(
    fallbackState.enrollments
      .filter((item) => item.studentId === session.userId && item.status !== "dropped")
      .map((item) => item.courseOfferingId),
  );
  const completedCourseIds = new Set((student.grades || []).map((item) => item.courseId));
  const evaluationMap = new Map(buildEvaluationSummary({ role: "admin" }).map((item) => [item.courseOfferingId, item]));
  return fallbackState.courses
    .filter((course) => !enrolledOfferingIds.has(course.courseOfferingId))
    .map((course) => {
      const evaluation = evaluationMap.get(course.courseOfferingId) || {};
      const interestScore = interestMatchScore(student.interestTags, course);
      const gradeScore = completedCourseIds.has("c_programming") ? 18 : 8;
      const evaluationScore = Number(evaluation.average || 0) * 12;
      const score = Math.round(gradeScore + interestScore + evaluationScore);
      const pathName = course.name.toLowerCase().includes("data") ? "Data Analysis Direction" : "Software Engineering Direction";
      return {
        _id: `rec_${session.userId}_${course.courseOfferingId}`,
        courseId: course.courseId,
        courseOfferingId: course.courseOfferingId,
        courseName: buildCourseName(course, course.courseOfferingId),
        pathName,
        score,
        reason: [
          `Matches interest tags: ${(student.interestTags || []).join(", ") || "general academic planning"}`,
          `Historical evaluation average: ${evaluation.averageRating || "not enough data"}`,
          `Prerequisite signal: ${completedCourseIds.has("c_programming") ? "programming foundation completed" : "foundation course suggested first"}`,
        ].join("; "),
        evidence: {
          completedCourseIds: Array.from(completedCourseIds),
          interestTags: student.interestTags || [],
          evaluationAverage: evaluation.average || 0,
          difficultyLevel: course.difficultyLevel,
        },
        status: "new",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function buildAcademicAlertsForStudent(userId) {
  const student = fallbackState.students.find((item) => item.userId === userId);
  const alerts = [];
  if (!student) {
    return alerts;
  }
  const absenceCount = fallbackState.attendance.filter(
    (item) => item.studentId === userId && item.status === "absent",
  ).length;
  if (absenceCount >= 3) {
    alerts.push({
      _id: `alert_absence_${userId}`,
      alertType: "absence",
      severity: "high",
      message: `${absenceCount} absence records detected. Counselor follow-up is recommended.`,
      status: "open",
      triggerRule: { absentGreaterOrEqual: 3 },
    });
  }
  if (Number(student.gpa) < 2.5) {
    alerts.push({
      _id: `alert_gpa_${userId}`,
      alertType: "low_gpa",
      severity: "medium",
      message: `Current GPA ${student.gpa} is below the 2.5 early-warning threshold.`,
      status: "open",
      triggerRule: { gpaBelow: 2.5 },
    });
  }
  return alerts;
}

function buildAtRiskStudents() {
  const grouped = new Map();
  for (const item of fallbackState.attendance) {
    if (item.status !== "absent") {
      continue;
    }
    if (!grouped.has(item.studentId)) {
      grouped.set(item.studentId, { absenceCount: 0, courseIds: new Set() });
    }
    const row = grouped.get(item.studentId);
    row.absenceCount += 1;
    row.courseIds.add(item.courseOfferingId);
  }
  return Array.from(grouped.entries())
    .filter(([, value]) => value.absenceCount >= 3)
    .map(([studentId, value]) => {
      const user = fallbackState.users.find((item) => item._id === studentId) || {};
      return {
        studentId,
        studentName: user.displayName || studentId,
        absenceCount: value.absenceCount,
        courseCount: value.courseIds.size,
        severity: value.absenceCount >= 5 ? "critical" : "high",
      };
    });
}

function syncAttendanceFallback(leave, now) {
  const classSessionId = `${leave.courseOfferingId}_${leave.leaveDate}`;
  const attendance = fallbackState.attendance.find(
    (item) =>
      item.studentId === leave.studentId &&
      item.courseOfferingId === leave.courseOfferingId &&
      item.date === leave.leaveDate,
  );
  const previousStatus = attendance ? attendance.status : "absent";
  const previousSource = attendance ? attendance.source || "system_import" : "system_import";
  let attendanceRecordId = attendance ? attendance._id : `att_${now}`;

  if (attendance) {
    Object.assign(attendance, {
      status: "on_leave",
      source: "leave_auto",
      leaveRequestId: leave._id,
      leave_request_id: leave._id,
      updatedAt: now,
      updated_at: now,
    });
  } else {
    fallbackState.attendance.unshift({
      _id: attendanceRecordId,
      studentId: leave.studentId,
      student_id: leave.studentId,
      studentName: leave.studentName,
      courseOfferingId: leave.courseOfferingId,
      course_offering_id: leave.courseOfferingId,
      classSessionId,
      class_session_id: classSessionId,
      attendanceDate: leave.leaveDate,
      attendance_date: leave.leaveDate,
      date: leave.leaveDate,
      status: "on_leave",
      source: "leave_auto",
      leaveRequestId: leave._id,
      leave_request_id: leave._id,
      createdAt: now,
      created_at: now,
      updatedAt: now,
      updated_at: now,
    });
  }

  const link = {
    leave_request_id: leave._id,
    class_session_id: classSessionId,
    attendance_record_id: attendanceRecordId,
    previous_status: previousStatus,
    previous_source: previousSource,
    created_at: now,
    updated_at: now,
  };
  const existingLink = fallbackState.leaveRequestSessions.find(
    (item) => item.leave_request_id === leave._id && item.class_session_id === classSessionId,
  );
  if (existingLink) {
    Object.assign(existingLink, link);
  } else {
    fallbackState.leaveRequestSessions.unshift(link);
  }
  return { attendanceRecordId, classSessionId, previousStatus, previousSource };
}

function restoreAttendanceFallback(leave, now) {
  const links = fallbackState.leaveRequestSessions.filter((item) => item.leave_request_id === leave._id);
  const restored = [];
  for (const link of links) {
    const attendance = fallbackState.attendance.find((item) => item._id === link.attendance_record_id);
    if (!attendance) {
      continue;
    }
    attendance.status = link.previous_status || "absent";
    attendance.source = link.previous_source || "system_import";
    attendance.leaveRequestId = "";
    attendance.leave_request_id = "";
    attendance.updatedAt = now;
    attendance.updated_at = now;
    restored.push({
      attendanceId: attendance._id,
      previousStatus: attendance.status,
      previousSource: attendance.source,
    });
  }
  return { restored };
}

function normalizeProfileChanges(role, target, raw) {
  const allowed =
    role === "student"
      ? {
          "contact.email": "Email",
          "contact.phone": "Phone",
          "contact.address": "Address",
          "familyInfo.guardianName": "Guardian Name",
          "familyInfo.guardianPhone": "Guardian Phone",
        }
      : {
          office: "Office",
          teachingExperience: "Teaching Experience",
          researchFields: "Research Fields",
          "publicProfile.officeHours": "Office Hours",
          "publicProfile.homepage": "Homepage",
        };
  const changes = {};
  for (const [field, label] of Object.entries(allowed)) {
    const nextValue = extractFieldValue(raw, field);
    if (nextValue === undefined) {
      continue;
    }
    const normalizedNewValue = Array.isArray(nextValue)
      ? nextValue.map((item) => String(item).trim()).filter(Boolean)
      : String(nextValue).trim();
    const oldValue = getByPath(target, field);
    if (stableSerialize(oldValue || "") === stableSerialize(normalizedNewValue || "")) {
      continue;
    }
    changes[field] = {
      oldValue: oldValue === undefined ? "" : oldValue,
      newValue: normalizedNewValue,
      label,
    };
  }
  return changes;
}

function applyProfileChanges(request) {
  const collection = request.targetType === "teacher" ? fallbackState.teachers : fallbackState.students;
  const target = collection.find((item) => item._id === request.targetId);
  if (!target) {
    return;
  }
  for (const [field, change] of Object.entries(request.changes || {})) {
    setByPath(target, field, change.newValue);
  }
  if (request.targetType === "student") {
    const user = fallbackState.users.find((item) => item._id === target.userId);
    if (user) {
      user.email = target.contact && target.contact.email ? target.contact.email : user.email;
      user.phone = target.contact && target.contact.phone ? target.contact.phone : user.phone;
    }
  }
}

function resolveProfileTarget(session) {
  if (session.role === "student") {
    return fallbackState.students.find((item) => item.userId === session.userId);
  }
  if (session.role === "teacher") {
    return fallbackState.teachers.find((item) => item.userId === session.userId);
  }
  return null;
}

function buildMaterialView(item) {
  const course = findCourse(item.courseOfferingId);
  return {
    _id: item._id,
    courseOfferingId: item.courseOfferingId,
    courseId: course ? course.courseId : "",
    courseName: buildCourseName(course, item.courseOfferingId),
    uploaderUserId: item.uploaderUserId,
    title: item.title,
    fileUrl: item.fileUrl,
    fileType: item.fileType,
    isPublicToStudents: item.isPublicToStudents === true,
    knowledgeDocumentId: item.knowledgeDocumentId || "",
    createdAt: Number(item.createdAt || 0),
    updatedAt: Number(item.updatedAt || 0),
  };
}

function syncEvaluationKnowledgeFallback(course, evaluation) {
  const title = `Course evaluation - ${buildCourseName(course, course.courseOfferingId)}`;
  fallbackState.knowledge.unshift({
    _id: `kb_eval_${evaluation._id}`,
    title,
    keywords: [
      "evaluation",
      "course selection",
      "feedback",
      course.code,
      course.name,
      ...(course.keywords || []),
    ].filter(Boolean),
    answer: `Anonymous course feedback for ${buildCourseName(course, course.courseOfferingId)}: average ${evaluation.rating}/5. ${evaluation.feedback}`,
    category: "course",
  });
}

function buildKnowledgeRows() {
  const evaluationRows = buildEvaluationSummary({ role: "admin" }).map((item) => ({
    _id: `kb_summary_${item.courseOfferingId}`,
    title: `${item.courseName} evaluation summary`,
    keywords: ["course", "evaluation", "feedback", "selection", item.courseName].filter(Boolean),
    answer: `${item.courseName} has an anonymous evaluation average of ${item.averageRating}/5 from ${item.count} response(s). Representative feedback: ${item.feedback.slice(0, 3).join(" / ") || "No text feedback yet."}`,
    category: "course",
  }));
  return fallbackState.knowledge.concat(evaluationRows);
}

function scoreKnowledgeHit(item, queryText, keywords) {
  const itemKeywords = Array.isArray(item.keywords) ? item.keywords : [];
  const keywordScore = itemKeywords.reduce((sum, keyword) => {
    const normalized = String(keyword || "").toLowerCase();
    return sum + (keywords.includes(normalized) || queryText.includes(normalized) ? 2 : 0);
  }, 0);
  const title = String(item.title || "").toLowerCase();
  const titleScore = title && queryText.includes(title) ? 3 : 0;
  return keywordScore + titleScore;
}

function buildQueryKeywords(value) {
  return Array.from(
    new Set(
      String(value || "")
        .toLowerCase()
        .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, " ")
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function buildScores(payload) {
  const keys = ["content", "teaching_method", "difficulty", "workload", "achievement", "overall"];
  const baseScore = Number(payload.rating || 0);
  const sourceScores = payload.scores && typeof payload.scores === "object" ? payload.scores : {};
  const scores = {};
  for (const key of keys) {
    const value = Number(sourceScores[key]);
    scores[key] = Number.isFinite(value) && value >= 1 && value <= 5 ? value : baseScore;
  }
  return scores;
}

function canStudentAccessCourse(userId, courseOfferingId) {
  return fallbackState.enrollments.some(
    (item) => item.studentId === userId && item.courseOfferingId === courseOfferingId && item.status !== "dropped",
  );
}

function canTeacherAccessCourse(userId, courseOfferingId) {
  const teacher = fallbackState.teachers.find((item) => item.userId === userId);
  const course = findCourse(courseOfferingId);
  return Boolean(teacher && course && (course.teacherIds || []).includes(teacher._id));
}

function findCourse(courseOfferingId) {
  return (
    fallbackState.courses.find(
      (item) => item.courseOfferingId === courseOfferingId || item._id === courseOfferingId || item.courseId === courseOfferingId,
    ) || null
  );
}

function buildCourseName(course, fallbackName) {
  if (!course) {
    return fallbackName || "";
  }
  return [course.code || course.course_code, course.name || fallbackName].filter(Boolean).join(" ").trim();
}

function normalizeReasonType(reasonType) {
  const allowed = ["sick", "personal", "official", "other"];
  const value = String(reasonType || "").trim();
  return allowed.includes(value) ? value : "other";
}

function buildLeaveRange(leaveDate) {
  const start = new Date(`${leaveDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid leave date.");
  }
  const end = new Date(start.getTime());
  end.setHours(23, 59, 59, 999);
  return { startAt: start.getTime(), endAt: end.getTime() };
}

function normalizeLeaveView(leave) {
  return {
    ...leave,
    studentId: leave.studentId || leave.student_id,
    student_id: leave.student_id || leave.studentId,
    studentName: leave.studentName || leave.student_name,
    student_name: leave.student_name || leave.studentName,
    courseOfferingId: leave.courseOfferingId || leave.course_offering_id,
    course_offering_id: leave.course_offering_id || leave.courseOfferingId,
    courseId: leave.courseId || leave.course_id,
    course_id: leave.course_id || leave.courseId,
    courseName: leave.courseName || leave.course_name,
    course_name: leave.course_name || leave.courseName,
    leaveDate: leave.leaveDate || leave.leave_date,
    leave_date: leave.leave_date || leave.leaveDate,
    date: leave.date || leave.leave_date || leave.leaveDate,
    reasonType: leave.reasonType || leave.reason_type,
    reason_type: leave.reason_type || leave.reasonType,
    reasonDetail: leave.reasonDetail || leave.reason_detail,
    reason_detail: leave.reason_detail || leave.reasonDetail,
    reason: leave.reason || leave.reason_detail || leave.reasonDetail,
    startAt: leave.startAt || leave.start_at,
    start_at: leave.start_at || leave.startAt,
    endAt: leave.endAt || leave.end_at,
    end_at: leave.end_at || leave.endAt,
    reviewerUserId: leave.reviewerUserId || leave.reviewer_user_id,
    reviewer_user_id: leave.reviewer_user_id || leave.reviewerUserId,
    reviewerName: leave.reviewerName || leave.reviewer_name,
    reviewer_name: leave.reviewer_name || leave.reviewerName,
    reviewComment: leave.reviewComment || leave.review_comment,
    review_comment: leave.review_comment || leave.reviewComment,
    reviewedAt: leave.reviewedAt || leave.reviewed_at,
    reviewed_at: leave.reviewed_at || leave.reviewedAt,
    createdAt: leave.createdAt || leave.created_at,
    created_at: leave.created_at || leave.createdAt,
    updatedAt: leave.updatedAt || leave.updated_at,
    updated_at: leave.updated_at || leave.updatedAt,
  };
}

function normalizeAttendanceView(attendance) {
  return {
    ...attendance,
    studentId: attendance.studentId || attendance.student_id,
    student_id: attendance.student_id || attendance.studentId,
    studentName: attendance.studentName || attendance.student_name,
    courseOfferingId: attendance.courseOfferingId || attendance.course_offering_id,
    course_offering_id: attendance.course_offering_id || attendance.courseOfferingId,
    courseId: attendance.courseId || attendance.course_id,
    course_id: attendance.course_id || attendance.courseId,
    date: attendance.date || attendance.attendance_date || attendance.attendanceDate,
    attendanceDate: attendance.attendanceDate || attendance.attendance_date || attendance.date,
    attendance_date: attendance.attendance_date || attendance.attendanceDate || attendance.date,
    leaveRequestId: attendance.leaveRequestId || attendance.leave_request_id,
    leave_request_id: attendance.leave_request_id || attendance.leaveRequestId,
    createdAt: attendance.createdAt || attendance.created_at,
    created_at: attendance.created_at || attendance.createdAt,
    updatedAt: attendance.updatedAt || attendance.updated_at,
    updated_at: attendance.updated_at || attendance.updatedAt,
  };
}

function normalizeResult(result) {
  if (result && typeof result.ok === "boolean") {
    return result;
  }

  if (result && Number(result.code) === 200) {
    return {
      ok: true,
      data: result.data,
      message: result.message,
      summary: result.summary,
      anonymousEvaluations: result.anonymousEvaluations,
    };
  }

  if (result && Object.prototype.hasOwnProperty.call(result, "code")) {
    return {
      ok: false,
      data: result.data,
      message: result.message || "Request failed.",
    };
  }

  return result || { ok: false, message: "Empty cloud function response." };
}

function stripClientOnlyFields(data) {
  const cloned = clone(data || {});
  delete cloned.forceRefresh;
  delete cloned.__forceRefresh;
  delete cloned.refreshToken;
  return cloned;
}

function buildCacheKey(name, data) {
  return `${name}:${stableSerialize(data)}`;
}

function stableSerialize(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
    .join(",")}}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function recordAudit(action, actorUserId, targetCollection, targetId, before, after) {
  fallbackState.auditLogs.unshift({
    action,
    actor_user_id: actorUserId,
    target_collection: targetCollection,
    target_id: targetId,
    before: before ? clone(before) : null,
    after: after ? clone(after) : null,
    created_at: Date.now(),
  });
}

function interestMatchScore(interestTags = [], course = {}) {
  const text = `${course.name || ""} ${(course.keywords || []).join(" ")}`.toLowerCase();
  return interestTags.reduce((sum, tag) => {
    const normalized = String(tag || "").toLowerCase();
    return sum + (text.includes(normalized.split(" ")[0]) ? 24 : 6);
  }, 0);
}

function round1(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 10) / 10;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const values = [lat1, lon1, lat2, lon2].map(Number);
  if (values.some((value) => !Number.isFinite(value))) {
    return Number.POSITIVE_INFINITY;
  }
  const [aLat, aLon, bLat, bLon] = values.map((value) => (value * Math.PI) / 180);
  const dLat = bLat - aLat;
  const dLon = bLon - aLon;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hashString(value) {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return `local_${Math.abs(hash).toString(16)}`;
}

function extractFieldValue(raw, field) {
  if (Object.prototype.hasOwnProperty.call(raw, field)) {
    const direct = raw[field];
    if (direct && typeof direct === "object" && Object.prototype.hasOwnProperty.call(direct, "newValue")) {
      return direct.newValue;
    }
    return direct;
  }
  return getByPath(raw, field);
}

function getByPath(object, path) {
  return String(path)
    .split(".")
    .reduce((current, key) => (current && Object.prototype.hasOwnProperty.call(current, key) ? current[key] : undefined), object);
}

function setByPath(object, path, value) {
  const keys = String(path).split(".");
  let current = object;
  keys.slice(0, -1).forEach((key) => {
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  });
  current[keys[keys.length - 1]] = value;
}
