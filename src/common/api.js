const CACHE_TTL_MS = {
  "get-dashboard-data": 30000,
  "get-admin-management-data": 30000,
  "get-evaluation-summary": 60000,
  "get-course-materials": 60000,
  "get-ai-history": 30000,
};

const CLIENT_CACHE_VERSION = "course-session-v3";

const WRITE_FUNCTIONS = new Set([
  "save-admin-account",
  "delete-admin-account",
  "save-admin-course",
  "select-course-teacher",
  "submit-leave",
  "review-leave",
  "cancel-leave",
  "submit-evaluation",
  "save-course-material",
  "submit-profile-change",
  "review-profile-change",
  "submit-attendance-checkin",
  "save-attendance-records",
  "ask-assistant",
]);

const CLOUD_STRICT_FUNCTIONS = new Set([]);

const responseCache = new Map();
const inFlightReads = new Map();
const AI_HISTORY_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

const fallbackState = {
  users: [
    {
      _id: "user_admin_001",
      username: "admin001",
      password: "AiEms2026!",
      role: "admin",
      displayName: "Academic Admin",
      email: "admin001@ai-ems.test",
      phone: "13800000001",
    },
  ],
  students: [
    {
      _id: "stu_001",
      userId: "u_student_001",
      studentNo: "S2026001",
      name: "Alice Chen",
      gender: "Female",
      majorId: "major_se",
      major: "Software Engineering",
      adminClassId: "class_se_2024_1",
      adminClass: "SE 2026-1",
      enrollmentYear: 2024,
      trainingPlanId: "tp_se_2024",
      contact: {
        email: "alice.chen@ai-ems.test",
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
      majorId: "major_se",
      major: "Software Engineering",
      adminClassId: "class_se_2024_1",
      adminClass: "SE 2026-1",
      enrollmentYear: 2024,
      trainingPlanId: "tp_se_2024",
      contact: {
        email: "ben.zhang@ai-ems.test",
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
        homepage: "https://ai-ems.test/teachers/zhang",
      },
    },
    {
      _id: "tea_002",
      userId: "u_teacher_002",
      teacherNo: "T1002",
      name: "Prof. Li",
      department: "Computer Science",
      title: "Lecturer",
      office: "Teaching Building 3-503",
      researchFields: ["Database Systems", "Software Engineering"],
      teachingExperience: "Project-based software engineering and database teaching.",
      publicProfile: {
        officeHours: "Thu 10:00-11:30",
        homepage: "https://ai-ems.test/teachers/li",
      },
    },
  ],
  departments: [
    { _id: "dept_cs", code: "CS", name: "Computer Science" },
  ],
  majors: [
    { _id: "major_se", code: "SE", name: "Software Engineering", departmentId: "dept_cs" },
  ],
  adminClasses: [
    { _id: "class_se_2024_1", code: "SE2024-1", name: "Software Engineering 2024 Class 1", majorId: "major_se", gradeYear: 2024 },
  ],
  semesters: [
    { _id: "sem_2026_spring", name: "2026 Spring", startDate: "2026-02-23", endDate: "2026-06-26" },
  ],
  trainingPlans: [
    { _id: "tp_se_2024", majorId: "major_se", gradeYear: 2024, name: "Software Engineering 2024 Training Plan", status: "active" },
  ],
  classrooms: [
    { _id: "room_a101", building: "A", roomNo: "101", name: "A101", capacity: 60, latitude: 31.230416, longitude: 121.473701, geofenceRadiusM: 50 },
    { _id: "room_b208", building: "B", roomNo: "208", name: "B208", capacity: 45, latitude: 31.2306, longitude: 121.4739, geofenceRadiusM: 50 },
  ],
  courses: [
    {
      _id: "c_software_design",
      courseOfferingId: "co_software_design",
      courseId: "c_software_design",
      code: "JC3506",
      name: "Software Design and Implementation",
      departmentId: "dept_cs",
      semesterId: "sem_2026_spring",
      majorId: "major_se",
      majorName: "Software Engineering",
      trainingPlanId: "tp_se_2024",
      gradeYear: 2024,
      classroomId: "room_a101",
      classroomName: "A101",
      teacherId: "u_teacher_001",
      teacherIds: ["tea_001", "tea_002"],
      teacherNames: ["Dr. Zhang", "Prof. Li"],
      schedule: "Mon 10:00-12:00",
      startDate: "2026-05-25",
      endDate: "2026-06-29",
      classWeekday: 1,
      classStartTime: "10:00",
      classEndTime: "12:00",
      totalSessions: 6,
      materialUploadDeadlineAt: Date.parse("2026-06-29T23:59:59"),
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
      departmentId: "dept_cs",
      semesterId: "sem_2026_spring",
      majorId: "major_se",
      majorName: "Software Engineering",
      trainingPlanId: "tp_se_2024",
      gradeYear: 2024,
      classroomId: "room_a101",
      classroomName: "A101",
      teacherId: "u_teacher_001",
      teacherIds: ["tea_001", "tea_002"],
      teacherNames: ["Dr. Zhang", "Prof. Li"],
      schedule: "Wed 14:00-16:00",
      startDate: "2026-05-27",
      endDate: "2026-07-01",
      classWeekday: 3,
      classStartTime: "14:00",
      classEndTime: "16:00",
      totalSessions: 6,
      materialUploadDeadlineAt: Date.parse("2026-07-01T23:59:59"),
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
      departmentId: "dept_cs",
      semesterId: "sem_2026_spring",
      majorId: "major_se",
      majorName: "Software Engineering",
      trainingPlanId: "tp_se_2024",
      gradeYear: 2024,
      classroomId: "room_b208",
      classroomName: "B208",
      teacherId: "u_teacher_001",
      teacherIds: ["tea_001", "tea_002"],
      teacherNames: ["Dr. Zhang", "Prof. Li"],
      schedule: "Fri 09:00-11:00",
      startDate: "2026-05-29",
      endDate: "2026-07-03",
      classWeekday: 5,
      classStartTime: "09:00",
      classEndTime: "11:00",
      totalSessions: 6,
      materialUploadDeadlineAt: Date.parse("2026-07-03T23:59:59"),
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
    { studentId: "u_student_001", courseOfferingId: "co_software_design", status: "enrolled", selectedTeacherId: "tea_001", selectedTeacherUserId: "u_teacher_001", selectedTeacherName: "Dr. Zhang" },
    { studentId: "u_student_001", courseOfferingId: "co_process_management", status: "enrolled", selectedTeacherId: "tea_001", selectedTeacherUserId: "u_teacher_001", selectedTeacherName: "Dr. Zhang" },
    { studentId: "u_student_002", courseOfferingId: "co_software_design", status: "enrolled", selectedTeacherId: "tea_002", selectedTeacherUserId: "u_teacher_002", selectedTeacherName: "Prof. Li" },
    { studentId: "u_student_002", courseOfferingId: "co_process_management", status: "enrolled", selectedTeacherId: "tea_002", selectedTeacherUserId: "u_teacher_002", selectedTeacherName: "Prof. Li" },
  ],
  classSessions: [
    ...buildDemoSessions("co_software_design", "2026-05-25", 1, "10:00", "12:00", 6, "room_a101"),
    ...buildDemoSessions("co_process_management", "2026-05-27", 3, "14:00", "16:00", 6, "room_a101"),
    ...buildDemoSessions("co_data_analysis", "2026-05-29", 5, "09:00", "11:00", 6, "room_b208"),
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
      teacherId: "tea_001",
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

function buildDemoSessions(courseOfferingId, firstDate, weekday, startTime, endTime, totalSessions, classroomId = "") {
  const first = new Date(`${firstDate}T00:00:00`);
  return Array.from({ length: totalSessions }, (_, index) => {
    const date = new Date(first.getTime() + index * 7 * 24 * 60 * 60 * 1000);
    const sessionDate = date.toISOString().slice(0, 10);
    return {
      _id: `${courseOfferingId}_session_${index + 1}`,
      courseOfferingId,
      course_offering_id: courseOfferingId,
      classroomId,
      classroom_id: classroomId,
      sessionDate,
      session_date: sessionDate,
      weekday,
      startTime,
      start_time: startTime,
      endTime,
      end_time: endTime,
      sequenceNo: index + 1,
      sequence_no: index + 1,
      status: "scheduled",
      sessionStartAt: Date.parse(`${sessionDate}T${startTime}:00`),
      session_start_at: Date.parse(`${sessionDate}T${startTime}:00`),
      sessionEndAt: Date.parse(`${sessionDate}T${endTime}:00`),
      session_end_at: Date.parse(`${sessionDate}T${endTime}:00`),
      createdAt: Date.parse(`${firstDate}T00:00:00`),
      created_at: Date.parse(`${firstDate}T00:00:00`),
      updatedAt: Date.parse(`${firstDate}T00:00:00`),
      updated_at: Date.parse(`${firstDate}T00:00:00`),
    };
  });
}

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
    console.warn(`[AI-EMS] Cloud function ${name} failed.`, error);
    if (CLOUD_STRICT_FUNCTIONS.has(name)) {
      return {
        ok: false,
        message: `Cloud function ${name} failed. ${error && error.message ? error.message : "Please try again."}`,
      };
    }
    console.warn(`[AI-EMS] Falling back to local mode for ${name}.`);
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
    return getAdminManagementFallback(session);
  }

  if (name === "save-admin-account") {
    return saveAdminAccountFallback(session, data);
  }

  if (name === "delete-admin-account") {
    return deleteAdminAccountFallback(session, data);
  }

  if (name === "save-admin-course") {
    return saveAdminCourseFallback(session, data);
  }

  if (name === "select-course-teacher") {
    return selectCourseTeacherFallback(session, data);
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

  if (name === "save-attendance-records") {
    return saveAttendanceRecordsFallback(session, data);
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
  if (!fallbackState.users.length) {
    return { ok: false, message: "Local fallback login is disabled. Connect to the database to sign in." };
  }

  const user = fallbackState.users.find((item) => item.username === data.username);
  if (!user) {
    return { ok: false, message: "Account not found." };
  }
  if (user.status && user.status !== "active") {
    return { ok: false, message: "Account is inactive." };
  }
  if (user.password !== data.password) {
    return { ok: false, message: "Invalid account or password." };
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
  const classSessions = resolveClassSessionsForSession(session);
  const courseStudents = resolveCourseStudentsForSession(session);
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
      classSessions,
      courseStudents,
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
  const enrollment = findEnrollmentForStudentCourse(session.userId, courseOfferingId);
  if ((course.teacherIds || []).length > 1 && !(enrollment && (enrollment.selectedTeacherId || enrollment.selected_teacher_id))) {
    return { ok: false, message: "Please select a teacher for this course before submitting leave." };
  }

  let range = null;
  try {
    range = buildLeaveRange(leaveDate);
  } catch (error) {
    return { ok: false, message: error.message || "Invalid leave date." };
  }

  const classSession = findClassSessionForDate(courseOfferingId, leaveDate);
  if (classSession) {
    const sessionStartAt = getSessionStartAt(classSession);
    if (Date.now() >= sessionStartAt) {
      return { ok: false, message: "Leave requests must be submitted before the class starts." };
    }
  } else if (fallbackState.classSessions.some((item) => item.courseOfferingId === courseOfferingId || item.course_offering_id === courseOfferingId)) {
    return { ok: false, message: "Leave can only be submitted for a scheduled class date." };
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

  if (session.role === "teacher") {
    const enrollment = findEnrollmentForStudentCourse(leave.studentId || leave.student_id, leave.courseOfferingId);
    const teacher = findTeacherBySession(session);
    if (!canTeacherAccessCourse(session.userId, leave.courseOfferingId) || !enrollmentBelongsToTeacherFallback(enrollment, teacher, session.userId)) {
      return { ok: false, message: "You do not have permission to review this leave request." };
    }
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
  if (session.role === "student") {
    return { ok: false, message: "Location check-in is not available to students." };
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

function getAdminManagementFallback(session) {
  if (session.role !== "admin" || !session.userId) {
    return { ok: false, message: "Only administrators can manage accounts and courses." };
  }
  return {
    ok: true,
    data: {
      accounts: fallbackState.users.map(buildAdminAccountView),
      courses: fallbackState.courses.map(buildAdminCourseView),
      materials: fallbackState.materials.map(buildMaterialView),
      options: {
        roles: [
          { value: "student", label: "Student" },
          { value: "teacher", label: "Teacher" },
          { value: "admin", label: "Administrator" },
        ],
        departments: fallbackState.departments.map((item) => ({ value: item._id, label: item.name || item.code || item._id })),
        majors: fallbackState.majors.map((item) => ({ value: item._id, label: item.name || item.code || item._id })),
        adminClasses: fallbackState.adminClasses.map((item) => ({ value: item._id, label: item.name || item.code || item._id, gradeYear: item.gradeYear })),
        semesters: fallbackState.semesters.map((item) => ({ value: item._id, label: item.name || item._id })),
        trainingPlans: fallbackState.trainingPlans.map((item) => ({ value: item._id, label: item.name || item._id, gradeYear: item.gradeYear, majorId: item.majorId })),
        classrooms: fallbackState.classrooms.map((item) => ({
          value: item._id,
          label: [item.name || "", item.building && item.roomNo ? `${item.building}-${item.roomNo}` : ""].filter(Boolean).join(" / ") || item._id,
          capacity: Number(item.capacity || 0),
        })),
        teachers: fallbackState.teachers.map((item) => ({ value: item._id, label: item.name || item.teacherNo || item._id, subtitle: item.teacherNo || "" })),
      },
      summary: {
        users: fallbackState.users.length,
        students: fallbackState.students.length,
        teachers: fallbackState.teachers.length,
        courses: fallbackState.courses.length,
        offerings: fallbackState.courses.length,
        materials: fallbackState.materials.length,
      },
      meta: { source: "local-fallback", generatedAt: Date.now() },
    },
  };
}

function saveAdminAccountFallback(session, data) {
  if (session.role !== "admin" || !session.userId) {
    return { ok: false, message: "Only administrators can manage accounts." };
  }
  const userId = String(data.userId || data.accountId || "").trim();
  const existing = userId ? fallbackState.users.find((item) => item._id === userId) : null;
  const roleCode = String(data.roleCode || data.role || existing && existing.role || "student").trim();
  const username = String(data.username || existing && existing.username || "").trim();
  const displayName = String(data.displayName || existing && existing.displayName || "").trim();
  const password = String(data.password || data.newPassword || "").trim();
  if (!existing && (!username || !displayName || !password)) {
    return { ok: false, message: "Username, display name, and password are required." };
  }
  if (username && fallbackState.users.some((item) => item.username === username && item._id !== (existing && existing._id))) {
    return { ok: false, message: "Username already exists." };
  }

  const now = Date.now();
  const user = existing || {
    _id: `u_${roleCode}_${now}`,
    password: password || "",
    createdAt: now,
  };
  Object.assign(user, {
    username: username || user.username,
    displayName: displayName || user.displayName,
    email: String(data.email || user.email || "").trim(),
    phone: String(data.phone || user.phone || "").trim(),
    role: roleCode,
    status: String(data.status || user.status || "active").trim(),
    updatedAt: now,
  });
  if (password) {
    user.password = password;
  }
  if (!existing) {
    fallbackState.users.unshift(user);
  }

  if (roleCode === "student") {
    const payload = data.studentProfile || {};
    const student = fallbackState.students.find((item) => item.userId === user._id) || {
      _id: `stu_${now}`,
      userId: user._id,
      grades: [],
      gpaTrend: [],
      interestTags: [],
      percentileRank: 0,
      gpa: "0.0",
    };
    const major = fallbackState.majors.find((item) => item._id === payload.majorId) || {};
    const adminClass = fallbackState.adminClasses.find((item) => item._id === payload.adminClassId) || {};
    Object.assign(student, {
      studentNo: String(payload.studentNo || student.studentNo || "").trim(),
      name: user.displayName,
      gender: String(payload.gender || student.gender || "").trim(),
      majorId: payload.majorId || student.majorId || "",
      major: major.name || student.major || "",
      adminClassId: payload.adminClassId || student.adminClassId || "",
      adminClass: adminClass.name || student.adminClass || "",
      enrollmentYear: Number(payload.enrollmentYear || student.enrollmentYear || adminClass.gradeYear || 0),
      trainingPlanId: payload.trainingPlanId || student.trainingPlanId || "",
      contact: { ...(student.contact || {}), email: user.email || "", phone: user.phone || "", address: payload.address || student.contact && student.contact.address || "" },
      familyInfo: { ...(student.familyInfo || {}), guardianName: payload.guardianName || "", guardianPhone: payload.guardianPhone || "" },
      status: String(payload.status || student.status || "active").trim(),
    });
    if (!student.studentNo || !student.majorId || !student.enrollmentYear) {
      return { ok: false, message: "Student number, major, and enrollment year are required." };
    }
    if (!fallbackState.students.includes(student)) {
      fallbackState.students.unshift(student);
    }
    enrollCohortStudentsForStudentFallback(student, now);
  }

  if (roleCode === "teacher") {
    const payload = data.teacherProfile || {};
    const teacher = fallbackState.teachers.find((item) => item.userId === user._id) || {
      _id: `tea_${now}`,
      userId: user._id,
      researchFields: [],
      teachingExperience: "",
      publicProfile: {},
    };
    const department = fallbackState.departments.find((item) => item._id === payload.departmentId) || {};
    Object.assign(teacher, {
      teacherNo: String(payload.teacherNo || teacher.teacherNo || "").trim(),
      name: user.displayName,
      departmentId: payload.departmentId || teacher.departmentId || "",
      department: department.name || teacher.department || "",
      title: String(payload.title || teacher.title || "").trim(),
      office: String(payload.office || teacher.office || "").trim(),
      status: String(payload.status || teacher.status || "active").trim(),
    });
    if (!teacher.teacherNo || !teacher.departmentId) {
      return { ok: false, message: "Teacher number and department are required." };
    }
    if (!fallbackState.teachers.includes(teacher)) {
      fallbackState.teachers.unshift(teacher);
    }
  }

  return { ok: true, data: { account: buildAdminAccountView(user) } };
}

function deleteAdminAccountFallback(session, data) {
  if (session.role !== "admin" || !session.userId) {
    return { ok: false, message: "Only administrators can delete accounts." };
  }
  const userId = String(data.userId || data.accountId || "").trim();
  if (!userId) {
    return { ok: false, message: "Account id is required." };
  }
  if (userId === session.userId) {
    return { ok: false, message: "You cannot delete the current admin account." };
  }
  const user = fallbackState.users.find((item) => item._id === userId);
  if (!user) {
    return { ok: false, message: "Account was not found." };
  }

  const student = fallbackState.students.find((item) => item.userId === userId) || null;
  const teacher = fallbackState.teachers.find((item) => item.userId === userId) || null;
  const studentKeys = student ? new Set([student._id, student.userId].filter(Boolean)) : new Set();

  fallbackState.users = fallbackState.users.filter((item) => item._id !== userId);
  fallbackState.students = fallbackState.students.filter((item) => item.userId !== userId);
  fallbackState.teachers = fallbackState.teachers.filter((item) => item.userId !== userId);
  if (studentKeys.size) {
    fallbackState.enrollments = fallbackState.enrollments.filter((item) => !studentKeys.has(item.studentId || item.student_id));
    fallbackState.leaves = fallbackState.leaves.filter((item) => !studentKeys.has(item.studentId || item.student_id));
    fallbackState.attendance = fallbackState.attendance.filter((item) => !studentKeys.has(item.studentId || item.student_id));
    fallbackState.evaluations = fallbackState.evaluations.filter((item) => !studentKeys.has(item.studentId || item.student_id));
  }
  if (teacher) {
    fallbackState.materials = fallbackState.materials.filter((item) => item.teacherId !== teacher._id && item.uploaderUserId !== userId);
    fallbackState.courses.forEach((course) => {
      course.teacherIds = (course.teacherIds || []).filter((id) => id !== teacher._id && id !== userId);
      course.teacherNames = (course.teacherIds || [])
        .map((id) => fallbackState.teachers.find((item) => item._id === id || item.userId === id))
        .filter(Boolean)
        .map((item) => item.name || item.teacherNo || item._id);
    });
  }

  return { ok: true, data: { deletedAccountId: userId } };
}

function saveAdminCourseFallback(session, data) {
  if (session.role !== "admin" || !session.userId) {
    return { ok: false, message: "Only administrators can manage courses." };
  }
  const payload = normalizeAdminCoursePayload(data);
  if (!payload.courseCode || !payload.courseName || !payload.majorId || !payload.gradeYear || !payload.classroomId || !payload.teacherIds.length || !payload.startDate || !payload.endDate || !payload.classStartTime || !payload.classEndTime || !payload.totalSessions) {
    return { ok: false, message: "Course, major, cohort year, classroom, teacher, dates, class time, and total sessions are required." };
  }

  const now = Date.now();
  const existing = payload.courseOfferingId ? findCourse(payload.courseOfferingId) : null;
  const course = existing || { _id: `c_${now}`, courseId: `c_${now}`, courseOfferingId: `co_${now}`, createdAt: now };
  const major = fallbackState.majors.find((item) => item._id === payload.majorId) || null;
  if (!major) {
    return { ok: false, message: "Major was not found." };
  }
  const departmentId = String((existing && existing.departmentId) || major.departmentId || major.department_id || data.departmentId || "").trim();
  if (!departmentId) {
    return { ok: false, message: "Selected major is missing a department." };
  }
  const semester = resolveFallbackSemester(fallbackState.semesters, existing ? existing.semesterId : payload.semesterId);
  const semesterId = semester ? semester._id : "";
  if (!semesterId) {
    return { ok: false, message: "No semester is available to assign the course." };
  }
  const inferredPlan = fallbackState.trainingPlans.find((item) =>
    item.majorId === payload.majorId &&
    Number(item.gradeYear || 0) === Number(payload.gradeYear || 0) &&
    (!item.status || item.status === "active"),
  ) || null;
  const plan = payload.trainingPlanId
    ? fallbackState.trainingPlans.find((item) => item._id === payload.trainingPlanId) || null
    : inferredPlan;
  if (payload.trainingPlanId && (!plan || plan.majorId !== payload.majorId || Number(plan.gradeYear || 0) !== Number(payload.gradeYear || 0))) {
    return { ok: false, message: "Training plan must match the selected major and cohort year." };
  }
  const classroom = fallbackState.classrooms.find((item) => item._id === payload.classroomId) || null;
  if (!classroom) {
    return { ok: false, message: "Classroom was not found." };
  }
  const teacherNames = payload.teacherIds
    .map((id) => fallbackState.teachers.find((item) => item._id === id))
    .filter(Boolean)
    .map((item) => item.name || item.teacherNo || item._id);
  Object.assign(course, {
    courseId: course.courseId || course._id,
    code: payload.courseCode,
    name: payload.courseName,
    departmentId,
    semesterId,
    majorId: payload.majorId,
    majorName: major.name || major.code || major._id,
    trainingPlanId: plan ? plan._id : "",
    gradeYear: Number(payload.gradeYear || plan.gradeYear || 0),
    classroomId: payload.classroomId,
    classroomName: classroom.name || [classroom.building, classroom.roomNo].filter(Boolean).join("-") || classroom._id,
    teacherIds: payload.teacherIds,
    teacherNames,
    schedule: `${weekdayLabel(payload.classWeekday)} ${payload.classStartTime}-${payload.classEndTime}`,
    startDate: payload.startDate,
    endDate: payload.endDate,
    classWeekday: payload.classWeekday,
    classStartTime: payload.classStartTime,
    classEndTime: payload.classEndTime,
    totalSessions: payload.totalSessions,
    materialUploadDeadlineAt: Date.parse(`${payload.endDate}T23:59:59`),
    credits: payload.credits,
    courseType: payload.courseType,
    difficultyLevel: payload.difficultyLevel,
    capacity: payload.capacity,
    classroom: {
      name: classroom.name || classroom._id,
      latitude: Number(classroom.latitude || 0),
      longitude: Number(classroom.longitude || 0),
      radius: Number(classroom.geofenceRadiusM || classroom.geofence_radius_m || 50),
    },
    status: payload.status,
    updatedAt: now,
  });
  if (!existing) {
    fallbackState.courses.unshift(course);
  }

  fallbackState.classSessions = fallbackState.classSessions.filter((item) => item.courseOfferingId !== course.courseOfferingId);
  fallbackState.classSessions.unshift(...generateFallbackClassSessions(course, now));
  enrollCohortStudentsFallback(course, now);
  return { ok: true, data: { course: buildAdminCourseView(course) } };
}

function selectCourseTeacherFallback(session, data) {
  if (session.role !== "student" || !session.userId) {
    return { ok: false, message: "Only students can select a course teacher." };
  }
  const courseOfferingId = String(data.courseOfferingId || "").trim();
  const teacherId = String(data.teacherId || data.selectedTeacherId || "").trim();
  const student = findStudentBySession(session);
  const course = findCourse(courseOfferingId);
  const teacher = fallbackState.teachers.find((item) => item._id === teacherId);
  if (!student || !course || !teacher) {
    return { ok: false, message: "Student, course, or teacher was not found." };
  }
  if (!(course.teacherIds || []).includes(teacherId)) {
    return { ok: false, message: "This teacher is not assigned to the selected course." };
  }
  if (["closed", "cancelled"].includes(String(course.selectionStatus || ""))) {
    return { ok: false, message: "Teacher selection is closed for this course." };
  }
  const keys = buildUserKeySet(session.userId, student.userId, student._id);
  const enrollment = fallbackState.enrollments.find((item) =>
    keys.has(String(item.studentId || item.student_id || "").trim()) &&
    item.courseOfferingId === courseOfferingId &&
    item.status !== "dropped",
  );
  if (!enrollment) {
    return { ok: false, message: "You are not in the cohort for this course offering." };
  }
  if (enrollmentHasSelectedTeacherFallback(enrollment)) {
    return { ok: false, message: "Teacher selection is locked after you choose once." };
  }
  const alreadyCounted = enrollment.status === "enrolled";
  const selectedCount = countSelectedEnrollmentsForCourseFallback(courseOfferingId);
  if (!alreadyCounted && Number(course.capacity || 0) > 0 && selectedCount >= Number(course.capacity || 0)) {
    return { ok: false, message: "This course has reached capacity and can no longer be selected." };
  }
  const now = Date.now();
  Object.assign(enrollment, {
    selectedTeacherId: teacher._id,
    selected_teacher_id: teacher._id,
    selectedTeacherUserId: teacher.userId || "",
    selected_teacher_user_id: teacher.userId || "",
    selectedTeacherName: teacher.name || teacher.teacherNo || teacher._id,
    selected_teacher_name: teacher.name || teacher.teacherNo || teacher._id,
    teacherSelectedAt: now,
    teacher_selected_at: now,
    selectedAt: enrollment.selectedAt || now,
    selected_at: enrollment.selected_at || enrollment.selectedAt || now,
    status: "enrolled",
    updatedAt: now,
    updated_at: now,
  });
  if (!alreadyCounted) {
    course.enrolledCount = selectedCount + 1;
  }
  recordAudit("course.teacher.select", session.userId, "enrollments", enrollment._id || courseOfferingId, null, enrollment);
  return { ok: true, data: { enrollment: clone(enrollment) } };
}

function saveAttendanceRecordsFallback(session, data) {
  if (!["teacher", "admin"].includes(session.role)) {
    return { ok: false, message: "Only teachers or administrators can edit attendance." };
  }

  const courseOfferingId = String(data.courseOfferingId || "").trim();
  const attendanceDate = String(data.attendanceDate || data.date || "").trim();
  const records = Array.isArray(data.records) ? data.records : [];
  if (!courseOfferingId || !attendanceDate || !records.length) {
    return { ok: false, message: "Course, class date, and attendance records are required." };
  }
  if (session.role === "teacher" && !canTeacherAccessCourse(session.userId, courseOfferingId)) {
    return { ok: false, message: "You do not have permission to edit this course attendance." };
  }
  const teacher = session.role === "teacher" ? findTeacherBySession(session) : null;

  const classSession = findClassSessionForDate(courseOfferingId, attendanceDate);
  if (!classSession) {
    return { ok: false, message: "Class session was not found for this date." };
  }
  const now = Date.now();
  const startAt = getSessionStartAt(classSession);
  const endAt = getSessionEndAt(classSession);
  if (session.role === "teacher" && (now < startAt || now > endAt)) {
    return { ok: false, message: "Teachers can edit attendance only during the class time." };
  }

  const saved = [];
  for (const row of records) {
    const studentId = String(row.studentId || row.student_id || "").trim();
    const status = normalizeAttendanceStatus(row.status);
    if (!studentId || !status) {
      continue;
    }
    const enrollment = findEnrollmentForStudentCourse(studentId, courseOfferingId);
    if (session.role === "teacher" && !enrollmentBelongsToTeacherFallback(enrollment, teacher, session.userId)) {
      return { ok: false, message: "Teachers can edit attendance only for students who selected them." };
    }
    const existing = fallbackState.attendance.find(
      (item) =>
        item.studentId === studentId &&
        item.courseOfferingId === courseOfferingId &&
        item.date === attendanceDate,
    );
    if (existing && existing.status === "on_leave") {
      saved.push(normalizeAttendanceView(existing));
      continue;
    }
    const student = fallbackState.students.find((item) => item._id === studentId || item.userId === studentId) || {};
    const record = existing || {
      _id: `att_${now}_${studentId}`,
      studentId,
      student_id: studentId,
      studentName: student.name || studentId,
      courseOfferingId,
      course_offering_id: courseOfferingId,
      classSessionId: classSession._id,
      class_session_id: classSession._id,
      attendanceDate,
      attendance_date: attendanceDate,
      date: attendanceDate,
      leaveRequestId: "",
      leave_request_id: "",
      createdAt: now,
      created_at: now,
    };
    Object.assign(record, {
      status,
      source: "teacher_manual",
      remark: String(row.remark || "").trim(),
      updatedAt: now,
      updated_at: now,
    });
    if (!existing) {
      fallbackState.attendance.unshift(record);
    }
    saved.push(normalizeAttendanceView(record));
  }

  recordAudit("attendance.manual_update", session.userId, "attendance_records", courseOfferingId, null, {
    courseOfferingId,
    attendanceDate,
    count: saved.length,
  });
  return { ok: true, data: { attendance: saved } };
}

function submitEvaluationFallback(session, data) {
  if (session.role !== "student") {
    return { ok: false, code: 403, message: "Only students can submit course evaluations.", data: null };
  }

  const courseOfferingId = String(data.courseOfferingId || data.courseId || "").trim();
  const course = findCourse(courseOfferingId);
  const enrollment = findEnrollmentForStudentCourse(session.userId, courseOfferingId);
  const feedback = String(data.feedbackText || data.feedback_text || data.feedback || "").trim();
  const rating = Number(data.rating || (data.scores && data.scores.overall));

  if (!course || !enrollment) {
    return { ok: false, message: "You can evaluate only courses you have taken." };
  }
  if (!isCourseCompleted(course)) {
    return { ok: false, message: "Course evaluations open only after the course has ended." };
  }
  const selectedTeacherId = enrollment.selectedTeacherId || enrollment.selected_teacher_id || "";
  const selectedTeacherUserId = enrollment.selectedTeacherUserId || enrollment.selected_teacher_user_id || "";
  if ((course.teacherIds || []).length > 1 && !selectedTeacherId && !selectedTeacherUserId) {
    return { ok: false, message: "Please select a teacher for this course before submitting an evaluation." };
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
    teacherIds: selectedTeacherId
      ? [selectedTeacherId]
      : course.teacherIds || [],
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
      timeline: resolveClassSessionsForSession(session),
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
  const course = findCourse(courseOfferingId);
  const deadlineAt = Number(course && course.materialUploadDeadlineAt || 0);
  if (session.role === "teacher" && deadlineAt && Date.now() > deadlineAt) {
    return { ok: false, message: "The material upload deadline for this course has passed." };
  }

  const now = Date.now();
  const before = fallbackState.materials.find((item) => item._id === data.materialId) || null;
  if (before && session.role === "teacher" && !materialBelongsToTeacherFallback(before, findTeacherBySession(session), session.userId)) {
    return { ok: false, message: "Teachers can edit only their own course materials." };
  }
  const material = before || { _id: `mat_${now}`, createdAt: now };
  Object.assign(material, {
    courseOfferingId,
    teacherId: session.role === "teacher" ? (findTeacherBySession(session) || {})._id || "" : String(data.teacherId || before && before.teacherId || "").trim(),
    uploaderUserId: session.userId,
    title,
    fileUrl,
    fileType: String(data.fileType || "link").trim(),
    isPublicToStudents: data.isPublicToStudents !== false,
    knowledgeDocumentId: String(data.knowledgeDocumentId || "").trim(),
    availableAt: Number(data.availableAt || 0) || now,
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

function buildAdminAccountView(user) {
  const student = fallbackState.students.find((item) => item.userId === user._id) || null;
  const teacher = fallbackState.teachers.find((item) => item.userId === user._id) || null;
  return {
    _id: user._id,
    username: user.username || "",
    displayName: user.displayName || user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    status: user.status || "active",
    primaryRole: user.role || "",
    linkedProfileType: student ? "student" : teacher ? "teacher" : "",
    studentProfile: student ? {
      _id: student._id,
      userId: student.userId,
      studentNo: student.studentNo,
      name: student.name,
      majorId: student.majorId || "",
      majorName: student.major || "",
      adminClassId: student.adminClassId || "",
      adminClassName: student.adminClass || "",
      enrollmentYear: Number(student.enrollmentYear || 0),
      trainingPlanId: student.trainingPlanId || "",
      status: student.status || "active",
      contact: clone(student.contact || {}),
      familyInfo: clone(student.familyInfo || {}),
    } : null,
    teacherProfile: teacher ? {
      _id: teacher._id,
      userId: teacher.userId,
      teacherNo: teacher.teacherNo,
      name: teacher.name,
      departmentName: teacher.department,
      title: teacher.title,
      status: teacher.status || "active",
    } : null,
  };
}

function buildAdminCourseView(course) {
  return {
    _id: course.courseOfferingId || course._id,
    courseId: course.courseId || course._id,
    courseOfferingId: course.courseOfferingId,
    courseCode: course.code || "",
    courseName: course.name || "",
    departmentId: course.departmentId || "",
    credits: Number(course.credits || 0),
    courseType: course.courseType || "",
    difficultyLevel: Number(course.difficultyLevel || 0),
    semesterId: course.semesterId || "",
    sectionNo: course.sectionNo || "01",
    teacherIds: Array.isArray(course.teacherIds) ? course.teacherIds.slice() : [],
    teacherNames: Array.isArray(course.teacherNames) ? course.teacherNames.slice() : [],
    capacity: Number(course.capacity || 0),
    enrolledCount: countSelectedEnrollmentsForCourseFallback(course.courseOfferingId),
    trainingPlanId: course.trainingPlanId || "",
    majorId: course.majorId || "",
    majorName: course.majorName || "",
    gradeYear: Number(course.gradeYear || 0),
    classroomId: course.classroomId || "",
    classroomName: course.classroomName || course.classroom && course.classroom.name || "",
    startDate: course.startDate || "",
    endDate: course.endDate || "",
    classWeekday: Number(course.classWeekday || 0),
    classStartTime: course.classStartTime || "",
    classEndTime: course.classEndTime || "",
    totalSessions: Number(course.totalSessions || 0),
    materialUploadDeadlineAt: Number(course.materialUploadDeadlineAt || 0),
    schedule: course.schedule || "",
    materialCount: fallbackState.materials.filter((item) => item.courseOfferingId === course.courseOfferingId).length,
    status: course.status || "active",
  };
}

function normalizeAdminCoursePayload(data) {
  return {
    courseId: String(data.courseId || "").trim(),
    courseOfferingId: String(data.courseOfferingId || "").trim(),
    courseCode: String(data.courseCode || data.code || "").trim(),
    courseName: String(data.courseName || data.name || "").trim(),
    departmentId: String(data.departmentId || "").trim(),
    majorId: String(data.majorId || data.major_id || "").trim(),
    semesterId: String(data.semesterId || "").trim(),
    trainingPlanId: String(data.trainingPlanId || data.training_plan_id || "").trim(),
    gradeYear: Number(data.gradeYear || data.grade_year || 0),
    classroomId: String(data.classroomId || data.classroom_id || "").trim(),
    sectionNo: String(data.sectionNo || "01").trim(),
    teacherIds: normalizeIdList(data.teacherIds),
    startDate: String(data.startDate || data.courseStartDate || "").trim(),
    endDate: String(data.endDate || data.courseEndDate || "").trim(),
    classWeekday: Number(data.classWeekday || data.weekday || 1),
    classStartTime: String(data.classStartTime || data.startTime || "").trim(),
    classEndTime: String(data.classEndTime || data.endTime || "").trim(),
    totalSessions: Number(data.totalSessions || 0),
    credits: Number(data.credits || 0),
    courseType: String(data.courseType || "major_required").trim(),
    difficultyLevel: Number(data.difficultyLevel || 3),
    capacity: Number(data.capacity || 50),
    status: String(data.status || "active").trim(),
  };
}

function normalizeIdList(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item || "").trim()).filter(Boolean)));
  }
  return Array.from(new Set(String(value || "").split(/[;,\s]+/).map((item) => item.trim()).filter(Boolean)));
}

function weekdayLabel(value) {
  return ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][Number(value)] || "Mon";
}

function resolveFallbackSemester(semesters, preferredSemesterId) {
  const preferredId = String(preferredSemesterId || "").trim();
  if (preferredId) {
    const preferredSemester = semesters.find((item) => String(item._id || "") === preferredId);
    if (preferredSemester) {
      return preferredSemester;
    }
  }

  const currentSemester = semesters.find((item) => item.is_current || item.isCurrent);
  if (currentSemester) {
    return currentSemester;
  }

  const now = Date.now();
  const activeSemester = semesters.find((item) => {
    const start = Date.parse(`${item.startDate || item.start_date || ""}T00:00:00`);
    const end = Date.parse(`${item.endDate || item.end_date || ""}T23:59:59`);
    return Number.isFinite(start) && Number.isFinite(end) && start <= now && now <= end;
  });
  if (activeSemester) {
    return activeSemester;
  }

  return semesters[0] || null;
}

function generateFallbackClassSessions(course, now) {
  const first = new Date(`${course.startDate}T00:00:00`);
  const targetWeekday = Number(course.classWeekday || 1);
  const jsTarget = targetWeekday % 7;
  while (first.getDay() !== jsTarget) {
    first.setDate(first.getDate() + 1);
  }
  const end = new Date(`${course.endDate}T23:59:59`);
  const sessions = [];
  for (let index = 0; index < Number(course.totalSessions || 0); index += 1) {
    const date = new Date(first.getTime() + index * 7 * 24 * 60 * 60 * 1000);
    if (date.getTime() > end.getTime()) {
      break;
    }
    const sessionDate = date.toISOString().slice(0, 10);
    sessions.push({
      _id: `${course.courseOfferingId}_session_${index + 1}`,
      courseOfferingId: course.courseOfferingId,
      course_offering_id: course.courseOfferingId,
      classroomId: course.classroomId || "",
      classroom_id: course.classroomId || "",
      sessionDate,
      session_date: sessionDate,
      weekday: targetWeekday,
      startTime: course.classStartTime,
      start_time: course.classStartTime,
      endTime: course.classEndTime,
      end_time: course.classEndTime,
      sequenceNo: index + 1,
      sequence_no: index + 1,
      status: "scheduled",
      sessionStartAt: Date.parse(`${sessionDate}T${course.classStartTime}:00`),
      session_start_at: Date.parse(`${sessionDate}T${course.classStartTime}:00`),
      sessionEndAt: Date.parse(`${sessionDate}T${course.classEndTime}:00`),
      session_end_at: Date.parse(`${sessionDate}T${course.classEndTime}:00`),
      createdAt: now,
      created_at: now,
      updatedAt: now,
      updated_at: now,
    });
  }
  return sessions;
}

function enrollCohortStudentsFallback(course, now) {
  const students = fallbackState.students.filter((student) => studentMatchesCourseCohortFallback(student, course));
  for (const student of students) {
    const studentKey = student.userId || student._id;
    const existing = fallbackState.enrollments.find((item) => item.studentId === studentKey && item.courseOfferingId === course.courseOfferingId);
    if (existing) {
      existing.status = existing.status === "dropped" ? "selected" : existing.status;
      continue;
    }
    fallbackState.enrollments.push({
      _id: `enroll_${student._id}_${course.courseOfferingId}`,
      studentId: studentKey,
      courseOfferingId: course.courseOfferingId,
      status: "selected",
      selectedAt: now,
    });
  }
}

function enrollCohortStudentsForStudentFallback(student, now) {
  for (const course of fallbackState.courses) {
    if (!studentMatchesCourseCohortFallback(student, course)) continue;
    const studentKey = student.userId || student._id;
    const existing = fallbackState.enrollments.find((item) => item.studentId === studentKey && item.courseOfferingId === course.courseOfferingId);
    if (existing) continue;
    fallbackState.enrollments.push({
      _id: `enroll_${student._id}_${course.courseOfferingId}`,
      studentId: studentKey,
      courseOfferingId: course.courseOfferingId,
      status: "selected",
      selectedAt: now,
    });
  }
}

function studentMatchesCourseCohortFallback(student, course) {
  if (!student || !course) return false;
  const sameYear = course.gradeYear && Number(student.enrollmentYear || 0) === Number(course.gradeYear);
  const sameMajor = course.majorId && student.majorId === course.majorId;
  if (course.majorId) {
    return Boolean(sameYear && sameMajor);
  }
  return Boolean(
    (course.trainingPlanId && student.trainingPlanId === course.trainingPlanId) ||
    sameYear,
  );
}

function resolveCoursesForSession(session) {
  if (session.role === "admin") {
    return fallbackState.courses.map((course) => buildCourseRuntimeView(course));
  }
  if (session.role === "teacher") {
    return fallbackState.courses
      .filter((item) => canTeacherAccessCourse(session.userId, item.courseOfferingId))
      .map((course) => buildCourseRuntimeView(course));
  }
  const student = findStudentBySession(session);
  const studentKeys = buildUserKeySet(session.userId, student ? student.userId || student.user_id || student._id : "");
  if (student && student._id) {
    studentKeys.add(student._id);
  }

  const courses = fallbackState.enrollments
    .filter((item) => {
      const enrollmentStudentId = String(item.studentId || item.student_id || "").trim();
      return studentKeys.has(enrollmentStudentId) && item.status !== "dropped";
    })
    .map((item) => {
      const course = findCourse(item.courseOfferingId);
      return course ? buildCourseRuntimeView(course, item) : null;
    })
    .filter(Boolean);

  return courses.length ? courses : fallbackState.courses.map((course) => buildCourseRuntimeView(course));
}

function resolveAttendanceForSession(session) {
  const teacher = session.role === "teacher" ? findTeacherBySession(session) : null;
  return fallbackState.attendance
    .filter((item) => {
      if (session.role === "student") {
        return item.studentId === session.userId;
      }
      if (session.role === "teacher") {
        const enrollment = findEnrollmentForStudentCourse(item.studentId, item.courseOfferingId);
        return canTeacherAccessCourse(session.userId, item.courseOfferingId) && enrollmentBelongsToTeacherFallback(enrollment, teacher, session.userId);
      }
      return true;
    })
    .map((item) => ({
      ...normalizeAttendanceView(item),
      courseName: buildCourseName(findCourse(item.courseOfferingId), item.courseOfferingId),
    }))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function resolveClassSessionsForSession(session) {
  const offeringIds = new Set(resolveCoursesForSession(session).map((item) => item.courseOfferingId));
  return fallbackState.classSessions
    .filter((item) => offeringIds.has(item.courseOfferingId || item.course_offering_id))
    .map(normalizeClassSessionView)
    .sort((a, b) => Number(a.sessionStartAt || 0) - Number(b.sessionStartAt || 0));
}

function resolveCourseStudentsForSession(session) {
  if (!["teacher", "admin"].includes(session.role)) {
    return [];
  }
  const offeringIds = new Set(resolveCoursesForSession(session).map((item) => item.courseOfferingId));
  const teacher = session.role === "teacher" ? findTeacherBySession(session) : null;
  return fallbackState.enrollments
    .filter((item) => offeringIds.has(item.courseOfferingId) && item.status !== "dropped")
    .filter((item) => session.role !== "teacher" || enrollmentBelongsToTeacherFallback(item, teacher, session.userId))
    .map((enrollment) => {
      const student = fallbackState.students.find((item) => item.userId === enrollment.studentId || item._id === enrollment.studentId) || {};
      return {
        studentId: student._id || enrollment.studentId,
        userId: student.userId || enrollment.studentId,
        studentName: student.name || enrollment.studentId,
        studentNo: student.studentNo || "",
        courseOfferingId: enrollment.courseOfferingId,
        enrollmentStatus: enrollment.status || "enrolled",
        selectedTeacherId: enrollment.selectedTeacherId || enrollment.selected_teacher_id || "",
        selectedTeacherUserId: enrollment.selectedTeacherUserId || enrollment.selected_teacher_user_id || "",
        selectedTeacherName: enrollment.selectedTeacherName || enrollment.selected_teacher_name || "",
      };
    });
}

function resolveLeavesForSession(session) {
  return fallbackState.leaves
    .filter((item) => {
      if (session.role === "student") {
        return item.studentId === session.userId;
      }
      if (session.role === "teacher") {
        const teacher = findTeacherBySession(session);
        const enrollment = findEnrollmentForStudentCourse(item.studentId, item.courseOfferingId);
        return item.status === "pending" && canTeacherAccessCourse(session.userId, item.courseOfferingId) && enrollmentBelongsToTeacherFallback(enrollment, teacher, session.userId);
      }
      return item.status === "pending";
    })
    .map(clone);
}

function resolveMaterialsForSession(session) {
  const now = Date.now();
  const teacher = session.role === "teacher" ? findTeacherBySession(session) : null;
  return fallbackState.materials
    .filter((item) => {
      if (session.role === "student") {
        const course = findCourse(item.courseOfferingId);
        const enrollment = findEnrollmentForStudentCourse(session.userId, item.courseOfferingId);
        return item.isPublicToStudents && canStudentAccessCourse(session.userId, item.courseOfferingId) && isCourseStarted(course, now) && materialMatchesEnrollmentTeacherFallback(item, enrollment, course);
      }
      if (session.role === "teacher") {
        return canTeacherAccessCourse(session.userId, item.courseOfferingId) && materialBelongsToTeacherFallback(item, teacher, session.userId);
      }
      return true;
    })
    .map(buildMaterialView)
    .sort((a, b) =>
      session.role === "student"
        ? Number(a.timelineAt || a.updatedAt || 0) - Number(b.timelineAt || b.updatedAt || 0)
        : Number(b.updatedAt || 0) - Number(a.updatedAt || 0),
    );
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
  const student = findStudentBySession(session);
  if (!student) {
    return {
      major: "",
      gpa: "0.0",
      creditsEarned: 0,
      totalCredits: 0,
      enrollmentYear: "",
    };
  }
  const progress = calculateStudentProgress(student);
  const attendanceStats = calculateAttendanceStatsForStudent(student);
  return clone({
    studentId: student._id,
    studentNo: student.studentNo,
    name: student.name,
    gender: student.gender,
    major: student.major,
    adminClass: student.adminClass,
    gpa: student.gpa,
    creditsEarned: progress.creditsEarned,
    totalCredits: progress.totalCredits,
    completedCourseCount: progress.completedCourseCount,
    attendanceRate: attendanceStats.attendanceRate,
    attendanceStats,
    enrollmentYear: student.enrollmentYear,
    contact: student.contact,
    familyInfo: student.familyInfo,
    moduleCredits: progress.moduleCredits,
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
    const matched = findStudentBySession(session);
    if (matched) {
      return matched;
    }
    const seeded = {
      _id: `stu_${String(session.userId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, "")}`,
      userId: session.userId,
      studentNo: "",
      name: session.displayName || session.username || "",
      gender: "",
      major: "",
      adminClass: "",
      enrollmentYear: "",
      contact: {
        email: session.email || "",
        phone: session.phone || "",
        address: "",
      },
      familyInfo: {
        guardianName: "",
        guardianPhone: "",
      },
      interestTags: [],
      totalCredits: 0,
      creditsEarned: 0,
      moduleCredits: {
        general: { current: 0, total: 0 },
        majorRequired: { current: 0, total: 0 },
        majorElective: { current: 0, total: 0 },
        practice: { current: 0, total: 0 },
      },
      grades: [],
      gpaTrend: [],
      percentileRank: 0,
      gpa: "0.0",
    };
    fallbackState.students.unshift(seeded);
    return seeded;
  }
  if (session.role === "teacher") {
    const keys = buildUserKeySet(session.userId);
    const matched = fallbackState.teachers.find((item) => {
      const candidate = String(item.userId || item.user_id || "").trim();
      return keys.has(candidate);
    });
    if (matched) {
      return matched;
    }
    const seeded = {
      _id: `tea_${String(session.userId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, "")}`,
      userId: session.userId,
      teacherNo: "",
      name: session.displayName || session.username || "",
      department: "",
      title: "",
      office: "",
      researchFields: [],
      teachingExperience: "",
      publicProfile: {
        officeHours: "",
        homepage: "",
      },
    };
    fallbackState.teachers.unshift(seeded);
    return seeded;
  }
  return null;
}

function buildUserKeySet(...values) {
  const keys = new Set();
  values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .forEach((value) => {
      keys.add(value);
      if (value.startsWith("user_")) {
        keys.add(`u_${value.slice(5)}`);
      }
      if (value.startsWith("u_")) {
        keys.add(`user_${value.slice(2)}`);
      }
    });
  return keys;
}

function findStudentBySession(session) {
  const keys = buildUserKeySet(session.userId);
  return (
    fallbackState.students.find((item) => {
      const userId = String(item.userId || item.user_id || "").trim();
      const studentId = String(item._id || "").trim();
      return keys.has(userId) || keys.has(studentId);
    }) || null
  );
}

function buildMaterialView(item) {
  const course = findCourse(item.courseOfferingId);
  const firstSession = fallbackState.classSessions
    .filter((session) => (session.courseOfferingId || session.course_offering_id) === item.courseOfferingId)
    .sort((a, b) => getSessionStartAt(a) - getSessionStartAt(b))[0];
  return {
    _id: item._id,
    courseOfferingId: item.courseOfferingId,
    courseId: course ? course.courseId : "",
    courseName: buildCourseName(course, item.courseOfferingId),
    teacherId: item.teacherId || item.teacher_id || "",
    uploaderUserId: item.uploaderUserId,
    title: item.title,
    fileUrl: item.fileUrl,
    fileType: item.fileType,
    isPublicToStudents: item.isPublicToStudents === true,
    knowledgeDocumentId: item.knowledgeDocumentId || "",
    timelineAt: Number(item.availableAt || item.available_at || 0) || (firstSession ? getSessionStartAt(firstSession) : Number(item.updatedAt || 0)),
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
  return Boolean(findEnrollmentForStudentCourse(userId, courseOfferingId));
}

function canTeacherAccessCourse(userId, courseOfferingId) {
  const teacher = fallbackState.teachers.find((item) => item.userId === userId);
  const course = findCourse(courseOfferingId);
  return Boolean(teacher && course && (course.teacherIds || []).includes(teacher._id));
}

function findTeacherBySession(session) {
  const keys = buildUserKeySet(session.userId);
  return fallbackState.teachers.find((item) => keys.has(String(item.userId || item.user_id || "").trim())) || null;
}

function findEnrollmentForStudentCourse(studentId, courseOfferingId) {
  const keys = buildUserKeySet(studentId);
  return fallbackState.enrollments.find((item) =>
    keys.has(String(item.studentId || item.student_id || "").trim()) &&
    item.courseOfferingId === courseOfferingId &&
    item.status !== "dropped",
  ) || null;
}

function enrollmentHasSelectedTeacherFallback(enrollment) {
  return Boolean(
    String(enrollment && (enrollment.selectedTeacherId || enrollment.selected_teacher_id) || "").trim() ||
    String(enrollment && (enrollment.selectedTeacherUserId || enrollment.selected_teacher_user_id) || "").trim()
  );
}

function countSelectedEnrollmentsForCourseFallback(courseOfferingId) {
  return fallbackState.enrollments.filter((item) =>
    item.courseOfferingId === courseOfferingId &&
    item.status !== "dropped" &&
    (item.status === "enrolled" || enrollmentHasSelectedTeacherFallback(item)),
  ).length;
}

function enrollmentBelongsToTeacherFallback(enrollment, teacher, sessionUserId) {
  if (!enrollment) return true;
  const selectedTeacherId = String(enrollment.selectedTeacherId || enrollment.selected_teacher_id || "").trim();
  const selectedTeacherUserId = String(enrollment.selectedTeacherUserId || enrollment.selected_teacher_user_id || "").trim();
  if (!selectedTeacherId && !selectedTeacherUserId) return true;
  return Boolean(
    (teacher && selectedTeacherId && selectedTeacherId === teacher._id) ||
    (selectedTeacherUserId && selectedTeacherUserId === sessionUserId),
  );
}

function materialBelongsToTeacherFallback(material, teacher, sessionUserId) {
  const teacherId = String(material.teacherId || material.teacher_id || "").trim();
  const uploaderUserId = String(material.uploaderUserId || material.uploader_user_id || "").trim();
  return Boolean(
    (teacher && teacherId && teacherId === teacher._id) ||
    (uploaderUserId && uploaderUserId === sessionUserId),
  );
}

function materialMatchesEnrollmentTeacherFallback(material, enrollment, course) {
  const teacherIds = course && Array.isArray(course.teacherIds) ? course.teacherIds : [];
  const selectedTeacherId = String(enrollment && (enrollment.selectedTeacherId || enrollment.selected_teacher_id) || "").trim() || (teacherIds.length === 1 ? teacherIds[0] : "");
  const selectedTeacherUserId = String(enrollment && (enrollment.selectedTeacherUserId || enrollment.selected_teacher_user_id) || "").trim();
  if (!selectedTeacherId && !selectedTeacherUserId) return false;
  const materialTeacherId = String(material.teacherId || material.teacher_id || "").trim();
  const uploaderUserId = String(material.uploaderUserId || material.uploader_user_id || "").trim();
  return Boolean(
    (selectedTeacherId && materialTeacherId && selectedTeacherId === materialTeacherId) ||
    (selectedTeacherUserId && uploaderUserId && selectedTeacherUserId === uploaderUserId) ||
    (!materialTeacherId && !selectedTeacherUserId && teacherIds.length === 1),
  );
}

function buildCourseRuntimeView(course, enrollment = null) {
  const view = clone(course);
  const teacherOptions = (course.teacherIds || [])
    .map((teacherId) => fallbackState.teachers.find((item) => item._id === teacherId))
    .filter(Boolean)
    .map((teacher) => ({
      teacherId: teacher._id,
      userId: teacher.userId || "",
      name: teacher.name || teacher.teacherNo || teacher._id,
      teacherNo: teacher.teacherNo || "",
    }));
  view.teacherOptions = teacherOptions;
  view.teacherNames = teacherOptions.map((item) => item.name);
  view.selectedTeacherId = enrollment && (enrollment.selectedTeacherId || enrollment.selected_teacher_id) || "";
  view.selectedTeacherUserId = enrollment && (enrollment.selectedTeacherUserId || enrollment.selected_teacher_user_id) || "";
  view.selectedTeacherName = enrollment && (enrollment.selectedTeacherName || enrollment.selected_teacher_name) || "";
  view.teacherSelectedAt = Number(enrollment && (enrollment.teacherSelectedAt || enrollment.teacher_selected_at) || 0);
  view.teacherSelectionRequired = teacherOptions.length > 1;
  view.teacherSelected = teacherOptions.length <= 1 || Boolean(view.selectedTeacherId);
  view.completed = isCourseCompleted(course);
  view.enrollmentStatus = view.completed ? "completed" : enrollment && enrollment.status || "";
  return view;
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

function normalizeClassSessionView(session) {
  const courseOfferingId = session.courseOfferingId || session.course_offering_id;
  const course = findCourse(courseOfferingId);
  const sessionDate = session.sessionDate || session.session_date || "";
  const startTime = session.startTime || session.start_time || "";
  const endTime = session.endTime || session.end_time || "";
  return {
    ...session,
    courseOfferingId,
    course_offering_id: courseOfferingId,
    courseName: buildCourseName(course, courseOfferingId),
    sessionDate,
    session_date: sessionDate,
    startTime,
    start_time: startTime,
    endTime,
    end_time: endTime,
    sequenceNo: Number(session.sequenceNo || session.sequence_no || 0),
    sequence_no: Number(session.sequence_no || session.sequenceNo || 0),
    sessionStartAt: getSessionStartAt(session),
    session_start_at: getSessionStartAt(session),
    sessionEndAt: getSessionEndAt(session),
    session_end_at: getSessionEndAt(session),
  };
}

function findClassSessionForDate(courseOfferingId, date) {
  return fallbackState.classSessions.find(
    (item) =>
      (item.courseOfferingId === courseOfferingId || item.course_offering_id === courseOfferingId) &&
      (item.sessionDate === date || item.session_date === date),
  ) || null;
}

function getSessionStartAt(session) {
  const explicit = Number(session.sessionStartAt || session.session_start_at || 0);
  if (explicit) return explicit;
  const date = session.sessionDate || session.session_date || "";
  const time = session.startTime || session.start_time || "00:00";
  return Date.parse(`${date}T${time}:00`) || 0;
}

function getSessionEndAt(session) {
  const explicit = Number(session.sessionEndAt || session.session_end_at || 0);
  if (explicit) return explicit;
  const date = session.sessionDate || session.session_date || "";
  const time = session.endTime || session.end_time || "23:59";
  return Date.parse(`${date}T${time}:00`) || 0;
}

function isCourseStarted(course, now = Date.now()) {
  if (!course) return false;
  const startAt = Date.parse(`${course.startDate || ""}T${course.classStartTime || "00:00"}:00`);
  return !startAt || now >= startAt;
}

function isCourseCompleted(course, now = Date.now()) {
  if (!course) return false;
  const sessions = fallbackState.classSessions.filter((item) => (item.courseOfferingId || item.course_offering_id) === course.courseOfferingId);
  if (sessions.length) {
    return sessions.every((item) => getSessionEndAt(item) && getSessionEndAt(item) < now);
  }
  const endAt = Date.parse(`${course.endDate || ""}T${course.classEndTime || "23:59"}:00`);
  return Boolean(endAt && endAt < now);
}

function calculateStudentProgress(student) {
  const planCourses = fallbackState.courses.filter((course) =>
    (student.trainingPlanId && course.trainingPlanId === student.trainingPlanId) ||
    (student.enrollmentYear && Number(course.gradeYear || 0) === Number(student.enrollmentYear)),
  );
  const enrollments = fallbackState.enrollments.filter((item) =>
    item.status !== "dropped" &&
    (item.studentId === student.userId || item.studentId === student._id),
  );
  const completedCourseIds = new Set();
  const completedCourses = enrollments
    .map((item) => findCourse(item.courseOfferingId))
    .filter((course) => course && isCourseCompleted(course))
    .filter((course) => {
      const key = course.courseId || course._id;
      if (completedCourseIds.has(key)) return false;
      completedCourseIds.add(key);
      return true;
    });
  const planCourseIds = new Set();
  const uniquePlanCourses = planCourses.filter((course) => {
    const key = course.courseId || course._id;
    if (planCourseIds.has(key)) return false;
    planCourseIds.add(key);
    return true;
  });
  const moduleCredits = {};
  for (const key of ["general", "major_required", "major_elective", "practice"]) {
    const camel = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
    moduleCredits[camel] = { current: 0, total: 0 };
  }
  for (const course of uniquePlanCourses) {
    const key = String(course.courseType || "major_required");
    const camel = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
    if (!moduleCredits[camel]) moduleCredits[camel] = { current: 0, total: 0 };
    moduleCredits[camel].total += Number(course.credits || 0);
  }
  for (const course of completedCourses) {
    const key = String(course.courseType || "major_required");
    const camel = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
    if (!moduleCredits[camel]) moduleCredits[camel] = { current: 0, total: 0 };
    moduleCredits[camel].current += Number(course.credits || 0);
  }
  return {
    creditsEarned: completedCourses.reduce((sum, course) => sum + Number(course.credits || 0), 0),
    totalCredits: uniquePlanCourses.reduce((sum, course) => sum + Number(course.credits || 0), 0),
    completedCourseCount: completedCourses.length,
    moduleCredits,
  };
}

function calculateAttendanceStatsForStudent(student, now = Date.now()) {
  const enrollments = fallbackState.enrollments.filter((item) =>
    item.status !== "dropped" &&
    (item.studentId === student.userId || item.studentId === student._id),
  );
  const offeringIds = new Set(enrollments.map((item) => item.courseOfferingId));
  const pastSessions = fallbackState.classSessions.filter((item) => offeringIds.has(item.courseOfferingId || item.course_offering_id) && getSessionEndAt(item) < now);
  let attended = 0;
  let leave = 0;
  for (const classSession of pastSessions) {
    const date = classSession.sessionDate || classSession.session_date;
    const record = fallbackState.attendance.find((item) =>
      (item.studentId === student.userId || item.studentId === student._id) &&
      item.courseOfferingId === (classSession.courseOfferingId || classSession.course_offering_id) &&
      item.date === date,
    );
    if (record && record.status === "on_leave") {
      leave += 1;
    } else if (record && ["present", "late", "excused"].includes(record.status)) {
      attended += 1;
    }
  }
  const denominator = Math.max(pastSessions.length - leave, 0);
  return {
    attendedSessions: attended,
    leaveSessions: leave,
    pastSessions: pastSessions.length,
    countedSessions: denominator,
    attendanceRate: denominator ? Math.round((attended / denominator) * 100) : 0,
  };
}

function normalizeAttendanceStatus(status) {
  const value = String(status || "").trim();
  const allowed = ["present", "late", "absent", "excused"];
  return allowed.includes(value) ? value : "";
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
  if (cloned.session) {
    cloned.session = normalizeSessionForCloud(cloned.session);
  }
  return cloned;
}

function normalizeSessionForCloud(session) {
  const normalized = { ...session };
  normalized.userId = normalizeCloudUserId(normalized.userId);
  return normalized;
}

function normalizeCloudUserId(userId) {
  const value = String(userId || "").trim();
  if (/^u_student_/i.test(value)) {
    return `user_s_${value.slice("u_student_".length)}`;
  }
  if (/^student_/i.test(value)) {
    return `user_s_${value.slice("student_".length)}`;
  }
  if (/^u_teacher_/i.test(value)) {
    return `user_t_${value.slice("u_teacher_".length)}`;
  }
  if (/^teacher_/i.test(value)) {
    return `user_t_${value.slice("teacher_".length)}`;
  }
  if (/^u_admin_/i.test(value)) {
    return `user_admin_${value.slice("u_admin_".length)}`;
  }
  return value;
}

function buildCacheKey(name, data) {
  return `${CLIENT_CACHE_VERSION}:${name}:${stableSerialize(data)}`;
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
