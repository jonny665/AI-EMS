"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (session.role !== "admin" || !session.userId) {
    return { ok: false, message: "Only administrators can delete accounts." };
  }

  const userId = String(event.userId || event.accountId || "").trim();
  if (!userId) {
    return { ok: false, message: "Account id is required." };
  }
  if (userId === session.userId) {
    return { ok: false, message: "You cannot delete the current admin account." };
  }

  const [
    users,
    students,
    teachers,
    enrollments,
    leaveRequests,
    attendanceRecords,
    evaluations,
    materials,
    offerings,
  ] = await Promise.all([
    readCollection("users"),
    readCollection("students"),
    readCollection("teachers"),
    readCollection("enrollments"),
    readCollection("leave_requests"),
    readCollection("attendance_records"),
    readCollection("course_evaluations"),
    readCollection("course_materials"),
    readCollection("course_offerings"),
  ]);

  const user = users.find((item) => item._id === userId) || null;
  if (!user) {
    return { ok: false, message: "Account was not found." };
  }

  const student = students.find((item) => item.user_id === userId) || null;
  const teacher = teachers.find((item) => item.user_id === userId) || null;
  const now = Date.now();
  const removed = {
    users: 0,
    students: 0,
    teachers: 0,
    enrollments: 0,
    leaveRequests: 0,
    attendanceRecords: 0,
    evaluations: 0,
    materials: 0,
  };

  if (student) {
    const studentId = student._id;
    removed.enrollments = await removeMatching("enrollments", enrollments, (item) => item.student_id === studentId);
    removed.leaveRequests = await removeMatching("leave_requests", leaveRequests, (item) => item.student_id === studentId);
    removed.attendanceRecords = await removeMatching("attendance_records", attendanceRecords, (item) => item.student_id === studentId);
    removed.evaluations = await removeMatching("course_evaluations", evaluations, (item) => item.student_id === studentId);
    await db.collection("students").doc(studentId).remove();
    removed.students = 1;
  }

  if (teacher) {
    const teacherId = teacher._id;
    removed.materials = await removeMatching("course_materials", materials, (item) =>
      item.teacher_id === teacherId ||
      item.uploader_user_id === userId,
    );
    await removeTeacherFromOfferings(teacherId, userId, offerings, now);
    await db.collection("teachers").doc(teacherId).remove();
    removed.teachers = 1;
  }

  await db.collection("users").doc(userId).remove();
  removed.users = 1;

  await writeAudit("admin.user.delete", session, userId, {
    user,
    student,
    teacher,
  }, removed);

  return {
    ok: true,
    data: {
      deletedAccountId: userId,
      removed,
    },
  };
};

async function readCollection(name, limit = 1000) {
  try {
    const result = await db.collection(name).limit(limit).get();
    return result.data || [];
  } catch (error) {
    console.warn(`[delete-admin-account] failed to read ${name}.`, error);
    return [];
  }
}

async function removeMatching(collectionName, rows, predicate) {
  const matched = (rows || []).filter(predicate);
  for (const item of matched) {
    await db.collection(collectionName).doc(item._id).remove();
  }
  return matched.length;
}

async function removeTeacherFromOfferings(teacherId, userId, offerings, now) {
  for (const offering of offerings || []) {
    const teacherIds = Array.isArray(offering.teacher_ids) ? offering.teacher_ids : [];
    const nextTeacherIds = teacherIds.filter((id) => id !== teacherId && id !== userId);
    if (nextTeacherIds.length === teacherIds.length) {
      continue;
    }
    await db.collection("course_offerings").doc(offering._id).update({
      teacher_ids: nextTeacherIds,
      updated_at: now,
    });
  }
}

async function writeAudit(action, session, targetId, before, after) {
  try {
    await db.collection("audit_logs").add({
      actor_user_id: session.userId,
      action,
      target_collection: "users",
      target_id: targetId,
      before: before || {},
      after: after || {},
      ip: session.ip || "",
      user_agent: session.userAgent || "",
      created_at: Date.now(),
    });
  } catch (error) {
    console.warn("[delete-admin-account] audit write skipped.", error);
  }
}
