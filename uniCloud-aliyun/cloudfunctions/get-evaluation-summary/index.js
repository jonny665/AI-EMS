"use strict";

const db = uniCloud.database();

const SCORE_KEYS = ["content", "teaching_method", "difficulty", "workload", "achievement", "overall"];

exports.main = async (event = {}) => {
  const session = event.session || {};
  if (!session.userId || !["student", "teacher", "admin"].includes(session.role)) {
    return { ok: false, code: 403, message: "Login is required.", data: null };
  }

  const [students, teachers, courses, offerings, enrollments, evaluations] = await Promise.all([
    readCollection("students"),
    readCollection("teachers"),
    readCollection("courses"),
    readCollection("course_offerings"),
    readCollection("enrollments"),
    readCollection("course_evaluations"),
  ]);

  const currentStudent = students.find((item) => item.user_id === session.userId) || null;
  const currentTeacher = teachers.find((item) => item.user_id === session.userId) || null;
  const relevantOfferingIds = resolveRelevantOfferingIds(session.role, currentStudent, currentTeacher, offerings, enrollments);
  const indexes = {
    coursesById: mapById(courses),
    offeringsById: mapById(offerings),
  };

  const rows = evaluations
    .filter((item) => item.status !== "hidden")
    .filter((item) => {
      if (session.role === "admin") {
        return true;
      }
      if (session.role === "teacher") {
        return currentTeacher && Array.isArray(item.teacher_ids) && item.teacher_ids.includes(currentTeacher._id);
      }
      return relevantOfferingIds.includes(item.course_offering_id);
    })
    .map((item) => normalizeEvaluation(item, indexes));

  const summary = buildSummary(rows);
  const anonymousEvaluations = ["teacher", "admin"].includes(session.role)
    ? rows.slice().sort((a, b) => b.submittedAt - a.submittedAt).map(stripIdentityFields)
    : [];

  return {
    ok: true,
    code: 200,
    message: "Query successful.",
    data: summary,
    summary,
    anonymousEvaluations,
  };
};

async function readCollection(name, limit = 1000) {
  try {
    const result = await db.collection(name).limit(limit).get();
    return result.data || [];
  } catch (error) {
    console.warn(`[get-evaluation-summary] failed to read ${name}.`, error);
    return [];
  }
}

function resolveRelevantOfferingIds(role, currentStudent, currentTeacher, offerings, enrollments) {
  if (role === "admin") {
    return offerings.map((item) => item._id);
  }
  if (role === "teacher") {
    if (!currentTeacher) {
      return [];
    }
    return offerings
      .filter((item) => Array.isArray(item.teacher_ids) && item.teacher_ids.includes(currentTeacher._id))
      .map((item) => item._id);
  }
  if (!currentStudent) {
    return [];
  }
  return enrollments
    .filter((item) => item.student_id === currentStudent._id && item.status !== "dropped")
    .map((item) => item.course_offering_id);
}

function normalizeEvaluation(item, indexes) {
  const scores = normalizeScores(item);
  const courseName = courseNameFromOffering(item.course_offering_id, indexes) || courseNameFromCourse(item.course_id, indexes);
  const feedbackText = String(item.feedback_text || "").trim();

  return {
    courseId: item.course_id || "",
    courseOfferingId: item.course_offering_id || "",
    courseName,
    teacherIds: Array.isArray(item.teacher_ids) ? item.teacher_ids : [],
    scores,
    feedbackText,
    rating: Number(scores.overall || 0),
    content: feedbackText,
    status: item.status || "",
    submittedAt: Number(item.submitted_at || item.created_at || 0),
  };
}

function normalizeScores(item) {
  const sourceScores = item.scores && typeof item.scores === "object" ? item.scores : {};
  const normalized = {};

  for (const key of SCORE_KEYS) {
    normalized[key] = toDisplayScore(sourceScores[key]);
  }
  return normalized;
}

function buildSummary(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = row.courseOfferingId || row.courseId;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(row);
  }

  return Array.from(grouped.values())
    .map((groupRows) => {
      const first = groupRows[0];
      const totals = groupRows.length;
      const averageScores = {};
      for (const key of SCORE_KEYS) {
        averageScores[key] = round1(
          groupRows.reduce((sum, row) => sum + Number(row.scores[key] || 0), 0) / Math.max(totals, 1),
        );
      }

      return {
        courseId: first.courseId,
        courseOfferingId: first.courseOfferingId,
        courseName: first.courseName,
        count: totals,
        average: averageScores.overall,
        averageRating: averageScores.overall.toFixed(1),
        averageScores,
        feedback: groupRows.map((row) => row.feedbackText).filter(Boolean),
      };
    })
    .sort((a, b) => String(a.courseName).localeCompare(String(b.courseName)));
}

function stripIdentityFields(row) {
  return {
    courseId: row.courseId,
    courseOfferingId: row.courseOfferingId,
    courseName: row.courseName,
    scores: row.scores,
    feedbackText: row.feedbackText,
    status: row.status,
    submittedAt: row.submittedAt,
    rating: row.rating,
    content: row.content,
    createTime: row.submittedAt,
  };
}

function courseNameFromOffering(offeringId, indexes) {
  const offering = indexes.offeringsById.get(offeringId);
  if (!offering) {
    return "";
  }
  return courseNameFromCourse(offering.course_id, indexes);
}

function courseNameFromCourse(courseId, indexes) {
  const course = indexes.coursesById.get(courseId);
  if (!course) {
    return "";
  }
  return [course.course_code, course.name].filter(Boolean).join(" ").trim();
}

function toDisplayScore(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 0;
  }
  return Math.max(1, Math.min(5, numberValue));
}

function mapById(items) {
  return new Map(items.filter((item) => item && item._id).map((item) => [item._id, item]));
}

function round1(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 10) / 10;
}
