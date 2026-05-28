const fallbackState = {
  users: [
    { _id: 'u_student_001', username: 'student001', password: 'demo123', role: 'student', displayName: 'Alice Chen', major: 'Software Engineering' },
    { _id: 'u_teacher_001', username: 'teacher001', password: 'demo123', role: 'teacher', displayName: 'Dr. Zhang', department: 'Computer Science' },
    { _id: 'u_admin_001', username: 'admin001', password: 'demo123', role: 'admin', displayName: 'Academic Admin', department: 'Academic Office' }
  ],
  courses: [
    { _id: 'c_software_design', code: 'JC3506', name: 'Software Design and Implementation', teacherId: 'u_teacher_001', schedule: 'Mon 10:00-12:00', credits: 15 },
    { _id: 'c_process_management', code: 'PM3506', name: 'Software Process Management', teacherId: 'u_teacher_001', schedule: 'Wed 14:00-16:00', credits: 15 }
  ],
  attendance: [
    {
      _id: 'a_001',
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
    },
    {
      _id: 'a_002',
      student_id: 'u_student_001',
      studentId: 'u_student_001',
      course_offering_id: 'c_process_management',
      courseId: 'c_process_management',
      class_session_id: 'cs_002',
      attendance_date: '2026-05-27',
      date: '2026-05-27',
      status: 'present',
      source: 'location',
      created_at: 1,
      updated_at: 1
    }
  ],
  leaves: [],
  leaveRequestSessions: [],
  auditLogs: [],
  evaluations: [
    { _id: 'e_001', courseId: 'c_software_design', rating: 5, feedback: 'The course is practical and useful for project architecture.', anonymousToken: 'anon-demo-1' }
  ],
  knowledge: [
    {
      _id: 'kb_graduation',
      title: 'Graduation credit requirement',
      keywords: ['graduation', 'credit', 'credits', '学分', '毕业'],
      answer: 'The PoC knowledge base states that students should track completed credits and remaining required modules before graduation. Please confirm official requirements with the academic office.'
    },
    {
      _id: 'kb_leave',
      title: 'Leave approval workflow',
      keywords: ['leave', 'absence', '请假', '缺勤', 'attendance'],
      answer: 'Students submit a leave request for a specific course session. After approval by an authorised teacher or administrator, the attendance status is updated to on_leave.'
    },
    {
      _id: 'kb_evaluation',
      title: 'Anonymous course evaluation',
      keywords: ['evaluation', 'feedback', 'anonymous', '评价', '匿名'],
      answer: 'Course evaluations are shown to teachers as aggregated feedback only. The PoC does not expose individual student identities behind evaluation comments.'
    }
  ]
}

function fallbackResult(name, data = {}) {
  const session = data.session || {}

  if (name === 'auth-login') {
    const user = fallbackState.users.find(item => item.username === data.username && item.password === data.password)
    if (!user) return { ok: false, message: 'Invalid demo account or password.' }
    recordAudit('login', user._id, null, null)
    return {
      ok: true,
      user: {
        userId: user._id,
        username: user.username,
        role: user.role,
        displayName: user.displayName
      }
    }
  }

  if (name === 'get-dashboard-data') {
    const courses = fallbackState.courses.map(clone)
    const attendance = fallbackState.attendance.map(normalizeAttendanceView)
    const leaves = fallbackState.leaves.map(normalizeLeaveView)
    const leaveRequests = session.role === 'student'
      ? leaves.filter(item => item.studentId === session.userId)
      : leaves.filter(item => item.status === 'pending')

    return {
      ok: true,
      data: {
        user: session,
        courses,
        attendance: session.role === 'student' ? attendance.filter(item => item.studentId === session.userId) : attendance,
        leaveRequests,
        evaluationSummary: buildEvaluationSummary(),
        metrics: {
          courses: courses.length,
          pendingLeaves: leaves.filter(item => item.status === 'pending').length,
          evaluations: fallbackState.evaluations.length
        }
      }
    }
  }

  if (name === 'submit-leave') {
    return submitLeaveFallback(session, data)
  }

  if (name === 'review-leave') {
    return reviewLeaveFallback(session, data)
  }

  if (name === 'cancel-leave') {
    return cancelLeaveFallback(session, data)
  }

  if (name === 'submit-evaluation') {
    const evaluation = {
      _id: `eval_${Date.now()}`,
      courseId: data.courseId,
      rating: Number(data.rating),
      feedback: data.feedback,
      anonymousToken: `anon_${Date.now()}`
    }
    fallbackState.evaluations.unshift(evaluation)
    return { ok: true, evaluation }
  }

  if (name === 'get-evaluation-summary') {
    return { ok: true, data: buildEvaluationSummary() }
  }

  if (name === 'ask-assistant') {
    const query = String(data.query || '').toLowerCase()
    const hit = fallbackState.knowledge.find(item => item.keywords.some(keyword => query.includes(String(keyword).toLowerCase())))
    if (!hit) {
      return {
        ok: true,
        data: {
          answer: '当前知识库没有足够信息，请联系教务人员确认。',
          sourceTitle: 'Fallback response',
          grounded: false
        }
      }
    }
    return {
      ok: true,
      data: {
        answer: hit.answer,
        sourceTitle: hit.title,
        grounded: true
      }
    }
  }

  return { ok: false, message: `No fallback for ${name}.` }
}

function submitLeaveFallback(session, data) {
  if (session.role !== 'student') {
    return { ok: false, message: 'Only students can submit leave requests.' }
  }

  const courseOfferingId = String(data.courseOfferingId || data.courseId || '').trim()
  const leaveDate = String(data.leaveDate || data.date || '').trim()
  const reasonType = normalizeReasonType(data.reasonType)
  const reasonDetail = String(data.reasonDetail || data.reason || '').trim()

  if (!courseOfferingId || !leaveDate || !reasonDetail) {
    return { ok: false, message: 'Course, leave date, and reason are required.' }
  }

  const course = findCourse(courseOfferingId)
  const courseName = buildCourseName(course, data.courseName || courseOfferingId)
  let range = null
  try {
    range = buildLeaveRange(leaveDate)
  } catch (error) {
    return { ok: false, message: error.message || 'Invalid leave date.' }
  }
  const now = Date.now()
  const leave = normalizeLeaveView({
    _id: `leave_${now}`,
    studentId: session.userId,
    student_id: session.userId,
    studentName: session.displayName,
    student_name: session.displayName,
    courseOfferingId: courseOfferingId,
    course_offering_id: courseOfferingId,
    courseId: courseOfferingId,
    course_id: courseOfferingId,
    courseName,
    course_name: courseName,
    leaveDate,
    leave_date: leaveDate,
    date: leaveDate,
    reasonType,
    reason_type: reasonType,
    reasonDetail,
    reason_detail: reasonDetail,
    reason: reasonDetail,
    startAt: range.startAt,
    start_at: range.startAt,
    endAt: range.endAt,
    end_at: range.endAt,
    status: 'pending',
    reviewerId: '',
    reviewerUserId: '',
    reviewer_user_id: '',
    reviewerName: '',
    reviewer_name: '',
    reviewComment: '',
    review_comment: '',
    reviewedAt: 0,
    reviewed_at: 0,
    createdAt: now,
    created_at: now,
    updatedAt: now,
    updated_at: now
  })

  fallbackState.leaves.unshift(clone(leave))
  recordAudit('leave.submit', session.userId, leave._id, null, leave)
  return { ok: true, leave }
}

function reviewLeaveFallback(session, data) {
  if (!['teacher', 'admin'].includes(session.role)) {
    return { ok: false, message: 'Only teachers or administrators can review leave requests.' }
  }

  const decision = String(data.decision || '').trim()
  if (!['approved', 'rejected'].includes(decision)) {
    return { ok: false, message: 'Decision must be "approved" or "rejected".' }
  }

  const leave = fallbackState.leaves.find(item => item._id === data.leaveId)
  if (!leave) {
    return { ok: false, message: 'Leave request not found.' }
  }

  if (leave.status !== 'pending') {
    return { ok: false, message: 'Leave request has already been processed.' }
  }

  const now = Date.now()
  const before = clone(leave)
  leave.status = decision
  leave.reviewerId = session.userId
  leave.reviewerUserId = session.userId
  leave.reviewer_user_id = session.userId
  leave.reviewerName = session.displayName || ''
  leave.reviewer_name = session.displayName || ''
  leave.reviewComment = String(data.reviewComment || data.comment || '').trim()
  leave.review_comment = leave.reviewComment
  leave.reviewedAt = now
  leave.reviewed_at = now
  leave.updatedAt = now
  leave.updated_at = now

  let sync = null
  if (decision === 'approved') {
    sync = syncAttendanceFallback(leave, now)
  }

  recordAudit('leave.review', session.userId, leave._id, before, leave)
  return { ok: true, leave: clone(leave), sync }
}

function cancelLeaveFallback(session, data) {
  if (session.role !== 'student') {
    return { ok: false, message: 'Only students can cancel their leave requests.' }
  }

  const leave = fallbackState.leaves.find(item => item._id === data.leaveId)
  if (!leave) {
    return { ok: false, message: 'Leave request not found.' }
  }

  if (leave.studentId !== session.userId) {
    return { ok: false, message: 'You can only cancel your own leave request.' }
  }

  if (leave.status === 'cancelled') {
    return { ok: true, leave: clone(leave) }
  }

  if (!['pending', 'approved'].includes(leave.status)) {
    return { ok: false, message: 'This leave request can no longer be cancelled.' }
  }

  const now = Date.now()
  const before = clone(leave)
  leave.status = 'cancelled'
  leave.updatedAt = now
  leave.updated_at = now

  let restore = null
  if (before.status === 'approved') {
    restore = restoreAttendanceFallback(leave, now)
  }

  recordAudit('leave.cancel', session.userId, leave._id, before, leave)
  return { ok: true, leave: clone(leave), restore }
}

function syncAttendanceFallback(leave, now) {
  const classSessionId = `${leave.course_offering_id}_${leave.leave_date}`
  const attendance = fallbackState.attendance.find(item => item.studentId === leave.student_id && item.courseId === leave.course_offering_id && item.date === leave.leave_date)
  const previousStatus = attendance ? attendance.status : 'absent'
  const previousSource = attendance ? (attendance.source || 'system_import') : 'system_import'

  let attendanceRecordId = attendance ? attendance._id : `att_${now}`
  if (attendance) {
    attendance.studentId = leave.student_id
    attendance.student_id = leave.student_id
    attendance.courseId = leave.course_offering_id
    attendance.course_offering_id = leave.course_offering_id
    attendance.date = leave.leave_date
    attendance.attendance_date = leave.leave_date
    attendance.status = 'on_leave'
    attendance.source = 'leave_auto'
    attendance.leaveRequestId = leave._id
    attendance.leave_request_id = leave._id
    attendance.updatedAt = now
    attendance.updated_at = now
  } else {
    fallbackState.attendance.unshift({
      _id: attendanceRecordId,
      studentId: leave.student_id,
      student_id: leave.student_id,
      courseId: leave.course_offering_id,
      course_offering_id: leave.course_offering_id,
      class_session_id: classSessionId,
      attendance_date: leave.leave_date,
      date: leave.leave_date,
      status: 'on_leave',
      source: 'leave_auto',
      leaveRequestId: leave._id,
      leave_request_id: leave._id,
      createdAt: now,
      created_at: now,
      updatedAt: now,
      updated_at: now
    })
  }

  const existingLink = fallbackState.leaveRequestSessions.find(item => item.leave_request_id === leave._id && item.class_session_id === classSessionId)
  const link = {
    leave_request_id: leave._id,
    class_session_id: classSessionId,
    attendance_record_id: attendanceRecordId,
    previous_status: previousStatus,
    previous_source: previousSource,
    created_at: now,
    updated_at: now
  }

  if (existingLink) {
    Object.assign(existingLink, link)
  } else {
    fallbackState.leaveRequestSessions.unshift(clone(link))
  }

  return {
    attendanceRecordId,
    classSessionId,
    previousStatus,
    previousSource
  }
}

function restoreAttendanceFallback(leave, now) {
  const links = fallbackState.leaveRequestSessions.filter(item => item.leave_request_id === leave._id)
  const restored = []

  for (const link of links) {
    let attendance = null
    if (link.attendance_record_id) {
      attendance = fallbackState.attendance.find(item => item._id === link.attendance_record_id) || null
    }
    if (!attendance) {
      attendance = fallbackState.attendance.find(item => item.studentId === leave.student_id && item.courseId === leave.course_offering_id && item.date === leave.leave_date) || null
    }
    if (!attendance) {
      continue
    }

    attendance.status = link.previous_status || 'absent'
    attendance.source = link.previous_source || 'system_import'
    attendance.leaveRequestId = ''
    attendance.leave_request_id = ''
    attendance.updatedAt = now
    attendance.updated_at = now

    restored.push({
      attendanceId: attendance._id,
      previousStatus: attendance.status,
      previousSource: attendance.source
    })
  }

  return { restored }
}

function findCourse(courseOfferingId) {
  return fallbackState.courses.find(item => item._id === courseOfferingId) || null
}

function buildCourseName(course, fallbackName) {
  if (!course) {
    return fallbackName
  }
  const code = course.course_code || course.code || ''
  return code ? `${code} ${course.name || fallbackName}`.trim() : (course.name || fallbackName)
}

function normalizeReasonType(reasonType) {
  const allowed = ['sick', 'personal', 'official', 'other']
  const value = String(reasonType || '').trim()
  return allowed.includes(value) ? value : 'other'
}

function buildLeaveRange(leaveDate) {
  const start = new Date(`${leaveDate}T00:00:00`)
  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid leave date.')
  }
  const end = new Date(start.getTime())
  end.setHours(23, 59, 59, 999)
  return {
    startAt: start.getTime(),
    endAt: end.getTime()
  }
}

function normalizeLeaveView(leave) {
  return {
    ...leave,
    studentId: leave.studentId || leave.student_id,
    student_id: leave.student_id || leave.studentId,
    studentName: leave.studentName || leave.student_name,
    student_name: leave.student_name || leave.studentName,
    courseOfferingId: leave.courseOfferingId || leave.course_offering_id,
    course_offering_id: leave.course_offering_id || leave.courseOfferingId,
    courseId: leave.courseId || leave.courseOfferingId || leave.course_offering_id,
    course_id: leave.course_id || leave.courseId || leave.courseOfferingId || leave.course_offering_id,
    courseName: leave.courseName || leave.course_name,
    course_name: leave.course_name || leave.courseName,
    leaveDate: leave.leaveDate || leave.leave_date,
    leave_date: leave.leave_date || leave.leaveDate,
    date: leave.date || leave.leave_date || leave.leaveDate,
    reasonType: leave.reasonType || leave.reason_type,
    reason_type: leave.reason_type || leave.reasonType,
    reasonDetail: leave.reasonDetail || leave.reason_detail,
    reason_detail: leave.reason_detail || leave.reasonDetail,
    reason: leave.reason || leave.reason_detail || leave.reasonDetail,
    startAt: leave.startAt || leave.start_at,
    start_at: leave.start_at || leave.startAt,
    endAt: leave.endAt || leave.end_at,
    end_at: leave.end_at || leave.endAt,
    reviewerId: leave.reviewerId || leave.reviewer_user_id,
    reviewerUserId: leave.reviewerUserId || leave.reviewer_user_id,
    reviewer_user_id: leave.reviewer_user_id || leave.reviewerUserId,
    reviewerName: leave.reviewerName || leave.reviewer_name,
    reviewer_name: leave.reviewer_name || leave.reviewerName,
    reviewComment: leave.reviewComment || leave.review_comment,
    review_comment: leave.review_comment || leave.reviewComment,
    reviewedAt: leave.reviewedAt || leave.reviewed_at,
    reviewed_at: leave.reviewed_at || leave.reviewedAt,
    createdAt: leave.createdAt || leave.created_at,
    created_at: leave.created_at || leave.createdAt,
    updatedAt: leave.updatedAt || leave.updated_at,
    updated_at: leave.updated_at || leave.updatedAt
  }
}

function normalizeAttendanceView(attendance) {
  return {
    ...attendance,
    studentId: attendance.studentId || attendance.student_id,
    student_id: attendance.student_id || attendance.studentId,
    courseId: attendance.courseId || attendance.course_offering_id,
    course_offering_id: attendance.course_offering_id || attendance.courseId,
    date: attendance.date || attendance.attendance_date,
    attendance_date: attendance.attendance_date || attendance.date,
    leaveRequestId: attendance.leaveRequestId || attendance.leave_request_id,
    leave_request_id: attendance.leave_request_id || attendance.leaveRequestId,
    createdAt: attendance.createdAt || attendance.created_at,
    created_at: attendance.created_at || attendance.createdAt,
    updatedAt: attendance.updatedAt || attendance.updated_at,
    updated_at: attendance.updated_at || attendance.updatedAt
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function recordAudit(action, actorUserId, targetId, before, after) {
  fallbackState.auditLogs.unshift({
    action,
    actor_user_id: actorUserId,
    target_collection: 'leave_requests',
    target_id: targetId,
    before: before ? clone(before) : null,
    after: after ? clone(after) : null,
    created_at: Date.now()
  })
}

function buildEvaluationSummary() {
  return fallbackState.courses.map(course => {
    const evaluations = fallbackState.evaluations.filter(item => item.courseId === course._id)
    const average = evaluations.length
      ? Math.round((evaluations.reduce((sum, item) => sum + Number(item.rating), 0) / evaluations.length) * 10) / 10
      : 0
    return {
      courseId: course._id,
      courseName: `${course.code} ${course.name}`,
      count: evaluations.length,
      average,
      feedback: evaluations.map(item => item.feedback)
    }
  })
}

export async function callAiemsFunction(name, data = {}) {
  try {
    if (typeof uniCloud === 'undefined') {
      return fallbackResult(name, data)
    }
    const response = await uniCloud.callFunction({ name, data })
    return response.result || response
  } catch (error) {
    console.warn(`[AI-EMS] Cloud function ${name} failed, using local fallback.`, error)
    return fallbackResult(name, data)
  }
}

export function getFallbackCourses() {
  return fallbackState.courses
}