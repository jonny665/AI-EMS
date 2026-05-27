const SESSION_KEY = 'ai_ems_session'

export function setSession(user) {
  uni.setStorageSync(SESSION_KEY, user)
}

export function getSession() {
  return uni.getStorageSync(SESSION_KEY) || null
}

export function clearSession() {
  uni.removeStorageSync(SESSION_KEY)
}

export function requireRole(allowedRoles) {
  const session = getSession()
  if (!session || !allowedRoles.includes(session.role)) {
    uni.reLaunch({ url: '/pages/login/login' })
    return null
  }
  return session
}

export function dashboardUrl(role) {
  const routes = {
    student: '/pages/student/dashboard',
    teacher: '/pages/teacher/dashboard',
    admin: '/pages/admin/dashboard'
  }
  return routes[role] || '/pages/login/login'
}
