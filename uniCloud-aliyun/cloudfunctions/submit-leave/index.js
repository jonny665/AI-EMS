"use strict";

const db = uniCloud.database();

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (session.role !== "student" || !session.userId) {
    return { ok: false, message: "Only students can submit leave requests." };
  }

  const student = await findByField("students", "user_id", session.userId);
  if (!student) {
    return { ok: false, message: "Student profile was not found." };
  }

  const courseOfferingId = String(event.courseOfferingId || event.courseId || "").trim();
  const leaveDate = String(event.leaveDate || event.date || "").trim();
  const reasonType = normalizeReasonType(event.reasonType);
  const reasonDetail = String(event.reasonDetail || event.reason || "").trim();

  if (!courseOfferingId || !leaveDate || !reasonDetail) {
    return { ok: false, message: "Course, leave date, and reason are required." };
  }

  const offering = await findById("course_offerings", courseOfferingId);
  if (!offering) {
    return { ok: false, message: "Course offering was not found." };
  }

  const enrollment = await findEnrollment(student._id, courseOfferingId);
  if (!enrollment) {
    return { ok: false, message: "You are not enrolled in this course offering." };
  }

  let range;
  try {
    range = buildLeaveRange(leaveDate);
  } catch (error) {
    return { ok: false, message: error.message || "Invalid leave date." };
  }

  const now = Date.now();
  const leave = {
    student_id: student._id,
    course_offering_id: courseOfferingId,
    leave_date: leaveDate,
    reason_type: reasonType,
    reason_detail: reasonDetail,
    start_at: range.startAt,
    end_at: range.endAt,
    attachment_urls: Array.isArray(event.attachment_urls) ? event.attachment_urls : [],
    status: "pending",
    reviewer_user_id: "",
    review_comment: "",
    reviewed_at: 0,
    created_at: now,
    updated_at: now,
  };

  const result = await db.collection("leave_requests").add(leave);
  await writeAudit("leave.submit", session, result.id, null, leave);

  return {
    ok: true,
    leave: {
      _id: result.id,
      studentId: student._id,
      studentName: student.name || "",
      courseOfferingId,
      leaveDate,
      date: leaveDate,
      startAt: range.startAt,
      endAt: range.endAt,
      reasonType,
      reasonDetail,
      reason: reasonDetail,
      status: "pending",
      reviewerUserId: "",
      reviewComment: "",
      reviewedAt: 0,
      createdAt: now,
      updatedAt: now,
    },
  };
};

async function findById(collection, id) {
  try {
    const result = await db.collection(collection).doc(id).get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    console.warn(`[submit-leave] ${collection} lookup failed.`, error);
    return null;
  }
}

async function findByField(collection, field, value) {
  try {
    const result = await db.collection(collection).where({ [field]: value }).limit(1).get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    console.warn(`[submit-leave] ${collection} lookup failed.`, error);
    return null;
  }
}

async function findEnrollment(studentId, courseOfferingId) {
  try {
    const result = await db
      .collection("enrollments")
      .where({ student_id: studentId, course_offering_id: courseOfferingId })
      .limit(1)
      .get();
    const row = result.data && result.data[0];
    return row && row.status !== "dropped" ? row : null;
  } catch (error) {
    console.warn("[submit-leave] enrollment lookup failed.", error);
    return null;
  }
}

function normalizeReasonType(reasonType) {
  const value = String(reasonType || "").trim();
  const allowed = ["sick", "personal", "official", "other"];
  return allowed.includes(value) ? value : "other";
}

function buildLeaveRange(leaveDate) {
  const start = new Date(`${leaveDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid leave date.");
  }

  const end = new Date(start.getTime());
  end.setHours(23, 59, 59, 999);

  return {
    startAt: start.getTime(),
    endAt: end.getTime(),
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
    console.warn("[submit-leave] audit write skipped.", error);
  }
}
