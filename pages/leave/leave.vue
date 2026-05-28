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
        <text class="label">Leave Type</text>
        <picker :range="reasonTypeLabels" :value="reasonTypeIndex" @change="changeReasonType">
          <view class="picker-value">{{ reasonTypeLabels[reasonTypeIndex] }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">Date</text>
        <input v-model="date" placeholder="2026-05-25" />
      </view>
      <view class="field">
        <text class="label">Reason Detail</text>
        <textarea v-model="reasonDetail" placeholder="Explain the leave reason briefly." />
      </view>
      <button class="primary-btn full-btn" @click="submitLeave">Submit</button>
    </view>

    <view v-if="session.role !== 'student'" class="section">
      <text class="section-title">Review Comment</text>
      <textarea v-model="reviewComment" placeholder="Optional note for the student." />
    </view>

    <view class="section">
      <text class="section-title">{{ session.role === 'student' ? 'My Leave Requests' : 'Pending Review' }}</text>
      <view v-if="!leaveRequests.length" class="muted">No leave requests available.</view>
      <view v-for="item in leaveRequests" :key="item._id" class="card">
        <text class="value">{{ item.studentName || session.displayName }} · {{ item.courseName || item.course_name }}</text>
        <text class="muted">{{ item.date || item.leaveDate }} · {{ item.reasonType || item.reason_type || 'other' }} · {{ item.status }}</text>
        <text class="muted">{{ item.reasonDetail || item.reason_detail || item.reason }}</text>
        <text v-if="item.reviewComment || item.review_comment" class="muted">Review: {{ item.reviewComment || item.review_comment }}</text>
        <view v-if="session.role !== 'student' && item.status === 'pending'" class="btn-row">
          <button class="primary-btn" @click="review(item, 'approved')">Approve</button>
          <button class="danger-btn" @click="review(item, 'rejected')">Reject</button>
        </view>
        <view v-if="session.role === 'student' && ['pending', 'approved'].includes(item.status)" class="btn-row">
          <button class="secondary-btn" @click="cancelLeave(item)">Cancel</button>
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
      reasonTypeIndex: 0,
      date: new Date().toISOString().slice(0, 10),
      reasonDetail: '',
      reviewComment: '',
      reasonTypes: [
        { value: 'sick', label: 'Sick Leave' },
        { value: 'personal', label: 'Personal Leave' },
        { value: 'official', label: 'Official Duty' },
        { value: 'other', label: 'Other' }
      ]
    }
  },
  computed: {
    courseNames() {
      return this.courses.map(item => `${item.code} ${item.name}`)
    },
    reasonTypeLabels() {
      return this.reasonTypes.map(item => item.label)
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
      const reasonDetail = this.reasonDetail.trim()
      if (!course || !reasonDetail) {
        uni.showToast({ title: 'Course and reason are required.', icon: 'none' })
        return
      }
      const reasonType = this.reasonTypes[this.reasonTypeIndex] || this.reasonTypes[3]
      const result = await callAiemsFunction('submit-leave', {
        session: getSession(),
        courseId: course._id,
        courseOfferingId: course._id,
        courseName: `${course.code || course.course_code} ${course.name}`.trim(),
        date: this.date,
        leaveDate: this.date,
        reasonType: reasonType.value,
        reasonDetail,
        reason: reasonDetail
      })
      if (result.ok) {
        this.reasonDetail = ''
        uni.showToast({ title: 'Submitted', icon: 'success' })
        this.load()
      }
    },
    changeReasonType(event) {
      this.reasonTypeIndex = Number(event.detail.value)
    },
    changeCourse(event) {
      this.courseIndex = Number(event.detail.value)
    },
    async review(item, decision) {
      const result = await callAiemsFunction('review-leave', {
        session: getSession(),
        leaveId: item._id,
        decision,
        reviewComment: this.reviewComment.trim()
      })
      if (result.ok) {
        uni.showToast({ title: decision === 'approved' ? 'Approved' : 'Rejected', icon: 'success' })
        this.load()
      }
    },
    async cancelLeave(item) {
      const result = await callAiemsFunction('cancel-leave', {
        session: getSession(),
        leaveId: item._id
      })
      if (result.ok) {
        uni.showToast({ title: 'Cancelled', icon: 'success' })
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
