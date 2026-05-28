'use strict';

const db = uniCloud.database();

const SCORE_KEYS = ['content', 'teaching_method', 'difficulty', 'workload', 'achievement', 'overall'];

exports.main = async (event = {}, context = {}) => {
  const auth = context.auth || {};
  const role = String(auth.role || 'student');

  if (!['teacher', 'admin'].includes(role)) {
    return { code: 403, message: 'No permission to view course evaluations', data: null };
  }

  try {
    const filter = buildFilter(event);
    const queryResult = await db.collection('course_evaluations').get();
    const rows = (queryResult.data || [])
      .filter((item) => item.status !== 'hidden')
      .map(normalizeEvaluation)
      .filter((item) => applyFilter(item, filter));

    const grouped = groupEvaluations(rows);
    const summary = Array.from(grouped.values())
      .map(buildSummaryItem)
      .sort((a, b) => String(a.course_name).localeCompare(String(b.course_name)));
    const anonymousEvaluations = rows
      .slice()
      .sort((a, b) => b.submitted_at - a.submitted_at)
      .map(stripIdentityFields);

    return {
      code: 200,
      message: 'Query successful',
      data: {
        summary,
        anonymous_evaluations: anonymousEvaluations
      }
    };
  } catch (error) {
    console.error('Failed to query evaluations:', error);
    return { code: 500, message: 'Server error, please try again later', data: null };
  }
};

function buildFilter(event) {
  return {
    courseId: String(event.course_id || event.courseId || '').trim(),
    courseOfferingId: String(event.course_offering_id || event.courseOfferingId || '').trim(),
    teacherId: String(event.teacher_id || event.teacherId || '').trim()
  };
}

function applyFilter(row, filter) {
  if (filter.courseId && row.course_id !== filter.courseId) {
    return false;
  }
  if (filter.courseOfferingId && row.course_offering_id !== filter.courseOfferingId) {
    return false;
  }
  if (filter.teacherId && Array.isArray(row.teacher_ids) && !row.teacher_ids.includes(filter.teacherId)) {
    return false;
  }
  return true;
}

function normalizeEvaluation(item) {
  const scores = normalizeScores(item);
  const courseId = String(item.course_id || item.courseId || '').trim();
  const courseOfferingId = String(item.course_offering_id || item.courseOfferingId || courseId || '').trim();
  const feedbackText = String(item.feedback_text || item.content || item.feedback || '').trim();

  return {
    ...item,
    course_id: courseId || courseOfferingId,
    course_offering_id: courseOfferingId,
    teacher_ids: Array.isArray(item.teacher_ids) ? item.teacher_ids : [],
    scores,
    feedback_text: feedbackText,
    rating: Number(scores.overall || item.rating || 0),
    content: feedbackText,
    submitted_at: Number(item.submitted_at || item.create_time || item.created_at || 0)
  };
}

function normalizeScores(item) {
  const sourceScores = item.scores && typeof item.scores === 'object' ? item.scores : {};
  const fallbackRating = Number(item.rating || 0);
  const normalized = {};

  for (const key of SCORE_KEYS) {
    const rawValue = Object.prototype.hasOwnProperty.call(sourceScores, key) ? sourceScores[key] : (key === 'overall' ? fallbackRating : fallbackRating);
    normalized[key] = toDisplayScore(rawValue);
  }

  if (!normalized.overall) {
    normalized.overall = toDisplayScore(fallbackRating);
  }

  return normalized;
}

function toDisplayScore(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 0;
  }
  return Math.max(1, Math.min(5, numberValue));
}

function groupEvaluations(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.course_id}::${row.course_offering_id || row.course_id}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(row);
  }
  return map;
}

function buildSummaryItem(groupRows) {
  const first = groupRows[0];
  const totals = groupRows.length;
  const sums = SCORE_KEYS.reduce((accumulator, key) => {
    accumulator[key] = groupRows.reduce((sum, row) => sum + Number(row.scores[key] || 0), 0);
    return accumulator;
  }, {});
  const averages = SCORE_KEYS.reduce((accumulator, key) => {
    accumulator[key] = totals ? round1(sums[key] / totals) : 0;
    return accumulator;
  }, {});
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of groupRows) {
    const overall = Math.round(Number(row.scores.overall || row.rating || 0));
    if (distribution[overall] !== undefined) {
      distribution[overall] += 1;
    }
  }

  return {
    course_id: first.course_id,
    course_offering_id: first.course_offering_id,
    course_name: first.course_name || first.courseName || '',
    evaluation_count: totals,
    total_evaluations: totals,
    average_scores: averages,
    average_rating: averages.overall.toFixed(1),
    rating_distribution: distribution,
    positive_tags: [],
    negative_tags: [],
    ai_summary: ''
  };
}

function stripIdentityFields(row) {
  return {
    course_id: row.course_id,
    course_offering_id: row.course_offering_id,
    course_name: row.course_name || row.courseName || '',
    scores: row.scores,
    feedback_text: row.feedback_text,
    status: row.status,
    submitted_at: row.submitted_at,
    rating: row.rating,
    content: row.content,
    create_time: row.submitted_at
  };
}

function round1(value) {
  return Math.round(value * 10) / 10;
}