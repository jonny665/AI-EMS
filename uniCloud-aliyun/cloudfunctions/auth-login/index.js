'use strict'

const db = uniCloud.database()

const demoUsers = [
  { _id: 'u_student_001', username: 'student001', password: 'demo123', role: 'student', displayName: 'Alice Chen', major: 'Software Engineering' },
  { _id: 'u_teacher_001', username: 'teacher001', password: 'demo123', role: 'teacher', displayName: 'Dr. Zhang', department: 'Computer Science' },
  { _id: 'u_admin_001', username: 'admin001', password: 'demo123', role: 'admin', displayName: 'Academic Admin', department: 'Academic Office' }
]

exports.main = async (event) => {
  const username = String(event.username || '').trim()
  const password = String(event.password || '')

  let user = null
  try {
    const result = await db.collection('users').where({ username, password }).limit(1).get()
    user = result.data && result.data[0]
  } catch (error) {
    console.warn('[auth-login] users collection unavailable, using demo fallback.', error)
  }

  if (!user) {
    user = demoUsers.find(item => item.username === username && item.password === password)
  }

  if (!user) {
    return { ok: false, message: 'Invalid demo account or password.' }
  }

  await writeAudit('login', user._id, user.role, { username })

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

async function writeAudit(action, userId, role, detail) {
  try {
    await db.collection('audit_logs').add({
      action,
      userId,
      role,
      detail,
      createdAt: Date.now()
    })
  } catch (error) {
    console.warn('[auth-login] audit write skipped.', error)
  }
}
