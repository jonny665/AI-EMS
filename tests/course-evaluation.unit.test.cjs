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
  for (const [name, rows] of Object.entries(seed)) {
    collections.set(name, rows.map(clone));
  }

  function ensureCollection(name) {
    if (!collections.has(name)) {
      collections.set(name, []);
    }
    return collections.get(name);
  }

  function matches(doc, query) {
    return Object.entries(query).every(([key, expected]) => {
      const actual = doc[key];
      if (Array.isArray(actual) && !Array.isArray(expected)) {
        return actual.includes(expected);
      }
      if (Array.isArray(expected)) {
        return expected.includes(actual);
      }
      return actual === expected;
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
          if (left[field] === right[field]) return 0;
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
              const row = docs.find((doc) => doc._id === id);
              return Promise.resolve({ data: row ? [clone(row)] : [] });
            },
            update(updateDoc) {
              const row = docs.find((doc) => doc._id === id);
              if (row) Object.assign(row, clone(updateDoc));
              return Promise.resolve({ updated: row ? 1 : 0 });
            },
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
        },
      };
    },
    snapshot(name) {
      return ensureCollection(name).map(clone);
    },
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
      },
    },
    __dirname: path.dirname(filePath),
    __filename: filePath,
  };

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: filePath });
  return sandbox.module.exports.main || sandbox.exports.main;
}

function baseSeed() {
  return {
    students: [{ _id: 'stu_001', user_id: 'u_student_001', name: 'Amy Liu' }],
    teachers: [{ _id: 'tea_001', user_id: 'u_teacher_001', name: 'Dr. Zhang' }],
    courses: [
      {
        _id: 'c_software_design',
        course_code: 'JC3506',
        name: 'Software Design and Implementation',
        credits: 15,
      },
    ],
    course_offerings: [
      {
        _id: 'co_001',
        course_id: 'c_software_design',
        semester_id: 'sem_2026_spring',
        section_no: '01',
        teacher_ids: ['tea_001'],
        capacity: 50,
        enrolled_count: 30,
        selection_status: 'open',
        created_at: 1,
        updated_at: 1,
      },
    ],
    enrollments: [
      {
        _id: 'enr_001',
        student_id: 'stu_001',
        course_offering_id: 'co_001',
        status: 'enrolled',
        selected_at: 1,
        created_at: 1,
        updated_at: 1,
      },
    ],
    course_evaluations: [],
    knowledge_base: [],
    audit_logs: [],
  };
}

test('submit-evaluation writes anonymous records, blocks duplicates, and updates local KB', async () => {
  const db = createMockDb(baseSeed());
  const submitEvaluation = loadFunction('uniCloud-aliyun/cloudfunctions/submit-evaluation/index.js', db);
  const session = { userId: 'u_student_001', role: 'student' };

  const first = await submitEvaluation({
    session,
    courseOfferingId: 'co_001',
    scores: {
      content: 5,
      teaching_method: 4,
      difficulty: 3,
      workload: 2,
      achievement: 5,
      overall: 4,
    },
    feedback: 'The course is practical and the teaching flow is clear.',
  });

  assert.equal(first.ok, true);
  assert.equal(first.code, 200);
  assert.equal(first.data.evaluation.courseOfferingId, 'co_001');
  assert.deepEqual(JSON.parse(JSON.stringify(first.data.evaluation.scores)), {
    content: 5,
    teaching_method: 4,
    difficulty: 3,
    workload: 2,
    achievement: 5,
    overall: 4,
  });

  const stored = db.snapshot('course_evaluations');
  assert.equal(stored.length, 1);
  assert.match(stored[0].token_hash, /^sha256\$/);
  assert.equal(Object.prototype.hasOwnProperty.call(stored[0], 'student_id'), false);
  assert.equal(db.snapshot('knowledge_base').length, 1);

  const duplicate = await submitEvaluation({
    session,
    courseOfferingId: 'co_001',
    rating: 5,
    feedback: 'Duplicate.',
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, 400);
  assert.equal(db.snapshot('course_evaluations').length, 1);
});

test('get-evaluation-summary returns scoped anonymous aggregates', async () => {
  const seed = baseSeed();
  seed.course_evaluations = [
    {
      _id: 'eval_001',
      course_id: 'c_software_design',
      course_offering_id: 'co_001',
      teacher_ids: ['tea_001'],
      token_hash: 'sha256$a',
      scores: { content: 5, teaching_method: 4, difficulty: 3, workload: 3, achievement: 5, overall: 4 },
      feedback_text: 'Clear and practical.',
      status: 'submitted',
      submitted_at: 10,
      created_at: 10,
      updated_at: 10,
    },
    {
      _id: 'eval_002',
      course_id: 'c_software_design',
      course_offering_id: 'co_001',
      teacher_ids: ['tea_001'],
      token_hash: 'sha256$b',
      scores: { content: 4, teaching_method: 3, difficulty: 4, workload: 2, achievement: 4, overall: 5 },
      feedback_text: 'Lots of hands-on exercises.',
      status: 'submitted',
      submitted_at: 20,
      created_at: 20,
      updated_at: 20,
    },
  ];
  const db = createMockDb(seed);
  const getEvaluationSummary = loadFunction('uniCloud-aliyun/cloudfunctions/get-evaluation-summary/index.js', db);

  const result = await getEvaluationSummary({
    session: { userId: 'u_teacher_001', role: 'teacher' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, 200);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].count, 2);
  assert.equal(result.data[0].averageScores.overall, 4.5);
  assert.equal(result.anonymousEvaluations.length, 2);
  for (const evaluation of result.anonymousEvaluations) {
    assert.equal(Object.prototype.hasOwnProperty.call(evaluation, 'token_hash'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(evaluation, 'student_id'), false);
  }
});

test('course-evaluation endpoints enforce roles and score validation', async () => {
  const db = createMockDb(baseSeed());
  const submitEvaluation = loadFunction('uniCloud-aliyun/cloudfunctions/submit-evaluation/index.js', db);
  const getEvaluationSummary = loadFunction('uniCloud-aliyun/cloudfunctions/get-evaluation-summary/index.js', db);

  const teacherSubmit = await submitEvaluation({
    session: { userId: 'u_teacher_001', role: 'teacher' },
    courseOfferingId: 'co_001',
    rating: 5,
    feedback: 'Teacher should not submit.',
  });
  assert.equal(teacherSubmit.code, 403);

  const invalid = await submitEvaluation({
    session: { userId: 'u_student_001', role: 'student' },
    courseOfferingId: 'co_001',
    rating: 0,
    feedback: 'Invalid score.',
  });
  assert.equal(invalid.code, 400);

  const studentSummary = await getEvaluationSummary({
    session: { userId: 'u_student_001', role: 'student' },
  });
  assert.equal(studentSummary.code, 200);
});
