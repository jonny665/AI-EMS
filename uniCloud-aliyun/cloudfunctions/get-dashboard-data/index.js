'use strict'

const db = uniCloud.database()

exports.main = async (event) => {
  const session = event.session || {}
  const role = session.role

  const courses = await readCollection('courses', demoCourses())
  const attendance = await readCollection('attendance_records', demoAttendance())
  const leaves = await readCollection('leave_requests', [])
  const evaluations = await readCollection('course_evaluations', demoEvaluations())

  const leaveRequests = role === 'student'
    ? leaves.filter(item => item.studentId === session.userId)
    : leaves.filter(item => item.status === 'pending')

  return {
    ok: true,
    data: {
      user: session,
      courses,
      attendance: role === 'student' ? attendance.filter(item => item.studentId === session.userId) : attendance,
      leaveRequests,
      evaluationSummary: buildEvaluationSummary(courses, evaluations),
      metrics: {
        courses: courses.length,
        pendingLeaves: leaves.filter(item => item.status === 'pending').length,
        evaluations: evaluations.length
      }
    }
  }
}

async function readCollection(name, fallback) {
  try {
    const result = await db.collection(name).limit(100).get()
    return result.data && result.data.length ? result.data : fallback
  } catch (error) {
    console.warn(`[get-dashboard-data] ${name} unavailable, using fallback.`, error)
    return fallback
  }
}

function buildEvaluationSummary(courses, evaluations) {
  return courses.map(course => {
    const courseEvaluations = evaluations.filter(item => item.courseId === course._id)
    const average = courseEvaluations.length
      ? Math.round((courseEvaluations.reduce((sum, item) => sum + Number(item.rating), 0) / courseEvaluations.length) * 10) / 10
      : 0
    return {
      courseId: course._id,
      courseName: `${course.code} ${course.name}`,
      count: courseEvaluations.length,
      average,
      feedback: courseEvaluations.map(item => item.feedback)
    }
  })
}

function demoCourses() {
  return [
    { _id: 'c_software_design', code: 'JC3506', name: 'Software Design and Implementation', teacherId: 'u_teacher_001', schedule: 'Mon 10:00-12:00', credits: 15 },
    { _id: 'c_process_management', code: 'PM3506', name: 'Software Process Management', teacherId: 'u_teacher_001', schedule: 'Wed 14:00-16:00', credits: 15 }
  ]
}

function demoAttendance() {
  return [
    { _id: 'a_001', studentId: 'u_student_001', courseId: 'c_software_design', date: '2026-05-25', status: 'absent' },
    { _id: 'a_002', studentId: 'u_student_001', courseId: 'c_process_management', date: '2026-05-27', status: 'present' }
  ]
}

function demoEvaluations() {
  return [
    { _id: 'e_001', courseId: 'c_software_design', rating: 5, feedback: 'The course is practical and useful for project architecture.', anonymousToken: 'anon-demo-1' }
  ]
}
