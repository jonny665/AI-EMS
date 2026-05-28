'use strict'
const db = uniCloud.database()

exports.main = async (event) => {
  const session = event.session || {}
  
  // 权限校验
  if (!['teacher', 'admin'].includes(session.role)) {
    return { 
      ok: false, 
      message: 'Only teachers or administrators can review leave requests.' 
    }
  }

  const validDecisions = ['approved', 'rejected'];
  // 检查decision是否存在且为合法值
  if (!event.hasOwnProperty('decision') || !validDecisions.includes(event.decision)) {
    return {
      ok: false,
      message: 'Invalid or missing decision parameter. Decision must be "approved" or "rejected".'
    };
  }
  // 确认合法后赋值
  const decision = event.decision;
  
  // 查询请假单
  const leaveResult = await db.collection('leave_requests').doc(event.leaveId).get()
  const leave = leaveResult.data?.[0]
  
  if (!leave) {
    return { ok: false, message: 'Leave request not found.' }
  }
  
  // 仅待审批可处理
  if (leave.status !== 'pending') {
    return { ok: false, message: 'Leave request has already been processed.' }
  }

  // 数据库更新（严格匹配Schema）
  await db.collection('leave_requests').doc(event.leaveId).update({
    status: decision,
    reviewer_user_id: session.userId,
    reviewed_at: Date.now(),
    updated_at: Date.now()
  })

  // 审批通过同步考勤
  if (decision === 'approved') {
    await syncAttendance(leave)
  }

  // 写入操作日志
  await writeAudit('review_leave', session, { 
    leaveId: event.leaveId, 
    decision 
  })

  return {
    ok: true,
    leave: {
      _id: leave._id,
      student_id: leave.student_id,
      reason_type: leave.reason_type,
      reason_detail: leave.reason_detail,
      start_at: leave.start_at,
      end_at: leave.end_at,
      attachment_urls: leave.attachment_urls,
      status: decision,
      reviewer_user_id: session.userId,
      review_comment: leave.review_comment,
      reviewed_at: Date.now(),
      created_at: leave.created_at,
      updated_at: Date.now()
    }
  }
}

// 考勤同步核心逻辑
async function syncAttendance(leave) {
  try {
    const sessionRes = await db.collection('leave_request_sessions')
      .where({ leave_request_id: leave._id }).get()
    const sessions = sessionRes.data || []

    for (const item of sessions) {
      if (item.attendance_record_id) {
        await db.collection('attendance_records').doc(item.attendance_record_id).update({
          status: 'on_leave', updated_at: Date.now()
        })
        continue
      }

      const attRes = await db.collection('attendance_records').where({
        student_id: leave.student_id,
        class_session_id: item.class_session_id
      }).limit(1).get()

      if (attRes.data?.[0]) {
        await db.collection('attendance_records').doc(attRes.data[0]._id).update({
          status: 'on_leave', updated_at: Date.now()
        })
        await db.collection('leave_request_sessions').doc(item._id).update({
          attendance_record_id: attRes.data[0]._id
        })
      } else {
        const newAtt = await db.collection('attendance_records').add({
          student_id: leave.student_id,
          class_session_id: item.class_session_id,
          status: 'on_leave',
          created_at: Date.now(),
          updated_at: Date.now()
        })
        await db.collection('leave_request_sessions').doc(item._id).update({
          attendance_record_id: newAtt.id
        })
      }
    }
  } catch (err) {
    console.error('[syncAttendance] error', err)
  }
}

// 审计日志
async function writeAudit(action, session, detail) {
  try {
    await db.collection('audit_logs').add({
      action, userId: session.userId, role: session.role, detail, createdAt: Date.now()
    })
  } catch (err) {
    console.warn('[audit] error', err)
  }
}