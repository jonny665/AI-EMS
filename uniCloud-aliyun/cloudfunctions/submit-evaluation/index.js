"use strict";

const crypto = require("crypto");
const db = uniCloud.database();

const SCORE_KEYS = ["content", "teaching_method", "difficulty", "workload", "achievement", "overall"];

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (session.role !== "student" || !session.userId) {
    return { ok: false, code: 403, message: "Only students can submit course evaluations.", data: null };
  }

  const student = await findByField("students", "user_id", session.userId);
  if (!student) {
    return { ok: false, code: 404, message: "Student profile was not found.", data: null };
  }

  const payload = normalizePayload(event);
  if (!payload.courseOfferingId) {
    return { ok: false, code: 400, message: "Course offering is required.", data: null };
  }
  if (!payload.feedbackText) {
    return { ok: false, code: 400, message: "Feedback text is required.", data: null };
  }
  if (payload.feedbackText.length > 500) {
    return { ok: false, code: 400, message: "Evaluation content cannot exceed 500 characters.", data: null };
  }

  const offering = await findById("course_offerings", payload.courseOfferingId);
  if (!offering) {
    return { ok: false, code: 404, message: "Course offering was not found.", data: null };
  }

  const enrollment = await findEnrollment(student._id, payload.courseOfferingId);
  if (!enrollment) {
    return { ok: false, code: 403, message: "You are not enrolled in this course offering.", data: null };
  }

  const scores = buildScores(payload);
  const scoreValidation = validateScores(scores);
  if (!scoreValidation.ok) {
    return { ok: false, code: 400, message: scoreValidation.message, data: null };
  }

  const tokenHash = hashToken(`${student._id}:${payload.courseOfferingId}`);
  const existing = await findByField("course_evaluations", "token_hash", tokenHash);
  if (existing) {
    return { ok: false, code: 400, message: "You have already submitted an evaluation for this course.", data: null };
  }

  const now = Date.now();
  const evaluation = {
    course_id: offering.course_id,
    course_offering_id: payload.courseOfferingId,
    teacher_ids: Array.isArray(offering.teacher_ids) ? offering.teacher_ids : [],
    token_hash: tokenHash,
    scores,
    difficulty_score: Number(scores.difficulty),
    workload_score: Number(scores.workload),
    feedback_text: payload.feedbackText,
    status: "submitted",
    submitted_at: now,
    created_at: now,
    updated_at: now,
  };

  const insertResult = await db.collection("course_evaluations").add(evaluation);
  await syncEvaluationKnowledge(offering, evaluation);
  await writeAudit(session.userId, "submit_evaluation", payload.courseOfferingId, null, evaluation);

  return {
    ok: true,
    code: 200,
    message: "Evaluation submitted successfully.",
    data: {
      evaluation: {
        _id: insertResult.id,
        courseId: evaluation.course_id,
        courseOfferingId: evaluation.course_offering_id,
        scores: evaluation.scores,
        difficultyScore: evaluation.difficulty_score,
        workloadScore: evaluation.workload_score,
        feedbackText: evaluation.feedback_text,
        status: evaluation.status,
        submittedAt: evaluation.submitted_at,
      },
    },
  };
};

function normalizePayload(event) {
  const courseOfferingId = String(event.course_offering_id || event.courseOfferingId || event.courseId || "").trim();
  const feedbackText = String(event.feedback_text || event.content || event.feedback || "").trim();
  const rating = toScoreNumber(event.rating);
  return {
    courseOfferingId,
    feedbackText,
    rating,
    scores: event.scores && typeof event.scores === "object" ? event.scores : null,
  };
}

async function syncEvaluationKnowledge(offering, evaluation) {
  try {
    const course = await findById("courses", offering.course_id);
    const courseName = course ? [course.course_code, course.name].filter(Boolean).join(" ").trim() : offering.course_id;
    const keywords = [
      "evaluation",
      "course selection",
      "feedback",
      "anonymous",
      course && course.course_code,
      course && course.name,
    ].filter(Boolean);
    await db.collection("knowledge_base").add({
      title: `Course evaluation - ${courseName}`,
      keywords,
      content: `Anonymous course feedback for ${courseName}: overall ${evaluation.scores.overall}/5, difficulty ${evaluation.scores.difficulty}/5, workload ${evaluation.scores.workload}/5. ${evaluation.feedback_text}`,
      category: "course",
      createTime: Date.now(),
      updateTime: Date.now(),
    });
  } catch (error) {
    console.warn("[submit-evaluation] knowledge sync skipped.", error);
  }
}

function buildScores(payload) {
  const baseScore = payload.rating >= 1 && payload.rating <= 5 ? payload.rating : 0;
  const sourceScores = payload.scores || {};
  const scores = {};

  for (const key of SCORE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(sourceScores, key)) {
      scores[key] = toScoreNumber(sourceScores[key]);
    } else {
      scores[key] = baseScore;
    }
  }
  return scores;
}

function validateScores(scores) {
  for (const key of SCORE_KEYS) {
    const value = Number(scores[key]);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      return { ok: false, message: `Score "${key}" must be between 1 and 5.` };
    }
  }
  return { ok: true };
}

function toScoreNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

async function findById(collection, id) {
  const result = await db.collection(collection).doc(id).get();
  return result.data && result.data[0] ? result.data[0] : null;
}

async function findByField(collection, field, value) {
  const result = await db.collection(collection).where({ [field]: value }).limit(1).get();
  return result.data && result.data[0] ? result.data[0] : null;
}

async function findEnrollment(studentId, courseOfferingId) {
  const result = await db
    .collection("enrollments")
    .where({ student_id: studentId, course_offering_id: courseOfferingId })
    .limit(1)
    .get();
  const row = result.data && result.data[0];
  return row && row.status !== "dropped" ? row : null;
}

function hashToken(value) {
  return `sha256$${crypto.createHash("sha256").update(value).digest("hex")}`;
}

async function writeAudit(actorUserId, action, targetId, before, after) {
  try {
    await db.collection("audit_logs").add({
      actor_user_id: actorUserId,
      action,
      target_collection: "course_evaluations",
      target_id: targetId,
      before,
      after,
      created_at: Date.now(),
    });
  } catch (error) {
    console.warn("[submit-evaluation] audit write skipped.", error);
  }
}
