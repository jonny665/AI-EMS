'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createMockDb(seed = {}) {
  const collections = new Map();

  for (const [name, items] of Object.entries(seed)) {
    collections.set(name, items.map(clone));
  }

  function ensureCollection(name) {
    if (!collections.has(name)) {
      collections.set(name, []);
    }
    return collections.get(name);
  }

  function matches(doc, query) {
    return Object.entries(query).every(([key, expected]) => {
      if (Array.isArray(doc[key]) && !Array.isArray(expected)) {
        return doc[key].includes(expected);
      }
      if (Array.isArray(expected)) {
        return expected.includes(doc[key]);
      }
      return doc[key] === expected;
    });
  }

  function buildQuery(items) {
    let working = items.slice();

    return {
      where(query) {
        working = working.filter((doc) => matches(doc, query));
        return this;
      },
      limit(count) {
        working = working.slice(0, count);
        return this;
      },
      orderBy(field, direction = 'asc') {
        working.sort((left, right) => {
          if (left[field] === right[field]) {
            return 0;
          }
          const comparison = left[field] > right[field] ? 1 : -1;
          return direction === 'desc' ? -comparison : comparison;
        });
        return this;
      },
      field() {
        return this;
      },
      get() {
        return Promise.resolve({ data: working.map(clone) });
      },
      count() {
        return Promise.resolve({ total: working.length });
      }
    };
  }

  return {
    collection(name) {
      const docs = ensureCollection(name);

      return {
        add(doc) {
          const stored = clone(doc);
          if (!stored._id) {
            stored._id = `${name}_${docs.length + 1}`;
          }
          docs.push(stored);
          return Promise.resolve({ id: stored._id });
        },
        doc(id) {
          return {
            get() {
              const item = docs.find((doc) => doc._id === id);
              return Promise.resolve({ data: item ? [clone(item)] : [] });
            },
            update(updateDoc) {
              const item = docs.find((doc) => doc._id === id);
              if (!item) {
                return Promise.resolve({ updated: 0 });
              }
              Object.assign(item, clone(updateDoc));
              return Promise.resolve({ updated: 1 });
            }
          };
        },
        where(query) {
          return buildQuery(docs.filter((doc) => matches(doc, query)));
        },
        limit(count) {
          return buildQuery(docs).limit(count);
        },
        get() {
          return Promise.resolve({ data: docs.map(clone) });
        }
      };
    },
    snapshot(name) {
      return ensureCollection(name).map(clone);
    }
  };
}

function loadFunction(relativePath, mockDb) {
  const filePath = path.join(__dirname, '..', relativePath);
  const code = fs.readFileSync(filePath, 'utf8');
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require,
    console,
    Date,
    Math,
    JSON,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Promise,
    RegExp,
    Buffer,
    setTimeout,
    clearTimeout,
    uniCloud: {
      database() {
        return mockDb;
      }
    },
    __dirname: path.dirname(filePath),
    __filename: filePath
  };

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: filePath });
  return sandbox.module.exports.main || sandbox.exports.main;
}

function baseCourseOffering(overrides = {}) {
  return {
    _id: 'co_001',
    course_id: 'c_software_design',
    semester_id: 'sem_2026_spring',
    section_no: '01',
    teacher_ids: ['t_001', 't_002'],
    capacity: 50,
    enrolled_count: 30,
    selection_status: 'open',
    course_start_date: '2026-01-05',
    course_end_date: '2026-02-02',
    class_start_time: '09:00',
    class_end_time: '10:40',
    created_at: 1,
    updated_at: 1,
    ...overrides
  };
}

function baseStudent(userId, studentId) {
  return {
    _id: studentId,
    user_id: userId,
    name: userId
  };
}

function baseEnrollment(studentId, courseOfferingId, selectedTeacherId = '') {
  return {
    _id: `enroll_${studentId}_${courseOfferingId}`,
    student_id: studentId,
    course_offering_id: courseOfferingId,
    status: 'selected',
    selected_teacher_id: selectedTeacherId
  };
}

function completedSession(courseOfferingId, overrides = {}) {
  return {
    _id: `session_${courseOfferingId}_completed`,
    course_offering_id: courseOfferingId,
    session_date: '2026-02-02',
    start_time: '09:00',
    end_time: '10:40',
    session_end_at: 1,
    status: 'scheduled',
    ...overrides
  };
}

test('submit-evaluation writes doc-compliant anonymous records and blocks duplicates', async () => {
  const db = createMockDb({
    course_offerings: [baseCourseOffering()],
    students: [baseStudent('stu_001', 'student_001')],
    enrollments: [baseEnrollment('student_001', 'co_001', 't_001')],
    class_sessions: [completedSession('co_001')],
    course_evaluations: [],
    audit_logs: []
  });
  const submitEvaluation = loadFunction('uniCloud-aliyun/cloudfunctions/submit-evaluation/index.js', db);

  const firstResult = await submitEvaluation(
    {
      course_id: 'c_software_design',
      course_offering_id: 'co_001',
      course_name: 'Software Design and Implementation',
      scores: {
        content: 5,
        teaching_method: 4,
        difficulty: 3,
        workload: 2,
        achievement: 5,
        overall: 4
      },
      feedback_text: 'The course is practical and the teaching flow is clear.'
    },
    { auth: { uid: 'stu_001', role: 'student' } }
  );

  assert.equal(firstResult.code, 200);
  assert.equal(firstResult.data.evaluation.course_id, 'c_software_design');
  assert.equal(firstResult.data.evaluation.course_offering_id, 'co_001');
  assert.equal(firstResult.data.evaluation.course_name, 'Software Design and Implementation');
  assert.deepEqual(JSON.parse(JSON.stringify(firstResult.data.evaluation.teacher_ids)), ['t_001']);
  assert.deepEqual(JSON.parse(JSON.stringify(firstResult.data.evaluation.scores)), {
    content: 5,
    teaching_method: 4,
    difficulty: 3,
    workload: 2,
    achievement: 5,
    overall: 4
  });
  assert.equal(firstResult.data.evaluation.feedback_text, 'The course is practical and the teaching flow is clear.');
  assert.equal(firstResult.data.evaluation.status, 'submitted');
  assert.match(firstResult.data.evaluation._id, /^course_evaluations_/);

  const storedRows = db.snapshot('course_evaluations');
  assert.equal(storedRows.length, 1);
  assert.match(storedRows[0].token_hash, /^[a-f0-9]{32}$/);
  assert.equal(storedRows[0].submitted_at, storedRows[0].created_at);

  const duplicateResult = await submitEvaluation(
    {
      course_id: 'c_software_design',
      course_offering_id: 'co_001',
      course_name: 'Software Design and Implementation',
      scores: {
        content: 5,
        teaching_method: 4,
        difficulty: 3,
        workload: 2,
        achievement: 5,
        overall: 4
      },
      feedback_text: 'The course is practical and the teaching flow is clear.'
    },
    { auth: { uid: 'stu_001', role: 'student' } }
  );

  assert.equal(duplicateResult.code, 400);
  assert.equal(db.snapshot('course_evaluations').length, 1);
  assert.equal(db.snapshot('audit_logs').length, 1);

  console.log('\n[submit-evaluation stored record]');
  console.log(JSON.stringify(db.snapshot('course_evaluations')[0], null, 2));
});

test('get-evaluation-summary returns anonymous aggregates and no identity fields', async () => {
  const db = createMockDb({
    course_offerings: [
      baseCourseOffering(),
      baseCourseOffering({
        _id: 'co_002',
        course_id: 'c_database_principles',
        semester_id: 'sem_2026_spring',
        section_no: '02',
        teacher_ids: ['t_003'],
        capacity: 40,
        enrolled_count: 35,
        selection_status: 'open'
      })
    ],
    students: [
      baseStudent('stu_001', 'student_001'),
      baseStudent('stu_002', 'student_002'),
      baseStudent('stu_003', 'student_003')
    ],
    enrollments: [
      baseEnrollment('student_001', 'co_001', 't_001'),
      baseEnrollment('student_002', 'co_001', 't_002'),
      baseEnrollment('student_003', 'co_002', 't_003')
    ],
    class_sessions: [
      completedSession('co_001'),
      completedSession('co_002')
    ],
    course_evaluations: [],
    audit_logs: []
  });
  const submitEvaluation = loadFunction('uniCloud-aliyun/cloudfunctions/submit-evaluation/index.js', db);
  const getEvaluationSummary = loadFunction('uniCloud-aliyun/cloudfunctions/get-evaluation-summary/index.js', db);

  await submitEvaluation(
    {
      course_id: 'c_software_design',
      course_offering_id: 'co_001',
      course_name: 'Software Design and Implementation',
      scores: {
        content: 5,
        teaching_method: 4,
        difficulty: 3,
        workload: 3,
        achievement: 5,
        overall: 4
      },
      feedback_text: 'Clear and practical.'
    },
    { auth: { uid: 'stu_001', role: 'student' } }
  );

  await submitEvaluation(
    {
      course_id: 'c_software_design',
      course_offering_id: 'co_001',
      course_name: 'Software Design and Implementation',
      scores: {
        content: 4,
        teaching_method: 3,
        difficulty: 4,
        workload: 2,
        achievement: 4,
        overall: 5
      },
      feedback_text: 'Lots of hands-on exercises.'
    },
    { auth: { uid: 'stu_002', role: 'student' } }
  );

  await submitEvaluation(
    {
      course_id: 'c_database_principles',
      course_offering_id: 'co_002',
      course_name: 'Database Principles',
      scores: {
        content: 3,
        teaching_method: 3,
        difficulty: 4,
        workload: 3,
        achievement: 3,
        overall: 3
      },
      feedback_text: 'Useful but needs more examples.'
    },
    { auth: { uid: 'stu_003', role: 'student' } }
  );

  const summaryResult = await getEvaluationSummary(
    { course_id: 'c_software_design' },
    { auth: { uid: 't_001', role: 'teacher' } }
  );

  assert.equal(summaryResult.code, 200);
  assert.equal(summaryResult.data.summary.length, 1);
  assert.equal(summaryResult.data.anonymous_evaluations.length, 2);

  const summary = summaryResult.data.summary[0];
  assert.equal(summary.course_id, 'c_software_design');
  assert.equal(summary.course_offering_id, 'co_001');
  assert.equal(summary.evaluation_count, 2);
  assert.equal(summary.total_evaluations, 2);
  assert.equal(summary.average_scores.overall, 4.5);
  assert.equal(summary.average_scores.content, 4.5);
  assert.equal(summary.average_scores.teaching_method, 3.5);
  assert.equal(summary.average_scores.difficulty, 3.5);
  assert.equal(summary.average_scores.workload, 2.5);
  assert.equal(summary.average_scores.achievement, 4.5);
  assert.equal(summary.average_rating, '4.5');
  assert.deepEqual(JSON.parse(JSON.stringify(summary.rating_distribution)), { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 });

  for (const evaluation of summaryResult.data.anonymous_evaluations) {
    assert.equal(evaluation.course_id, 'c_software_design');
    assert.equal(evaluation.course_offering_id, 'co_001');
    assert.equal(typeof evaluation.feedback_text, 'string');
    assert.equal(Object.prototype.hasOwnProperty.call(evaluation, 'token_hash'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(evaluation, 'teacher_ids'), false);
  }

  console.log('\n[evaluation-summary detailed report]');
  console.log(JSON.stringify(summaryResult.data, null, 2));
});

test('submit-evaluation rejects courses not taken or not yet completed', async () => {
  const db = createMockDb({
    course_offerings: [
      baseCourseOffering(),
      baseCourseOffering({
        _id: 'co_ongoing',
        course_id: 'c_ai_project',
        teacher_ids: ['t_004'],
        course_start_date: '2026-05-01',
        course_end_date: '2026-07-01'
      })
    ],
    students: [baseStudent('stu_001', 'student_001')],
    enrollments: [baseEnrollment('student_001', 'co_ongoing', 't_004')],
    class_sessions: [
      completedSession('co_001'),
      completedSession('co_ongoing', {
        _id: 'session_co_ongoing_future',
        session_date: '2026-06-15',
        session_end_at: Date.now() + 24 * 60 * 60 * 1000
      })
    ],
    course_evaluations: [],
    audit_logs: []
  });
  const submitEvaluation = loadFunction('uniCloud-aliyun/cloudfunctions/submit-evaluation/index.js', db);

  const notTaken = await submitEvaluation(
    {
      course_id: 'c_software_design',
      course_offering_id: 'co_001',
      scores: {
        content: 5,
        teaching_method: 4,
        difficulty: 3,
        workload: 2,
        achievement: 5,
        overall: 4
      },
      feedback_text: 'I should not be able to evaluate a course I did not take.'
    },
    { auth: { uid: 'stu_001', role: 'student' } }
  );

  assert.equal(notTaken.code, 400);
  assert.match(notTaken.message, /taken/);

  const ongoing = await submitEvaluation(
    {
      course_id: 'c_ai_project',
      course_offering_id: 'co_ongoing',
      scores: {
        content: 5,
        teaching_method: 4,
        difficulty: 3,
        workload: 2,
        achievement: 5,
        overall: 4
      },
      feedback_text: 'This course is still ongoing.'
    },
    { auth: { uid: 'stu_001', role: 'student' } }
  );

  assert.equal(ongoing.code, 400);
  assert.match(ongoing.message, /ended/);
  assert.equal(db.snapshot('course_evaluations').length, 0);
});

test('course-evaluation endpoints enforce access control and validation', async () => {
  const db = createMockDb({
    course_offerings: [baseCourseOffering()],
    students: [baseStudent('stu_001', 'student_001')],
    enrollments: [baseEnrollment('student_001', 'co_001', 't_001')],
    class_sessions: [completedSession('co_001')],
    course_evaluations: [],
    audit_logs: []
  });
  const submitEvaluation = loadFunction('uniCloud-aliyun/cloudfunctions/submit-evaluation/index.js', db);
  const getEvaluationSummary = loadFunction('uniCloud-aliyun/cloudfunctions/get-evaluation-summary/index.js', db);

  const teacherSubmit = await submitEvaluation(
    {
      course_id: 'c_software_design',
      course_offering_id: 'co_001',
      feedback_text: 'Teacher should not be able to submit.'
    },
    { auth: { uid: 't_001', role: 'teacher' } }
  );
  assert.equal(teacherSubmit.code, 403);

  const invalidSubmit = await submitEvaluation(
    {
      course_id: 'c_software_design',
      course_offering_id: 'co_001',
      rating: 0,
      content: 'Invalid score payload.'
    },
    { auth: { uid: 'stu_001', role: 'student' } }
  );
  assert.equal(invalidSubmit.code, 400);

  const studentSummary = await getEvaluationSummary(
    { course_id: 'c_software_design' },
    { auth: { uid: 'stu_001', role: 'student' } }
  );
  assert.equal(studentSummary.code, 403);
});
