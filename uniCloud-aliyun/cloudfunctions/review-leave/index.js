'use strict'

const db = uniCloud.database()

exports.main = async (event) => {
  const session = event.session || {}
  if (!['teacher', 'admin'].includes(session.role)) {
    return { ok: false, message: 'Only teachers or administrators can review leave requests.' }
  }

  const decision = event.decision === 'approved' ? 'approved' : 'rejected'
  const leaveResult = await db.collection('leave_requests').doc(event.leaveId).get()
  const leave = leaveResult.data && leaveResult.data[0]
  if (!leave) return { ok: false, message: 'Leave request not found.' }

  await db.collection('leave_requests').doc(event.leaveId).update({
    status: decision,
    reviewerId: session.userId,
    reviewerName: session.displayName,
    reviewedAt: Date.now()
  })

  if (decision === 'approved') {
    await syncAttendance(leave)
  }

  await writeAudit('review_leave', session, { leaveId: event.leaveId, decision })

  return {
    ok: true,
    leave: {
      ...leave,
      status: decision,
      reviewerId: session.userId,
      reviewerName: session.displayName
    }
  }
}

async function syncAttendance(leave) {
  const result = await db.collection('attendance_records').where({
    studentId: leave.studentId,
    courseId: leave.courseId,
    date: leave.date
  }).limit(1).get()

  if (result.data && result.data[0]) {
    await db.collection('attendance_records').doc(result.data[0]._id).update({ status: 'on_leave', updatedAt: Date.now() })
  } else {
    await db.collection('attendance_records').add({
      studentId: leave.studentId,
      courseId: leave.courseId,
      date: leave.date,
      status: 'on_leave',
      createdAt: Date.now()
    })
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
    console.warn('[review-leave] audit write skipped.', error)
  }
}
