'use strict'

const db = uniCloud.database()

exports.main = async (event) => {
  const session = event.session || {}
  if (!['student', 'teacher', 'admin'].includes(session.role)) {
    return { ok: false, message: 'Login is required.' }
  }

  const courses = await readCollection('courses', demoCourses())
  const evaluations = await readCollection('course_evaluations', demoEvaluations())

  return { ok: true, data: buildSummary(courses, evaluations) }
}

async function readCollection(name, fallback) {
  try {
    const result = await db.collection(name).limit(100).get()
    return result.data && result.data.length ? result.data : fallback
  } catch (error) {
    console.warn(`[get-evaluation-summary] ${name} unavailable, using fallback.`, error)
    return fallback
  }
}

function buildSummary(courses, evaluations) {
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
    { _id: 'c_software_design', code: 'JC3506', name: 'Software Design and Implementation' },
    { _id: 'c_process_management', code: 'PM3506', name: 'Software Process Management' }
  ]
}

function demoEvaluations() {
  return [
    { _id: 'e_001', courseId: 'c_software_design', rating: 5, feedback: 'The course is practical and useful for project architecture.', anonymousToken: 'anon-demo-1' }
  ]
}
