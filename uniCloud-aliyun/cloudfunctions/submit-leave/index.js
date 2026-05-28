'use strict'

const db = uniCloud.database()

exports.main = async (event) => {
  const session = event.session || {}
  if (session.role !== 'student') {
    return { ok: false, message: 'Only students can submit leave requests.' }
  }

  const courseOfferingId = String(event.courseOfferingId || event.courseId || '').trim()
  const leaveDate = String(event.leaveDate || event.date || '').trim()
  const reasonType = normalizeReasonType(event.reasonType)
  const reasonDetail = String(event.reasonDetail || event.reason || '').trim()

  if (!courseOfferingId || !leaveDate || !reasonDetail) {
    return { ok: false, message: 'Course, leave date, and reason are required.' }
  }

  if (!reasonType) {
    return { ok: false, message: 'Invalid leave reason type.' }
  }

  const { course, courseOffering } = await findCourse(courseOfferingId)
  const courseName = formatCourseName(courseOffering, course, event.courseName || courseOfferingId)
  let startAt = 0
  let endAt = 0
  try {
    const range = buildLeaveRange(leaveDate)
    startAt = range.startAt
    endAt = range.endAt
  } catch (error) {
    return { ok: false, message: error.message || 'Invalid leave date.' }
  }
  const leave = {
    studentId: session.userId,
    student_id: session.userId,
    studentName: session.displayName,
    student_name: session.displayName,
    courseOfferingId,
    course_offering_id: courseOfferingId,
    courseId: courseOfferingId,
    course_id: course && course._id ? course._id : courseOfferingId,
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
    startAt,
    start_at: startAt,
    endAt,
    end_at: endAt,
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
    createdAt: Date.now(),
    created_at: Date.now(),
    updatedAt: Date.now(),
    updated_at: Date.now()
  }

  const result = await db.collection('leave_requests').add(leave)
  await writeAudit('leave.submit', session, result.id, null, leave)

  return { ok: true, leave: formatLeaveView({ ...leave, _id: result.id }) }
}

async function findCourse(courseOfferingId) {
  try {
    const offeringResult = await db.collection('course_offerings').doc(courseOfferingId).get()
    const courseOffering = offeringResult.data && offeringResult.data[0]
    if (courseOffering) {
      const courseResult = courseOffering.course_id ? await db.collection('courses').doc(courseOffering.course_id).get() : { data: [] }
      return {
        courseOffering,
        course: courseResult.data && courseResult.data[0]
      }
    }

    const courseResult = await db.collection('courses').doc(courseOfferingId).get()
    return {
      courseOffering: null,
      course: courseResult.data && courseResult.data[0]
    }
  } catch (error) {
    return { courseOffering: null, course: null }
  }
}

function formatCourseName(courseOffering, course, fallbackName) {
  if (course) {
    const code = course.course_code || course.code || ''
    return code ? `${code} ${course.name || ''}`.trim() : (course.name || fallbackName)
  }

  if (courseOffering) {
    const code = courseOffering.course_code || courseOffering.code || ''
    const name = courseOffering.name || courseOffering.course_name || fallbackName
    return code ? `${code} ${name}`.trim() : name
  }

  return fallbackName
}

function normalizeReasonType(reasonType) {
  const value = String(reasonType || '').trim()
  const allowed = ['sick', 'personal', 'official', 'other']
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

function formatLeaveView(leave) {
  return {
    ...leave,
    studentId: leave.studentId || leave.student_id,
    student_id: leave.student_id || leave.studentId,
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

async function writeAudit(action, session, targetId, before, after) {
  try {
    await db.collection('audit_logs').add({
      action,
      actor_user_id: session.userId,
      target_collection: 'leave_requests',
      target_id: targetId,
      before,
      after,
      created_at: Date.now()
    })
  } catch (error) {
    console.warn('[submit-leave] audit write skipped.', error)
  }
}
