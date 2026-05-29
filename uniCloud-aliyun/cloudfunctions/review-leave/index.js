"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (!["teacher", "admin"].includes(session.role) || !session.userId) {
    return { ok: false, message: "Only teachers or administrators can review leave requests." };
  }

  const leaveId = String(event.leaveId || "").trim();
  const decision = String(event.decision || "").trim();
  const reviewComment = String(event.reviewComment || event.comment || "").trim();

  if (!leaveId) {
    return { ok: false, message: "Leave request id is required." };
  }
  if (!["approved", "rejected"].includes(decision)) {
    return { ok: false, message: 'Decision must be "approved" or "rejected".' };
  }

  const leave = await findById("leave_requests", leaveId);
  if (!leave) {
    return { ok: false, message: "Leave request not found." };
  }
  if (leave.status !== "pending") {
    return { ok: false, message: "Leave request has already been processed." };
  }
  if (!(await canReviewLeave(session, leave))) {
    return { ok: false, message: "You do not have permission to review this leave request." };
  }

  const now = Date.now();
  const update = {
    status: decision,
    reviewer_user_id: session.userId,
    review_comment: reviewComment,
    reviewed_at: now,
    updated_at: now,
  };

  await db.collection("leave_requests").doc(leaveId).update(update);

  let sync = null;
  if (decision === "approved") {
    sync = await syncAttendance({ ...leave, _id: leaveId }, now);
  }

  await writeAudit("leave.review", session, leaveId, leave, { ...leave, ...update });

  return {
    ok: true,
    leave: buildLeaveView({ ...leave, ...update, _id: leaveId }),
    sync,
  };
};

async function canReviewLeave(session, leave) {
  if (session.role === "admin") {
    return true;
  }

  const teacher = await findByField("teachers", "user_id", session.userId);
  if (!teacher) {
    return false;
  }

  const offering = await findById("course_offerings", leave.course_offering_id);
  return Boolean(offering && Array.isArray(offering.teacher_ids) && offering.teacher_ids.includes(teacher._id));
}

async function syncAttendance(leave, now) {
  const attendanceDate = leave.leave_date || dateFromTimestamp(leave.start_at);
  const classSessionId = await resolveClassSessionId(leave.course_offering_id, attendanceDate);
  const existing = await findAttendance(leave.student_id, leave.course_offering_id, attendanceDate);
  const previousStatus = existing ? existing.status : "absent";
  const previousSource = existing ? existing.source || "system_import" : "system_import";
  let attendanceRecordId = existing ? existing._id : "";

  if (existing) {
    await db.collection("attendance_records").doc(existing._id).update({
      status: "on_leave",
      source: "leave_auto",
      leave_request_id: leave._id,
      updated_at: now,
    });
  } else {
    const result = await db.collection("attendance_records").add({
      student_id: leave.student_id,
      course_offering_id: leave.course_offering_id,
      class_session_id: classSessionId,
      attendance_date: attendanceDate,
      status: "on_leave",
      source: "leave_auto",
      leave_request_id: leave._id,
      created_at: now,
      updated_at: now,
    });
    attendanceRecordId = result.id;
  }

  await upsertLeaveSession({
    leave_request_id: leave._id,
    class_session_id: classSessionId,
    attendance_record_id: attendanceRecordId,
    previous_status: previousStatus,
    previous_source: previousSource,
    created_at: now,
    updated_at: now,
  });

  return {
    attendanceRecordId,
    classSessionId,
    previousStatus,
    previousSource,
  };
}

async function upsertLeaveSession(link) {
  const result = await db
    .collection("leave_request_sessions")
    .where({
      leave_request_id: link.leave_request_id,
      class_session_id: link.class_session_id,
    })
    .limit(1)
    .get();
  const existing = result.data && result.data[0];

  if (existing) {
    await db.collection("leave_request_sessions").doc(existing._id).update({
      attendance_record_id: link.attendance_record_id,
      previous_status: link.previous_status,
      previous_source: link.previous_source,
      updated_at: link.updated_at,
    });
  } else {
    await db.collection("leave_request_sessions").add(link);
  }
}

async function resolveClassSessionId(courseOfferingId, attendanceDate) {
  const result = await db
    .collection("class_sessions")
    .where({ course_offering_id: courseOfferingId, session_date: attendanceDate })
    .limit(1)
    .get();
  const classSession = result.data && result.data[0];
  return classSession ? classSession._id : `${courseOfferingId}_${attendanceDate}`;
}

async function findAttendance(studentId, courseOfferingId, attendanceDate) {
  const result = await db
    .collection("attendance_records")
    .where({
      student_id: studentId,
      course_offering_id: courseOfferingId,
      attendance_date: attendanceDate,
    })
    .limit(1)
    .get();
  return result.data && result.data[0] ? result.data[0] : null;
}

async function findById(collection, id) {
  const result = await db.collection(collection).doc(id).get();
  return result.data && result.data[0] ? result.data[0] : null;
}

async function findByField(collection, field, value) {
  const result = await db.collection(collection).where({ [field]: value }).limit(1).get();
  return result.data && result.data[0] ? result.data[0] : null;
}

function buildLeaveView(leave) {
  const date = leave.leave_date || dateFromTimestamp(leave.start_at);
  return {
    _id: leave._id,
    studentId: leave.student_id,
    courseOfferingId: leave.course_offering_id,
    leaveDate: date,
    date,
    startAt: Number(leave.start_at || 0),
    endAt: Number(leave.end_at || 0),
    reasonType: leave.reason_type || "",
    reasonDetail: leave.reason_detail || "",
    reason: leave.reason_detail || "",
    status: leave.status || "",
    reviewerUserId: leave.reviewer_user_id || "",
    reviewComment: leave.review_comment || "",
    reviewedAt: Number(leave.reviewed_at || 0),
    createdAt: Number(leave.created_at || 0),
    updatedAt: Number(leave.updated_at || 0),
  };
}

function dateFromTimestamp(value) {
  const timestamp = Number(value || 0);
  return timestamp ? new Date(timestamp).toISOString().slice(0, 10) : "";
}

async function writeAudit(action, session, targetId, before, after) {
  try {
    await db.collection("audit_logs").add({
      action,
      actor_user_id: session.userId,
      target_collection: "leave_requests",
      target_id: targetId,
      before,
      after,
      created_at: Date.now(),
    });
  } catch (error) {
    console.warn("[review-leave] audit write skipped.", error);
  }
}
