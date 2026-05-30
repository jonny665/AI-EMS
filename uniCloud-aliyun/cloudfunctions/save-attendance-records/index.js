"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (!["teacher", "admin"].includes(session.role) || !session.userId) {
    return { ok: false, message: "Only teachers or administrators can edit attendance." };
  }

  const courseOfferingId = String(event.courseOfferingId || "").trim();
  const attendanceDate = String(event.attendanceDate || event.date || "").trim();
  const records = Array.isArray(event.records) ? event.records : [];
  if (!courseOfferingId || !attendanceDate || !records.length) {
    return { ok: false, message: "Course, class date, and attendance records are required." };
  }

  const offering = await findById("course_offerings", courseOfferingId);
  if (!offering) {
    return { ok: false, message: "Course offering was not found." };
  }
  if (!(await canManageOffering(session, offering))) {
    return { ok: false, message: "You do not have permission to edit this course attendance." };
  }
  const teacher = session.role === "teacher" ? await findByField("teachers", "user_id", session.userId) : null;

  const classSession = await findClassSession(courseOfferingId, attendanceDate);
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
    const enrollment = await findEnrollment(studentId, courseOfferingId);
    if (session.role === "teacher" && enrollment && !enrollmentBelongsToTeacher(enrollment, teacher, session.userId)) {
      return { ok: false, message: "Teachers can edit attendance only for students who selected them." };
    }
    const existing = await findAttendance(studentId, courseOfferingId, attendanceDate);
    if (existing && existing.status === "on_leave") {
      saved.push(buildAttendanceView(existing));
      continue;
    }

    const payload = {
      student_id: studentId,
      course_offering_id: courseOfferingId,
      class_session_id: classSession._id,
      attendance_date: attendanceDate,
      status,
      source: "teacher_manual",
      remark: String(row.remark || "").trim(),
      updated_at: now,
    };

    let attendanceId = existing ? existing._id : "";
    if (existing) {
      await db.collection("attendance_records").doc(existing._id).update(payload);
    } else {
      const result = await db.collection("attendance_records").add({
        ...payload,
        leave_request_id: "",
        created_at: now,
      });
      attendanceId = result.id;
    }
    saved.push(buildAttendanceView({ ...existing, ...payload, _id: attendanceId, created_at: existing ? existing.created_at : now }));
  }

  await writeAudit("attendance.manual_update", session, courseOfferingId, null, {
    courseOfferingId,
    attendanceDate,
    count: saved.length,
  });

  return { ok: true, data: { attendance: saved } };
};

async function canManageOffering(session, offering) {
  if (session.role === "admin") {
    return true;
  }
  const teacher = await findByField("teachers", "user_id", session.userId);
  const ids = Array.isArray(offering.teacher_ids) ? offering.teacher_ids.map((item) => String(item || "").trim()) : [];
  return ids.includes(String(session.userId || "").trim()) || Boolean(teacher && ids.includes(String(teacher._id || "").trim()));
}

async function findClassSession(courseOfferingId, attendanceDate) {
  const result = await db
    .collection("class_sessions")
    .where({ course_offering_id: courseOfferingId, session_date: attendanceDate })
    .limit(1)
    .get();
  return result.data && result.data[0] ? result.data[0] : null;
}

async function findAttendance(studentId, courseOfferingId, attendanceDate) {
  const result = await db
    .collection("attendance_records")
    .where({ student_id: studentId, course_offering_id: courseOfferingId, attendance_date: attendanceDate })
    .limit(1)
    .get();
  return result.data && result.data[0] ? result.data[0] : null;
}

async function findEnrollment(studentId, courseOfferingId) {
  const result = await db
    .collection("enrollments")
    .where({ student_id: studentId, course_offering_id: courseOfferingId })
    .limit(1)
    .get();
  return result.data && result.data[0] ? result.data[0] : null;
}

async function findById(collection, id) {
  try {
    const result = await db.collection(collection).doc(id).get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    console.warn(`[save-attendance-records] ${collection} lookup failed.`, error);
    return null;
  }
}

async function findByField(collection, field, value) {
  try {
    const result = await db.collection(collection).where({ [field]: value }).limit(1).get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    console.warn(`[save-attendance-records] ${collection} lookup failed.`, error);
    return null;
  }
}

function normalizeAttendanceStatus(status) {
  const value = String(status || "").trim();
  const allowed = ["present", "late", "absent", "excused"];
  return allowed.includes(value) ? value : "";
}

function enrollmentBelongsToTeacher(enrollment, teacher, sessionUserId) {
  const selectedTeacherId = String(enrollment.selected_teacher_id || "").trim();
  const selectedTeacherUserId = String(enrollment.selected_teacher_user_id || "").trim();
  if (!selectedTeacherId && !selectedTeacherUserId) {
    return true;
  }
  return Boolean(
    (teacher && selectedTeacherId && selectedTeacherId === String(teacher._id || "").trim()) ||
    (selectedTeacherUserId && selectedTeacherUserId === String(sessionUserId || "").trim()),
  );
}

function getSessionStartAt(classSession) {
  const explicit = Number(classSession.session_start_at || 0);
  if (explicit) return explicit;
  return buildDateTime(classSession.session_date, classSession.start_time || "00:00");
}

function getSessionEndAt(classSession) {
  const explicit = Number(classSession.session_end_at || 0);
  if (explicit) return explicit;
  return buildDateTime(classSession.session_date, classSession.end_time || "23:59");
}

function buildDateTime(date, time) {
  const timestamp = Date.parse(`${date}T${time}:00`);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildAttendanceView(item) {
  return {
    _id: item._id,
    studentId: item.student_id || "",
    courseOfferingId: item.course_offering_id || "",
    classSessionId: item.class_session_id || "",
    date: item.attendance_date || "",
    status: item.status || "",
    source: item.source || "",
    remark: item.remark || "",
    createdAt: Number(item.created_at || 0),
    updatedAt: Number(item.updated_at || 0),
  };
}

async function writeAudit(action, session, targetId, before, after) {
  try {
    await db.collection("audit_logs").add({
      action,
      actor_user_id: session.userId,
      target_collection: "attendance_records",
      target_id: targetId,
      before,
      after,
      created_at: Date.now(),
    });
  } catch (error) {
    console.warn("[save-attendance-records] audit write skipped.", error);
  }
}
