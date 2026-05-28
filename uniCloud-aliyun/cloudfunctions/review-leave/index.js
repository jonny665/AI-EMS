"use strict";

const db = uniCloud.database();

exports.main = async (event) => {
  const session = event.session || {};

  if (!["teacher", "admin"].includes(session.role)) {
    return {
      ok: false,
      message: "Only teachers or administrators can review leave requests.",
    };
  }

  const decision = String(event.decision || "").trim();
  if (!["approved", "rejected"].includes(decision)) {
    return {
      ok: false,
      message: 'Decision must be "approved" or "rejected".',
    };
  }

  const leaveId = String(event.leaveId || "").trim();
  const reviewComment = String(
    event.reviewComment || event.comment || "",
  ).trim();
  if (!leaveId) {
    return { ok: false, message: "Leave request id is required." };
  }

  const leaveResult = await db.collection("leave_requests").doc(leaveId).get();
  const leave = leaveResult.data && leaveResult.data[0];
  if (!leave) {
    return { ok: false, message: "Leave request not found." };
  }

  if (leave.status !== "pending") {
    return { ok: false, message: "Leave request has already been processed." };
  }

  const now = Date.now();
  const normalizedLeave = normalizeLeave(leave);
  const before = formatLeaveView(normalizedLeave);
  const leaveUpdate = {
    status: decision,
    reviewer_user_id: session.userId,
    reviewerUserId: session.userId,
    reviewer_name: session.displayName || "",
    reviewerName: session.displayName || "",
    review_comment: reviewComment,
    reviewComment: reviewComment,
    reviewed_at: now,
    reviewedAt: now,
    updated_at: now,
    updatedAt: now,
  };

  await db.collection("leave_requests").doc(leaveId).update(leaveUpdate);

  let syncResult = null;
  if (decision === "approved") {
    syncResult = await syncAttendance(normalizedLeave, now);
  }

  await writeAudit("leave.review", session, leaveId, before, {
    ...before,
    ...leaveUpdate,
  });

  return {
    ok: true,
    leave: formatLeaveView({
      ...normalizedLeave,
      ...leaveUpdate,
      _id: leaveId,
    }),
    sync: syncResult,
  };
};

async function syncAttendance(leave, now) {
  const classSessionId = await resolveClassSessionId(leave);
  const attendanceResult = await db
    .collection("attendance_records")
    .where({
      student_id: leave.student_id,
      course_offering_id: leave.course_offering_id,
      attendance_date: leave.leave_date,
    })
    .limit(1)
    .get();
  const existingAttendance = attendanceResult.data && attendanceResult.data[0];
  const previousStatus = existingAttendance
    ? existingAttendance.status
    : "absent";
  const previousSource = existingAttendance
    ? existingAttendance.source || "system_import"
    : "system_import";

  let attendanceRecordId = existingAttendance ? existingAttendance._id : "";
  if (existingAttendance) {
    await db
      .collection("attendance_records")
      .doc(existingAttendance._id)
      .update({
        studentId: leave.student_id,
        student_id: leave.student_id,
        courseId: leave.course_offering_id,
        course_offering_id: leave.course_offering_id,
        date: leave.leave_date,
        attendance_date: leave.leave_date,
        status: "on_leave",
        source: "leave_auto",
        leave_request_id: leave._id,
        leaveRequestId: leave._id,
        updated_at: now,
        updatedAt: now,
      });
  } else {
    const createdAttendance = await db.collection("attendance_records").add({
      student_id: leave.student_id,
      studentId: leave.student_id,
      course_offering_id: leave.course_offering_id,
      courseId: leave.course_offering_id,
      class_session_id: classSessionId,
      attendance_date: leave.leave_date,
      date: leave.leave_date,
      status: "on_leave",
      source: "leave_auto",
      leave_request_id: leave._id,
      leaveRequestId: leave._id,
      created_at: now,
      createdAt: now,
      updated_at: now,
      updatedAt: now,
    });
    attendanceRecordId = createdAttendance.id;
  }

  const sessionResult = await db
    .collection("leave_request_sessions")
    .where({
      leave_request_id: leave._id,
      class_session_id: classSessionId,
    })
    .limit(1)
    .get();
  const existingSession = sessionResult.data && sessionResult.data[0];
  const sessionDoc = {
    leave_request_id: leave._id,
    class_session_id: classSessionId,
    attendance_record_id: attendanceRecordId,
    previous_status: previousStatus,
    previous_source: previousSource,
    created_at: now,
    updated_at: now,
  };

  if (existingSession) {
    await db
      .collection("leave_request_sessions")
      .doc(existingSession._id)
      .update(sessionDoc);
  } else {
    await db.collection("leave_request_sessions").add(sessionDoc);
  }

  return {
    attendanceRecordId,
    classSessionId,
    previousStatus,
    previousSource,
  };
}

async function resolveClassSessionId(leave) {
  try {
    const sessionResult = await db
      .collection("class_sessions")
      .where({
        course_offering_id: leave.course_offering_id,
        session_date: leave.leave_date,
      })
      .limit(1)
      .get();
    const classSession = sessionResult.data && sessionResult.data[0];
    if (classSession) {
      return classSession._id;
    }
  } catch (error) {
    console.warn("[review-leave] class session lookup skipped.", error);
  }

  return `${leave.course_offering_id}_${leave.leave_date}`;
}

function normalizeLeave(leave) {
  return {
    ...leave,
    student_id: leave.student_id || leave.studentId,
    course_offering_id: leave.course_offering_id || leave.courseOfferingId,
    leave_date: leave.leave_date || leave.leaveDate || leave.date,
    reason_type: leave.reason_type || leave.reasonType,
    reason_detail: leave.reason_detail || leave.reasonDetail || leave.reason,
    start_at: leave.start_at || leave.startAt,
    end_at: leave.end_at || leave.endAt,
    reviewer_user_id: leave.reviewer_user_id || leave.reviewerUserId,
    reviewer_name: leave.reviewer_name || leave.reviewerName,
    review_comment: leave.review_comment || leave.reviewComment,
    reviewed_at: leave.reviewed_at || leave.reviewedAt,
    created_at: leave.created_at || leave.createdAt,
    updated_at: leave.updated_at || leave.updatedAt,
  };
}

function formatLeaveView(leave) {
  return {
    ...leave,
    studentId: leave.studentId || leave.student_id,
    student_id: leave.student_id || leave.studentId,
    studentName: leave.studentName || leave.student_name,
    student_name: leave.student_name || leave.studentName,
    courseOfferingId: leave.courseOfferingId || leave.course_offering_id,
    course_offering_id: leave.course_offering_id || leave.courseOfferingId,
    courseId:
      leave.courseId || leave.courseOfferingId || leave.course_offering_id,
    course_id:
      leave.course_id ||
      leave.courseId ||
      leave.courseOfferingId ||
      leave.course_offering_id,
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
    reviewerId: leave.reviewerId || leave.reviewer_user_id,
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
