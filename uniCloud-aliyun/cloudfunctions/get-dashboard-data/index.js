"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (!session.userId || !["student", "teacher", "admin"].includes(session.role)) {
    return { ok: false, message: "Login is required." };
  }

  const [courses, offerings, enrollments, students, teachers, attendance, leaves, evaluations] = await Promise.all([
    readCollection("courses"),
    readCollection("course_offerings"),
    readCollection("enrollments"),
    readCollection("students"),
    readCollection("teachers"),
    readCollection("attendance_records"),
    readCollection("leave_requests"),
    readCollection("course_evaluations"),
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
  const coursesView = offerings
    .filter((item) => allowedOfferingIds.has(item._id))
    .map((offering) => buildCourseView(offering, courseMap, teacherMap));

  const studentIds = buildStudentIdSet(student, session.userId);
  const attendanceView = attendance
    .map(normalizeAttendance)
    .filter((item) => {
      if (session.role === "admin") return true;
      if (session.role === "teacher") {
        return allowedOfferingIds.has(item.courseOfferingId);
      }
      return studentIds.has(item.studentId);
    })
    .map((item) => ({
      ...item,
      courseName: buildCourseName(offeringMap.get(item.courseOfferingId), courseMap),
    }));

  const leaveView = leaves
    .map(normalizeLeave)
    .filter((item) => {
      if (session.role === "admin") {
        return item.status === "pending";
      }
      if (session.role === "teacher") {
        return item.status === "pending" && allowedOfferingIds.has(item.courseOfferingId);
      }
      return studentIds.has(item.studentId);
    })
    .map((item) => ({
      ...item,
      courseName: item.courseName || buildCourseName(offeringMap.get(item.courseOfferingId), courseMap),
    }));

  const summary = buildEvaluationSummary(coursesView, evaluations);

  return {
    ok: true,
    data: {
      user: session,
      courses: coursesView,
      attendance: attendanceView,
      leaveRequests: leaveView,
      evaluationSummary: summary,
      metrics: {
        courses: coursesView.length,
        pendingLeaves: leaveView.filter((item) => item.status === "pending").length,
        evaluations: summary.reduce((sum, item) => sum + Number(item.count || 0), 0),
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

function buildCourseView(offering, courseMap, teacherMap = new Map()) {
  const course = courseMap.get(offering.course_id) || {};
  const teacherIds = Array.isArray(offering.teacher_ids) ? offering.teacher_ids : [];
  const teacherNames = teacherIds
    .map((teacherId) => teacherMap.get(teacherId))
    .filter(Boolean)
    .map((teacher) => teacher.name || teacher.display_name || teacher.teacher_no || teacher._id)
    .filter(Boolean);
  return {
    _id: offering._id,
    courseOfferingId: offering._id,
    courseId: offering.course_id || "",
    code: course.course_code || course.code || "",
    name: course.name || "",
    sectionNo: offering.section_no || "",
    teacherIds,
    teacherNames,
    schedule: offering.schedule || "",
    credits: Number(course.credits || course.credit || 0),
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

function mapById(rows) {
  return new Map(rows.filter((item) => item && item._id).map((item) => [item._id, item]));
}
