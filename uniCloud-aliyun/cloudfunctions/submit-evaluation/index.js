'use strict';

const crypto = require('crypto');
const db = uniCloud.database();

const SCORE_KEYS = ['content', 'teaching_method', 'difficulty', 'workload', 'achievement', 'overall'];

exports.main = async (event = {}, context = {}) => {
  const auth = context.auth || {};
  const uid = String(auth.uid || auth.user_id || auth.userId || 'test_user');
  const role = String(auth.role || 'student');

  if (role !== 'student') {
    return { code: 403, message: 'Only students can submit course evaluations', data: null };
  }

  const payload = normalizePayload(event);
  if (!payload.courseId || !payload.courseOfferingId) {
    return { code: 400, message: 'Missing required parameters (course ID / course offering ID)', data: null };
  }
  if (!payload.feedbackText.trim()) {
    return { code: 400, message: 'Missing required parameters (feedback text)', data: null };
  }
  if (payload.feedbackText.length > 500) {
    return { code: 400, message: 'Evaluation content cannot exceed 500 characters', data: null };
  }

  const scores = buildScores(payload);
  const scoreValidation = validateScores(scores);
  if (!scoreValidation.ok) {
    return { code: 400, message: scoreValidation.message, data: null };
  }

  try {
    const tokenHash = crypto
      .createHash('md5')
      .update(`${uid}:${payload.courseOfferingId}`)
      .digest('hex');

    const duplicateCheck = await db
      .collection('course_evaluations')
      .where({ token_hash: tokenHash })
      .limit(1)
      .get();

    if (duplicateCheck.data && duplicateCheck.data.length > 0) {
      return { code: 400, message: 'You have already submitted an evaluation for this course', data: null };
    }

    const courseMeta = await loadCourseOffering(payload.courseOfferingId);
    const resolvedCourseId = payload.courseId || (courseMeta && courseMeta.course_id) || payload.courseOfferingId;
    const resolvedCourseName = payload.courseName || (courseMeta && (courseMeta.name || courseMeta.course_name)) || resolvedCourseId;
    const teacherIds = normalizeTeacherIds(payload.teacherIds, courseMeta);
    const now = Date.now();

    const evaluation = {
      course_id: resolvedCourseId,
      course_offering_id: payload.courseOfferingId,
      course_name: resolvedCourseName,
      teacher_ids: teacherIds,
      token_hash: tokenHash,
      scores,
      difficulty_score: Number(scores.difficulty),
      workload_score: Number(scores.workload),
      feedback_text: payload.feedbackText,
      status: 'submitted',
      submitted_at: now,
      created_at: now,
      updated_at: now
    };

    const insertResult = await db.collection('course_evaluations').add(evaluation);
    await writeAudit(uid, 'submit_evaluation', payload.courseOfferingId, null, evaluation);

    return {
      code: 200,
      message: 'Evaluation submitted successfully, automatically anonymized',
      data: {
        evaluation: {
          _id: insertResult.id,
          course_id: evaluation.course_id,
          course_offering_id: evaluation.course_offering_id,
          course_name: evaluation.course_name,
          teacher_ids: evaluation.teacher_ids,
          scores: evaluation.scores,
          difficulty_score: evaluation.difficulty_score,
          workload_score: evaluation.workload_score,
          feedback_text: evaluation.feedback_text,
          status: evaluation.status,
          submitted_at: evaluation.submitted_at
        }
      }
    };
  } catch (error) {
    console.error('Failed to submit evaluation:', error);
    return { code: 500, message: 'Server error, please try again later', data: null };
  }
};

function normalizePayload(event) {
  const courseId = String(event.course_id || event.courseId || '').trim();
  const courseOfferingId = String(event.course_offering_id || event.courseOfferingId || courseId || '').trim();
  const courseName = String(event.course_name || event.courseName || '').trim();
  const feedbackText = String(event.feedback_text || event.content || event.feedback || '').trim();
  const rating = toScoreNumber(event.rating);

  return {
    courseId: courseId || courseOfferingId,
    courseOfferingId,
    courseName,
    feedbackText,
    teacherIds: Array.isArray(event.teacher_ids) ? event.teacher_ids : [],
    rating,
    scores: event.scores && typeof event.scores === 'object' ? event.scores : null
  };
}

function buildScores(payload) {
  const baseScore = payload.rating && payload.rating >= 1 && payload.rating <= 5 ? payload.rating : 0;
  const sourceScores = payload.scores || {};
  const overall = toScoreNumber(sourceScores.overall ?? payload.rating ?? 0);

  const scores = {};
  for (const key of SCORE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(sourceScores, key)) {
      scores[key] = toScoreNumber(sourceScores[key]);
    } else if (key === 'overall') {
      scores[key] = overall || baseScore;
    } else if (baseScore > 0) {
      scores[key] = baseScore;
    } else {
      scores[key] = overall || 0;
    }
  }

  if (!scores.overall) {
    scores.overall = baseScore || 0;
  }

  return scores;
}

function validateScores(scores) {
  for (const key of SCORE_KEYS) {
    const value = Number(scores[key]);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      return { ok: false, message: `Score "${key}" must be between 1 and 5` };
    }
  }
  return { ok: true };
}

function toScoreNumber(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return 0;
  }
  return numberValue;
}

async function loadCourseOffering(courseOfferingId) {
  try {
    const result = await db.collection('course_offerings').doc(courseOfferingId).get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    return null;
  }
}

function normalizeTeacherIds(explicitTeacherIds, courseMeta) {
  if (Array.isArray(explicitTeacherIds) && explicitTeacherIds.length > 0) {
    return explicitTeacherIds;
  }
  if (courseMeta && Array.isArray(courseMeta.teacher_ids)) {
    return courseMeta.teacher_ids;
  }
  return [];
}

async function writeAudit(actorUserId, action, targetId, before, after) {
  try {
    await db.collection('audit_logs').add({
      actor_user_id: actorUserId,
      action,
      target_collection: 'course_evaluations',
      target_id: targetId,
      before,
      after,
      created_at: Date.now()
    });
  } catch (error) {
    console.warn('[submit-evaluation] audit write skipped.', error);
  }
}