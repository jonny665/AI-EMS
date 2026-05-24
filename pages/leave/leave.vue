<template>
  <view class="page">
    <view class="section">
      <view class="row">
        <view>
          <text class="section-title">Leave Workflow</text>
          <text class="muted">{{ session.displayName }} · {{ session.role }}</text>
        </view>
        <button class="secondary-btn" @click="backHome">Home</button>
      </view>
    </view>

    <view v-if="session.role === 'student'" class="section">
      <text class="section-title">Submit Leave Request</text>
      <view class="field">
        <text class="label">Course</text>
        <picker :range="courseNames" :value="courseIndex" @change="changeCourse">
          <view class="picker-value">{{ courseNames[courseIndex] }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">Date</text>
        <input v-model="date" placeholder="2026-05-25" />
      </view>
      <view class="field">
        <text class="label">Reason</text>
        <textarea v-model="reason" placeholder="Explain the leave reason briefly." />
      </view>
      <button class="primary-btn full-btn" @click="submitLeave">Submit</button>
    </view>

    <view class="section">
      <text class="section-title">{{ session.role === 'student' ? 'My Leave Requests' : 'Pending Review' }}</text>
      <view v-if="!leaveRequests.length" class="muted">No leave requests available.</view>
      <view v-for="item in leaveRequests" :key="item._id" class="card">
        <text class="value">{{ item.studentName || session.displayName }} · {{ item.courseName }}</text>
        <text class="muted">{{ item.date }} · {{ item.status }} · {{ item.reason }}</text>
        <view v-if="session.role !== 'student' && item.status === 'pending'" class="btn-row">
          <button class="primary-btn" @click="review(item, 'approved')">Approve</button>
          <button class="danger-btn" @click="review(item, 'rejected')">Reject</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { callAiemsFunction } from '../../common/api.js'
import { dashboardUrl, getSession, requireRole } from '../../common/session.js'

export default {
  data() {
    return {
      session: {},
      courses: [],
      leaveRequests: [],
      courseIndex: 0,
      date: '2026-05-25',
      reason: ''
    }
  },
  computed: {
    courseNames() {
      return this.courses.map(item => `${item.code} ${item.name}`)
    }
  },
  onShow() {
    const session = requireRole(['student', 'teacher', 'admin'])
    if (!session) return
    this.session = session
    this.load()
  },
  methods: {
    async load() {
      const result = await callAiemsFunction('get-dashboard-data', { session: getSession() })
      if (!result.ok) return
      this.courses = result.data.courses || []
      this.leaveRequests = result.data.leaveRequests || []
    },
    async submitLeave() {
      const course = this.courses[this.courseIndex]
      if (!course || !this.reason.trim()) {
        uni.showToast({ title: 'Course and reason are required.', icon: 'none' })
        return
      }
      const result = await callAiemsFunction('submit-leave', {
        session: getSession(),
        courseId: course._id,
        date: this.date,
        reason: this.reason.trim()
      })
      if (result.ok) {
        this.reason = ''
        uni.showToast({ title: 'Submitted', icon: 'success' })
        this.load()
      }
    },
    changeCourse(event) {
      this.courseIndex = Number(event.detail.value)
    },
    async review(item, decision) {
      const result = await callAiemsFunction('review-leave', {
        session: getSession(),
        leaveId: item._id,
        decision
      })
      if (result.ok) {
        uni.showToast({ title: decision === 'approved' ? 'Approved' : 'Rejected', icon: 'success' })
        this.load()
      }
    },
    backHome() {
      uni.reLaunch({ url: dashboardUrl(this.session.role) })
    }
  }
}
</script>

<style scoped>
.field {
  margin-bottom: 18rpx;
}

.picker-value {
  padding: 18rpx;
  background: #ffffff;
  border: 1rpx solid #cbd5e1;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.full-btn {
  width: 100%;
}
</style>
