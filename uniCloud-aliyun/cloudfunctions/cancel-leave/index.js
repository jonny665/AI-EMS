"use strict";

const db = uniCloud.database();

exports.main = async (event) => {
  const session = event.session || {};

  if (session.role !== "student") {
    return {
      ok: false,
      message: "Only students can cancel their leave requests.",
    };
  }

  const leaveId = String(event.leaveId || "").trim();
  if (!leaveId) {
    return { ok: false, message: "Leave request id is required." };
  }

  const leaveResult = await db.collection("leave_requests").doc(leaveId).get();
  const leave = leaveResult.data && leaveResult.data[0];
  if (!leave) {
    return { ok: false, message: "Leave request not found." };
  }

  if ((leave.student_id || leave.studentId) !== session.userId) {
    return {
      ok: false,
      message: "You can only cancel your own leave request.",
    };
  }

  if (leave.status === "cancelled") {
    return { ok: true, leave: formatLeaveView(leave) };
  }

  if (!["pending", "approved"].includes(leave.status)) {
    return {
      ok: false,
      message: "This leave request can no longer be cancelled.",
    };
  }

  const now = Date.now();
  const normalizedLeave = normalizeLeave(leave);
  const before = formatLeaveView(normalizedLeave);

  await db.collection("leave_requests").doc(leaveId).update({
    status: "cancelled",
    updated_at: now,
    updatedAt: now,
  });

  let restoreResult = null;
  if (leave.status === "approved") {
    restoreResult = await restoreAttendance(normalizedLeave, now);
  }

  await writeAudit("leave.cancel", session, leaveId, before, {
    ...before,
    status: "cancelled",
    updated_at: now,
    updatedAt: now,
  });

  return {
    ok: true,
    leave: formatLeaveView({
      ...normalizedLeave,
      status: "cancelled",
      updated_at: now,
      updatedAt: now,
      _id: leaveId,
    }),
    restore: restoreResult,
  };
};

async function restoreAttendance(leave, now) {
  const sessionResult = await db
    .collection("leave_request_sessions")
    .where({
      leave_request_id: leave._id,
    })
    .get();
  const sessions = sessionResult.data || [];
  const restored = [];

  for (const link of sessions) {
    let attendance = null;
    if (link.attendance_record_id) {
      const attendanceResult = await db
        .collection("attendance_records")
        .doc(link.attendance_record_id)
        .get();
      attendance = attendanceResult.data && attendanceResult.data[0];
    }

    if (!attendance) {
      const attendanceResult = await db
        .collection("attendance_records")
        .where({
          student_id: leave.student_id,
          course_offering_id: leave.course_offering_id,
          attendance_date: leave.leave_date,
        })
        .limit(1)
        .get();
      attendance = attendanceResult.data && attendanceResult.data[0];
    }

    if (!attendance) {
      continue;
    }

    const previousStatus = link.previous_status || "absent";
    const previousSource = link.previous_source || "system_import";
    await db.collection("attendance_records").doc(attendance._id).update({
      studentId: leave.student_id,
      student_id: leave.student_id,
      courseId: leave.course_offering_id,
      course_offering_id: leave.course_offering_id,
      date: leave.leave_date,
      attendance_date: leave.leave_date,
      status: previousStatus,
      source: previousSource,
      leave_request_id: "",
      leaveRequestId: "",
      updated_at: now,
      updatedAt: now,
    });

    restored.push({
      attendanceId: attendance._id,
      previousStatus,
      previousSource,
    });
  }

  return { restored };
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
    console.warn("[cancel-leave] audit write skipped.", error);
  }
}
