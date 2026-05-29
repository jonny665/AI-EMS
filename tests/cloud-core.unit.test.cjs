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
    return Object.entries(query || {}).every(([key, expected]) => {
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
            },
            remove() {
              const index = docs.findIndex((doc) => doc._id === id);
              if (index < 0) {
                return Promise.resolve({ deleted: 0 });
              }
              docs.splice(index, 1);
              return Promise.resolve({ deleted: 1 });
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

test('ask-assistant uses current user query instead of locking on previous assistant answer', async () => {
  const db = createMockDb({
    knowledge_base: [
      {
        _id: 'kb_eval',
        title: 'Anonymous course evaluation',
        keywords: ['evaluation', 'anonymous', '课程评价', '匿名'],
        content: 'Course evaluation summaries are anonymous.',
      },
      {
        _id: 'kb_grad',
        title: 'Graduation credit requirement',
        keywords: ['graduation', 'credit', '毕业', '学分'],
        content: 'Check credits, core modules and GPA before graduation.',
      },
    ],
    ai_conversations: [],
    ai_messages: [],
    audit_logs: [],
  });
  const askAssistant = loadFunction('uniCloud-aliyun/cloudfunctions/ask-assistant/index.js', db);

  const first = await askAssistant({
    session: { userId: 'user_s_005', role: 'student' },
    query: '课程评价是匿名的吗',
    history: [],
    skipRetentionCleanup: true,
  });
  assert.equal(first.ok, true);
  assert.equal(first.data.sourceTitle, 'Anonymous course evaluation');

  const second = await askAssistant({
    session: { userId: 'user_s_005', role: 'student' },
    query: '毕业学分要求',
    history: [
      { role: 'user', content: '课程评价是匿名的吗' },
      { role: 'assistant', content: 'Course evaluation summaries are anonymous.' },
    ],
    skipRetentionCleanup: true,
  });

  assert.equal(second.ok, true);
  assert.equal(second.data.sourceTitle, 'Graduation credit requirement');
});

test('get-dashboard-data returns enrolled courses for user_s_005 via student mapping', async () => {
  const db = createMockDb({
    courses: [{ _id: 'course_software_design', course_code: 'JC3506', name: 'Software Design', credits: 15 }],
    course_offerings: [{ _id: 'offering_sd_2026s', course_id: 'course_software_design', teacher_ids: ['teacher_001'], section_no: '01' }],
    students: [{ _id: 'student_005', user_id: 'user_s_005', name: 'Emily Zhao' }],
    teachers: [],
    enrollments: [{ _id: 'enroll_005_sd', student_id: 'student_005', course_offering_id: 'offering_sd_2026s', status: 'enrolled' }],
    attendance_records: [],
    leave_requests: [],
    course_evaluations: [],
  });
  const getDashboard = loadFunction('uniCloud-aliyun/cloudfunctions/get-dashboard-data/index.js', db);

  const result = await getDashboard({ session: { userId: 'user_s_005', role: 'student' } });

  assert.equal(result.ok, true);
  assert.equal(result.data.courses.length, 1);
  assert.equal(result.data.courses[0].courseOfferingId, 'offering_sd_2026s');
});

test('save-course-material allows teacher when offering stores user_id in teacher_ids', async () => {
  const db = createMockDb({
    course_offerings: [{ _id: 'offering_sd_2026s', course_id: 'course_software_design', teacher_ids: ['user_t_004'] }],
    course_materials: [],
    teachers: [],
    audit_logs: [],
  });
  const saveMaterial = loadFunction('uniCloud-aliyun/cloudfunctions/save-course-material/index.js', db);

  const result = await saveMaterial({
    session: { userId: 'user_t_004', role: 'teacher' },
    courseOfferingId: 'offering_sd_2026s',
    title: 'Week 1 Slides',
    fileUrl: 'https://example.com/week1.pdf',
    fileType: 'slide',
    isPublicToStudents: true,
  });

  assert.equal(result.ok, true);
  assert.equal(db.snapshot('course_materials').length, 1);
});
