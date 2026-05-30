'use strict';

const crypto = require('crypto');
const db = uniCloud.database();

const SCORE_KEYS = ['content', 'teaching_method', 'difficulty', 'workload', 'achievement', 'overall'];

function normalizeSession(event, context) {
  const session = event.session || {};
  const auth = context.auth || {};
  return {
    userId: String(session.userId || session.uid || session.user_id || auth.uid || auth.user_id || auth.userId || 'test_user'),
    role: String(session.role || auth.role || 'student')
  };
}

exports.main = async (event = {}, context = {}) => {
  const session = normalizeSession(event, context);
  const uid = session.userId;
  const role = session.role;

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
    const [courseMeta, students, enrollments, classSessions] = await Promise.all([
      loadCourseOffering(payload.courseOfferingId),
      readCollection('students'),
      readCollection('enrollments'),
      loadClassSessions(payload.courseOfferingId)
    ]);

    if (!courseMeta) {
      return { code: 404, message: 'Course offering was not found', data: null };
    }

    const student = findByUserId(students, uid);
    if (!student) {
      return { code: 400, message: 'Student profile was not found', data: null };
    }

    const enrollment = findEnrollmentForCourse(enrollments, student, uid, payload.courseOfferingId);
    if (!enrollment) {
      return { code: 400, message: 'You can evaluate only courses you have taken', data: null };
    }

    if (!isCourseCompleted(courseMeta, classSessions)) {
      return { code: 400, message: 'Course evaluations open only after the course has ended', data: null };
    }
    if (Array.isArray(courseMeta.teacher_ids) && courseMeta.teacher_ids.length > 1 && !hasSelectedTeacher(enrollment)) {
      return { code: 400, message: 'Please select a teacher for this course before submitting an evaluation', data: null };
    }

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

    const resolvedCourseId = payload.courseId || (courseMeta && courseMeta.course_id) || payload.courseOfferingId;
    const resolvedCourseName = payload.courseName || (courseMeta && (courseMeta.name || courseMeta.course_name)) || resolvedCourseId;
    const teacherIds = normalizeTeacherIds(payload.teacherIds, courseMeta, enrollment);
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

async function readCollection(name, limit = 1000) {
  try {
    const result = await db.collection(name).limit(limit).get();
    return result.data || [];
  } catch (error) {
    console.warn(`[submit-evaluation] failed to read ${name}.`, error);
    return [];
  }
}

async function loadClassSessions(courseOfferingId) {
  try {
    const result = await db
      .collection('class_sessions')
      .where({ course_offering_id: courseOfferingId })
      .limit(500)
      .get();
    return result.data || [];
  } catch (error) {
    console.warn('[submit-evaluation] class session lookup failed.', error);
    return [];
  }
}

function findByUserId(rows, userId) {
  const keys = buildUserKeys(userId);
  return (
    rows.find((item) => {
      const candidate = String(item.user_id || item.userId || '').trim();
      return keys.has(candidate);
    }) || null
  );
}

function findEnrollmentForCourse(enrollments, student, userId, courseOfferingId) {
  const studentIds = buildStudentIdSet(student, userId);
  return (
    enrollments.find((item) => {
      const itemStudentId = String(item.student_id || item.studentId || '').trim();
      const itemOfferingId = String(item.course_offering_id || item.courseOfferingId || '').trim();
      return item.status !== 'dropped' && studentIds.has(itemStudentId) && itemOfferingId === courseOfferingId;
    }) || null
  );
}

function buildStudentIdSet(student, userId) {
  const ids = buildUserKeys(userId);
  if (student) {
    for (const key of ['_id', 'user_id', 'userId', 'student_no', 'studentNo']) {
      const value = String(student[key] || '').trim();
      if (value) ids.add(value);
    }
  }
  return ids;
}

function buildUserKeys(userId) {
  const value = String(userId || '').trim();
  const keys = new Set(value ? [value] : []);
  addRoleAliases(keys, value, 'student', 's');
  return keys;
}

function addRoleAliases(keys, value, roleName, roleCode) {
  const legacyPrefix = `u_${roleName}_`;
  const userPrefix = `user_${roleCode}_`;
  const entityPrefix = `${roleName}_`;
  const lower = value.toLowerCase();
  let suffix = '';

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

function isCourseCompleted(courseMeta, sessions = [], now = Date.now()) {
  const activeSessions = (sessions || []).filter((item) => item.status !== 'cancelled');
  if (activeSessions.length) {
    return activeSessions.every((item) => {
      const sessionEndAt = getSessionEndAt(item);
      return Boolean(sessionEndAt && sessionEndAt < now);
    });
  }
  const endAt = buildDateTime(courseMeta.course_end_date || courseMeta.endDate || '', courseMeta.class_end_time || courseMeta.classEndTime || '23:59');
  return Boolean(endAt && endAt < now);
}

function hasSelectedTeacher(enrollment) {
  return Boolean(
    String(enrollment && (enrollment.selected_teacher_id || enrollment.selectedTeacherId) || '').trim() ||
    String(enrollment && (enrollment.selected_teacher_user_id || enrollment.selectedTeacherUserId) || '').trim()
  );
}

function getSessionEndAt(item) {
  const explicit = Number(item.session_end_at || item.sessionEndAt || 0);
  if (explicit) return explicit;
  return buildDateTime(item.session_date || item.sessionDate || '', item.end_time || item.endTime || '23:59');
}

function buildDateTime(date, time) {
  const timestamp = Date.parse(`${date}T${time}:00`);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeTeacherIds(explicitTeacherIds, courseMeta, enrollment) {
  const selectedTeacherId = String(enrollment && (enrollment.selected_teacher_id || enrollment.selectedTeacherId) || '').trim();
  if (selectedTeacherId) {
    return [selectedTeacherId];
  }
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
