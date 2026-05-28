'use strict'
const db = uniCloud.database()
const fallbackAnswer = 'The current knowledge base does not have enough information. Please contact the academic staff for confirmation.'

// 本地知识库测试数据
const localKnowledgeBase = [
  {
    "title": "2026 Graduation Credit Requirements",
    "keywords": ["graduation", "credit", "degree", "requirement"],
    "content": "Undergraduate students of 2026 must complete 140 credits in total, including: 40 public basic credits, 35 professional basic credits, 30 core major credits, 25 elective credits, and 10 practical training credits. All courses must be passed and the thesis defense must be completed to graduate.",
    "category": "policy"
  },
  {
    "title": "Leave Application Process",
    "keywords": ["leave", "application", "approval", "absence", "attendance"],
    "content": "1. Students must submit leave requests through the AI-EMS system; 2. Leaves under 1 day are approved by the advisor; 3. Leaves of 1-3 days are approved by the department secretary; 4. Leaves over 3 days are approved by the department head; 5. Approved leaves will automatically update attendance status to 'on leave'.",
    "category": "policy"
  }
]

exports.main = async (event) => {
  const session = event.session || {}
  
  // 登录校验
  if (!['student', 'teacher', 'admin'].includes(session.role)) {
    return { 
      ok: false, 
      message: 'Login is required.' 
    }
  }

  // 参数校验
  const query = String(event.query || event.question || '').trim()
  if (!query) return { 
    ok: false, 
    message: 'Question is required.' 
  }

  try {
    // 问题预处理
    const cleanedQuery = query.toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const queryWords = cleanedQuery ? cleanedQuery.split(' ') : []
    const normalizeWord = (word) => String(word || '').toLowerCase().replace(/s$/g, '')
    const queryKeywords = Array.from(new Set([
      ...queryWords,
      ...queryWords.map(normalizeWord)
    ]))

    const matchesKeyword = (keyword) => {
      const normalized = normalizeWord(keyword)
      return queryKeywords.includes(normalized) || cleanedQuery.includes(normalized)
    }

    // 尝试从云端数据库查询
    let cloudResults = []
    try {
      const res = await db.collection('knowledge_base')
        .where({
          keywords: db.command.in(queryKeywords)
        })
        .limit(3)
        .get()
      cloudResults = res.data
    } catch (e) {
      console.warn('Cloud database not found, using local test data', e)
    }

    // 合并云端和本地数据
    const allResults = [...cloudResults, ...localKnowledgeBase]

    // 按关键词命中数排序
    const scoredResults = allResults.map(item => {
      const keywords = Array.isArray(item.keywords) ? item.keywords : []
      const hitCount = keywords.reduce((sum, keyword) => {
        return sum + (matchesKeyword(keyword) ? 1 : 0)
      }, 0)
      return { ...item, hitCount }
    }).sort((a, b) => b.hitCount - a.hitCount)

    // 找到最佳匹配
    let hit = null
    if (scoredResults.length > 0 && scoredResults[0].hitCount > 0) {
      hit = scoredResults[0]
    }

    // 记录审计日志
    await writeAudit('ask_assistant', session, { 
      query, 
      grounded: Boolean(hit)
    })

    // 返回结果
    if (hit) {
      return {
        ok: true,
        data: {
          answer: hit.content,
          source: hit.title,
          isFallback: false
        }
      }
    } else {
      return {
        ok: true,
        data: {
          answer: fallbackAnswer,
          source: 'System Prompt',
          isFallback: true
        }
      }
    }

  } catch (error) {
    console.error('Knowledge base query failed:', error)
    await writeAudit('ask_assistant', session, { 
      query, 
      grounded: false,
      error: error.message 
    })
    return {
      ok: true,
      data: {
        answer: 'System is temporarily unavailable. Please try again later or contact the academic staff.',
        source: 'System Prompt',
        isFallback: true
      }
    }
  }
}

// 审计日志函数
async function writeAudit(action, session, data) {
  try {
    await db.collection('audit_logs').add({
      action,
      actor_user_id: session.userId,
      role: session.role,
      data,
      created_at: Date.now()
    })
  } catch (e) {
    console.error('Audit log write failed:', e)
  }
}