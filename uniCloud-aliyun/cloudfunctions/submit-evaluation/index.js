'use strict'

const db = uniCloud.database()

exports.main = async (event) => {
  const session = event.session || {}
  if (session.role !== 'student') {
    return { ok: false, message: 'Only students can submit course evaluations.' }
  }

  const rating = Number(event.rating)
  if (!event.courseId || rating < 1 || rating > 5 || !event.feedback) {
    return { ok: false, message: 'Valid course, rating and feedback are required.' }
  }

  const evaluation = {
    courseId: event.courseId,
    rating,
    feedback: String(event.feedback),
    anonymousToken: `anon_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now()
  }

  const result = await db.collection('course_evaluations').add(evaluation)
  await writeAudit('submit_evaluation', session, { courseId: event.courseId, evaluationId: result.id })

  return { ok: true, evaluation: { ...evaluation, _id: result.id } }
}

async function writeAudit(action, session, detail) {
  try {
    await db.collection('audit_logs').add({
      action,
      userId: session.userId,
      role: session.role,
      detail,
      createdAt: Date.now()
    })
  } catch (error) {
    console.warn('[submit-evaluation] audit write skipped.', error)
  }
}
