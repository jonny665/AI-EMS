<template>
  <view class="page">
    <view class="section">
      <view class="row">
        <view>
          <text class="section-title">Teacher Dashboard</text>
          <text class="muted">{{ session.displayName }} · {{ session.username }}</text>
        </view>
        <button class="danger-btn" @click="logout">Logout</button>
      </view>
      <view class="btn-row">
        <button class="primary-btn" @click="go('/pages/leave/leave')">Review Leave</button>
        <button class="primary-btn" @click="go('/pages/evaluation/evaluation')">Evaluation Summary</button>
        <button class="primary-btn" @click="go('/pages/assistant/assistant')">Assistant</button>
      </view>
    </view>

    <view class="section">
      <text class="section-title">Assigned Courses</text>
      <view v-for="course in data.courses" :key="course._id" class="card">
        <text class="value">{{ course.code }} {{ course.name }}</text>
        <text class="muted">{{ course.schedule }} · {{ course.credits }} credits</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">Pending Leave</text>
      <view v-if="!data.leaveRequests.length" class="muted">No pending leave requests.</view>
      <view v-for="item in data.leaveRequests" :key="item._id" class="card">
        <text class="value">{{ item.studentName }} · {{ item.courseName }}</text>
        <text class="muted">{{ item.date }} · {{ item.reason }}</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">Evaluation Snapshot</text>
      <view v-for="item in data.evaluationSummary" :key="item.courseId" class="card">
        <text class="value">{{ item.courseName }}</text>
        <text class="muted">Average {{ item.average }} / 5 · {{ item.count }} response(s)</text>
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
        leaveRequests: [],
        evaluationSummary: []
      }
    }
  },
  onShow() {
    const session = requireRole(['teacher'])
    if (!session) return
    this.session = session
    this.load()
  },
  methods: {
    async load() {
      const result = await callAiemsFunction('get-dashboard-data', { session: getSession() })
      if (result.ok) this.data = result.data
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
