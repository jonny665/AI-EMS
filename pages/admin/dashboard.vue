<template>
  <view class="page">
    <view class="section">
      <view class="row">
        <view>
          <text class="section-title">Admin Dashboard</text>
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
      <text class="section-title">System Metrics</text>
      <view class="card">
        <text class="value">Courses: {{ data.metrics.courses }}</text>
      </view>
      <view class="card">
        <text class="value">Pending leave: {{ data.metrics.pendingLeaves }}</text>
      </view>
      <view class="card">
        <text class="value">Evaluations: {{ data.metrics.evaluations }}</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">Pending Leave Requests</text>
      <view v-if="!data.leaveRequests.length" class="muted">No pending leave requests.</view>
      <view v-for="item in data.leaveRequests" :key="item._id" class="card">
        <text class="value">{{ item.studentName }} · {{ item.courseName }}</text>
        <text class="muted">{{ item.date }} · {{ item.reason }}</text>
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
        leaveRequests: [],
        metrics: {
          courses: 0,
          pendingLeaves: 0,
          evaluations: 0
        }
      }
    }
  },
  onShow() {
    const session = requireRole(['admin'])
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
