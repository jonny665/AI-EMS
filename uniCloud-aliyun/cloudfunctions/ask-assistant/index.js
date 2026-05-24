'use strict'

const db = uniCloud.database()

const fallbackAnswer = '当前知识库没有足够信息，请联系教务人员确认。'

exports.main = async (event) => {
  const session = event.session || {}
  if (!['student', 'teacher', 'admin'].includes(session.role)) {
    return { ok: false, message: 'Login is required.' }
  }

  const query = String(event.query || '').trim()
  if (!query) return { ok: false, message: 'Question is required.' }

  const knowledge = await readKnowledge()
  const normalizedQuery = query.toLowerCase()
  const hit = knowledge.find(item => {
    const keywords = Array.isArray(item.keywords) ? item.keywords : []
    return keywords.some(keyword => normalizedQuery.includes(String(keyword).toLowerCase()))
  })

  await writeAudit('ask_assistant', session, { query, grounded: Boolean(hit) })

  if (!hit) {
    return {
      ok: true,
      data: {
        answer: fallbackAnswer,
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

async function readKnowledge() {
  try {
    const result = await db.collection('knowledge_base').limit(100).get()
    if (result.data && result.data.length) return result.data
  } catch (error) {
    console.warn('[ask-assistant] knowledge_base unavailable, using fallback.', error)
  }
  return [
    {
      title: 'Graduation credit requirement',
      keywords: ['graduation', 'credit', 'credits', '学分', '毕业'],
      answer: 'The PoC knowledge base states that students should track completed credits and remaining required modules before graduation. Please confirm official requirements with the academic office.'
    },
    {
      title: 'Leave approval workflow',
      keywords: ['leave', 'absence', '请假', '缺勤', 'attendance'],
      answer: 'Students submit a leave request for a specific course session. After approval by an authorised teacher or administrator, the attendance status is updated to on_leave.'
    },
    {
      title: 'Anonymous course evaluation',
      keywords: ['evaluation', 'feedback', 'anonymous', '评价', '匿名'],
      answer: 'Course evaluations are shown to teachers as aggregated feedback only. The PoC does not expose individual student identities behind evaluation comments.'
    }
  ]
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
    console.warn('[ask-assistant] audit write skipped.', error)
  }
}
