'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

function createMockDb(seed = {}) {
  const collections = new Map()

  for (const [name, items] of Object.entries(seed)) {
    collections.set(name, items.map(clone))
  }

  function ensureCollection(name) {
    if (!collections.has(name)) {
      collections.set(name, [])
    }
    return collections.get(name)
  }

  function matchDoc(doc, query) {
    return Object.entries(query).every(([key, value]) => doc[key] === value)
  }

  function queryBuilder(items) {
    let current = items.slice()
    return {
      where(query) {
        current = current.filter(doc => matchDoc(doc, query))
        return this
      },
      limit(count) {
        current = current.slice(0, count)
        return this
      },
      get() {
        return Promise.resolve({ data: current.map(clone) })
      }
    }
  }

  return {
    collection(name) {
      const docs = ensureCollection(name)
      return {
        add(doc) {
          const stored = clone(doc)
          if (!stored._id) {
            stored._id = `${name}_${docs.length + 1}`
          }
          docs.push(stored)
          return Promise.resolve({ id: stored._id })
        },
        doc(id) {
          return {
            get() {
              const item = docs.find(doc => doc._id === id)
              return Promise.resolve({ data: item ? [clone(item)] : [] })
            },
            update(updateDoc) {
              const item = docs.find(doc => doc._id === id)
              if (!item) {
                return Promise.resolve({ updated: 0 })
              }
              Object.assign(item, clone(updateDoc))
              return Promise.resolve({ updated: 1 })
            }
          }
        },
        where(query) {
          return queryBuilder(docs.filter(doc => matchDoc(doc, query)))
        },
        limit(count) {
          return queryBuilder(docs).limit(count)
        }
      }
    },
    snapshot(name) {
      return ensureCollection(name).map(clone)
    }
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function loadCloudFunction(filePath, mockDb) {
  const code = fs.readFileSync(filePath, 'utf8')
  const sandbox = {
    exports: {},
    module: { exports: {} },
    uniCloud: {
      database() {
        return mockDb
      }
    },
    console,
    Date,
    Math,
    JSON,
    String,
    Number,
    Boolean,
    RegExp,
    Object,
    Array,
    Promise,
    setTimeout,
    clearTimeout,
    Buffer,
    require,
    __dirname: path.dirname(filePath),
    __filename: filePath
  }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox, { filename: filePath })
  return sandbox.exports.main || sandbox.module.exports.main
}

function loadFallbackModule(filePath) {
  const code = fs.readFileSync(filePath, 'utf8').replace(/^export\s+/mg, '')
  const sandbox = {
    console,
    Date,
    Math,
    JSON,
    String,
    Number,
    Boolean,
    RegExp,
    Object,
    Array,
    Promise,
    setTimeout,
    clearTimeout,
    Buffer,
    require,
    globalThis: {}
  }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox, { filename: filePath })
  return sandbox
}

async function main() {
  const db = createMockDb({
    courses: [
      {
        _id: 'c_software_design',
        course_code: 'JC3506',
        name: 'Software Design and Implementation'
      }
    ],
    class_sessions: [
      {
        _id: 'cs_001',
        course_offering_id: 'c_software_design',
        session_date: '2026-05-25',
        status: 'scheduled',
        created_at: 1,
        updated_at: 1
      }
    ],
    attendance_records: [
      {
        _id: 'att_001',
        student_id: 'u_student_001',
        studentId: 'u_student_001',
        course_offering_id: 'c_software_design',
        courseId: 'c_software_design',
        class_session_id: 'cs_001',
        attendance_date: '2026-05-25',
        date: '2026-05-25',
        status: 'absent',
        source: 'location',
        created_at: 1,
        updated_at: 1
      }
    ]
  })

  const submitLeave = loadCloudFunction(path.join(__dirname, '..', 'uniCloud-aliyun', 'cloudfunctions', 'submit-leave', 'index.js'), db)
  const reviewLeave = loadCloudFunction(path.join(__dirname, '..', 'uniCloud-aliyun', 'cloudfunctions', 'review-leave', 'index.js'), db)
  const cancelLeave = loadCloudFunction(path.join(__dirname, '..', 'uniCloud-aliyun', 'cloudfunctions', 'cancel-leave', 'index.js'), db)

  const studentSession = {
    role: 'student',
    userId: 'u_student_001',
    displayName: 'Alice Chen'
  }
  const teacherSession = {
    role: 'teacher',
    userId: 'u_teacher_001',
    displayName: 'Dr. Zhang'
  }

  const submitResult = await submitLeave({
    session: studentSession,
    courseId: 'c_software_design',
    date: '2026-05-25',
    reasonType: 'sick',
    reasonDetail: 'Fever and doctor visit.'
  })

  assert.strictEqual(submitResult.ok, true, 'submit should succeed')
  assert.strictEqual(submitResult.leave.status, 'pending')
  assert.strictEqual(submitResult.leave.reasonType, 'sick')

  const leaveId = submitResult.leave._id
  const reviewResult = await reviewLeave({
    session: teacherSession,
    leaveId,
    decision: 'approved',
    reviewComment: 'Approved for one day sick leave.'
  })

  assert.strictEqual(reviewResult.ok, true, 'review should succeed')
  assert.strictEqual(reviewResult.leave.status, 'approved')

  const approvedAttendance = db.snapshot('attendance_records').find(item => item._id === 'att_001')
  assert.strictEqual(approvedAttendance.status, 'on_leave', 'attendance should be on_leave after approval')

  const cancelResult = await cancelLeave({
    session: studentSession,
    leaveId
  })

  assert.strictEqual(cancelResult.ok, true, 'cancel should succeed')
  assert.strictEqual(cancelResult.leave.status, 'cancelled')

  const restoredAttendance = db.snapshot('attendance_records').find(item => item._id === 'att_001')
  assert.strictEqual(restoredAttendance.status, 'absent', 'attendance should be restored after cancel')
  assert.strictEqual(restoredAttendance.source, 'location', 'attendance source should be restored after cancel')

  console.log('submit-leave result:')
  console.log(JSON.stringify(submitResult, null, 2))
  console.log('review-leave result:')
  console.log(JSON.stringify(reviewResult, null, 2))
  console.log('cancel-leave result:')
  console.log(JSON.stringify(cancelResult, null, 2))
  console.log('attendance snapshot:')
  console.log(JSON.stringify(db.snapshot('attendance_records'), null, 2))
  console.log('leave request snapshot:')
  console.log(JSON.stringify(db.snapshot('leave_requests'), null, 2))
  console.log('leave session snapshot:')
  console.log(JSON.stringify(db.snapshot('leave_request_sessions'), null, 2))
  console.log('audit log snapshot:')
  console.log(JSON.stringify(db.snapshot('audit_logs'), null, 2))

  const fallbackModule = loadFallbackModule(path.join(__dirname, '..', 'common', 'api.js'))
  const fallbackSubmit = await fallbackModule.callAiemsFunction('submit-leave', {
    session: studentSession,
    courseId: 'c_process_management',
    date: '2026-05-27',
    reasonType: 'personal',
    reasonDetail: 'Family errand.'
  })
  const fallbackReview = await fallbackModule.callAiemsFunction('review-leave', {
    session: teacherSession,
    leaveId: fallbackSubmit.leave._id,
    decision: 'approved',
    reviewComment: 'Approved in fallback flow.'
  })
  const fallbackCancel = await fallbackModule.callAiemsFunction('cancel-leave', {
    session: studentSession,
    leaveId: fallbackSubmit.leave._id
  })

  assert.strictEqual(fallbackSubmit.ok, true, 'fallback submit should succeed')
  assert.strictEqual(fallbackReview.ok, true, 'fallback review should succeed')
  assert.strictEqual(fallbackCancel.ok, true, 'fallback cancel should succeed')

  const fallbackDashboard = await fallbackModule.callAiemsFunction('get-dashboard-data', {
    session: studentSession
  })

  console.log('fallback submit result:')
  console.log(JSON.stringify(fallbackSubmit, null, 2))
  console.log('fallback review result:')
  console.log(JSON.stringify(fallbackReview, null, 2))
  console.log('fallback cancel result:')
  console.log(JSON.stringify(fallbackCancel, null, 2))
  console.log('fallback dashboard snapshot:')
  console.log(JSON.stringify(fallbackDashboard, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})