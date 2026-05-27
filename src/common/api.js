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
    { _id: 'a_001', studentId: 'u_student_001', courseId: 'c_software_design', date: '2026-05-25', status: 'absent' },
    { _id: 'a_002', studentId: 'u_student_001', courseId: 'c_process_management', date: '2026-05-27', status: 'present' }
  ],
  leaves: [],
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
    const courses = fallbackState.courses
    const pendingLeaves = fallbackState.leaves.filter(item => item.status === 'pending')
    return {
      ok: true,
      data: {
        user: session,
        courses,
        attendance: fallbackState.attendance,
        leaveRequests: session.role === 'student'
          ? fallbackState.leaves.filter(item => item.studentId === session.userId)
          : pendingLeaves,
        evaluationSummary: buildEvaluationSummary(),
        metrics: {
          courses: courses.length,
          pendingLeaves: pendingLeaves.length,
          evaluations: fallbackState.evaluations.length
        }
      }
    }
  }

  if (name === 'submit-leave') {
    const leave = {
      _id: `leave_${Date.now()}`,
      studentId: session.userId,
      studentName: session.displayName,
      courseId: data.courseId,
      courseName: courseName(data.courseId),
      date: data.date,
      reason: data.reason,
      status: 'pending',
      reviewerId: '',
      reviewerName: '',
      createdAt: new Date().toISOString()
    }
    fallbackState.leaves.unshift(leave)
    return { ok: true, leave }
  }

  if (name === 'review-leave') {
    const leave = fallbackState.leaves.find(item => item._id === data.leaveId)
    if (!leave) return { ok: false, message: 'Leave request not found.' }
    leave.status = data.decision
    leave.reviewerId = session.userId
    leave.reviewerName = session.displayName
    if (data.decision === 'approved') {
      const record = fallbackState.attendance.find(item => item.studentId === leave.studentId && item.courseId === leave.courseId && item.date === leave.date)
      if (record) record.status = 'on_leave'
      else fallbackState.attendance.unshift({ _id: `att_${Date.now()}`, studentId: leave.studentId, courseId: leave.courseId, date: leave.date, status: 'on_leave' })
    }
    return { ok: true, leave }
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

function courseName(courseId) {
  const course = fallbackState.courses.find(item => item._id === courseId)
  return course ? `${course.code} ${course.name}` : courseId
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
