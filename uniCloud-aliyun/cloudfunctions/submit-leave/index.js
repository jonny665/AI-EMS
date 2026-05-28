'use strict'

const db = uniCloud.database()

exports.main = async (event) => {
  const session = event.session || {}
  if (session.role !== 'student') {
    return { ok: false, message: 'Only students can submit leave requests.' }
  }

  const course = await findCourse(event.courseId)
  const leave = {
    studentId: session.userId,
    studentName: session.displayName,
    courseId: event.courseId,
    courseName: course ? `${course.code} ${course.name}` : event.courseId,
    date: event.date,
    reason: event.reason,
    status: 'pending',
    reviewerId: '',
    reviewerName: '',
    createdAt: Date.now()
  }

  const result = await db.collection('leave_requests').add(leave)
  await writeAudit('submit_leave', session, { leaveId: result.id, courseId: event.courseId })

  return { ok: true, leave: { ...leave, _id: result.id } }
}

async function findCourse(courseId) {
  try {
    const result = await db.collection('courses').doc(courseId).get()
    return result.data && result.data[0]
  } catch (error) {
    return null
  }
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
    console.warn('[submit-leave] audit write skipped.', error)
  }
}
