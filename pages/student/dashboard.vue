<template>
  <view class="page">
    <view class="section">
      <view class="row">
        <view>
          <text class="section-title">Student Dashboard</text>
          <text class="muted">{{ session.displayName }} · {{ session.username }}</text>
        </view>
        <button class="danger-btn" @click="logout">Logout</button>
      </view>
      <view class="btn-row">
        <button class="primary-btn" @click="go('/pages/leave/leave')">Leave</button>
        <button class="primary-btn" @click="go('/pages/evaluation/evaluation')">Evaluation</button>
        <button class="primary-btn" @click="go('/pages/assistant/assistant')">Assistant</button>
      </view>
    </view>

    <view class="section">
      <text class="section-title">My Courses</text>
      <view v-for="course in data.courses" :key="course._id" class="card">
        <text class="value">{{ course.code }} {{ course.name }}</text>
        <text class="muted">{{ course.schedule }} · {{ course.credits }} credits</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">Attendance</text>
      <view v-for="item in data.attendance" :key="item._id" class="card">
        <text class="value">{{ courseLabel(item.courseId) }}</text>
        <text class="muted">{{ item.date }} · {{ item.status }}</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">Leave Requests</text>
      <view v-if="!data.leaveRequests.length" class="muted">No leave requests yet.</view>
      <view v-for="item in data.leaveRequests" :key="item._id" class="card">
        <text class="value">{{ item.courseName }}</text>
        <text class="muted">{{ item.date }} · {{ item.status }} · {{ item.reason }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { callAiemsFunction } from '../../common/api.js'
import { clearSession, getSession, requireRole } from '../../common/session.js'

export default {
  data() {
    return {
      session: {},
      data: {
        courses: [],
        attendance: [],
        leaveRequests: []
      }
    }
  },
  onShow() {
    const session = requireRole(['student'])
    if (!session) return
    this.session = session
    this.load()
  },
  methods: {
    async load() {
      const result = await callAiemsFunction('get-dashboard-data', { session: getSession() })
      if (result.ok) this.data = result.data
    },
    courseLabel(courseId) {
      const course = this.data.courses.find(item => item._id === courseId)
      return course ? `${course.code} ${course.name}` : courseId
    },
    go(url) {
      uni.navigateTo({ url })
    },
    logout() {
      clearSession()
      uni.reLaunch({ url: '/pages/login/login' })
    }
  }
}
</script>
