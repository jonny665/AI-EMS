<template>
  <view class="page">
    <view class="section">
      <view class="row">
        <view>
          <text class="section-title">Leave Workflow</text>
          <text class="muted">{{ session.displayName }} - {{ session.role }}</text>
        </view>
        <view class="btn-row top-actions">
          <button class="secondary-btn" :loading="loading" @click="refresh">Refresh</button>
          <button class="secondary-btn" @click="backHome">Home</button>
        </view>
      </view>
    </view>

    <view v-if="session.role === 'student'" class="section">
      <text class="section-title">Submit Leave Request</text>

      <view class="field">
        <text class="label">Course</text>
        <picker :range="courseLabels" :value="courseIndex" @change="changeCourse">
          <view class="picker-value">{{ selectedCourseLabel }}</view>
        </picker>
      </view>

      <view class="field">
        <text class="label">Leave Type</text>
        <picker :range="reasonTypeLabels" :value="reasonTypeIndex" @change="changeReasonType">
          <view class="picker-value">{{ selectedReasonTypeLabel }}</view>
        </picker>
      </view>

      <view class="field">
        <text class="label">Date</text>
        <picker mode="date" :value="date" @change="changeDate">
          <view class="picker-value">{{ date }}</view>
        </picker>
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
        <text class="value">{{ leaveTitle(item) }}</text>
        <text class="muted">{{ [item.date, reasonTypeLabel(item.reasonType), item.status].filter(Boolean).join(' - ') }}</text>
        <text class="muted">{{ item.reasonDetail || item.reason }}</text>
        <text v-if="item.reviewComment" class="muted">Review: {{ item.reviewComment }}</text>

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
      loading: false,
      lastLoadedAt: 0,
      loadTtlMs: 30000,
      reasonTypes: [
        { value: 'sick', label: 'Sick Leave' },
        { value: 'personal', label: 'Personal Leave' },
        { value: 'official', label: 'Official Duty' },
        { value: 'other', label: 'Other' }
      ]
    }
  },
  computed: {
    courseLabels() {
      return this.courses.map(item => this.formatCourseLabel(item))
    },
    selectedCourseLabel() {
      return this.courseLabels[this.courseIndex] || 'No courses available'
    },
    reasonTypeLabels() {
      return this.reasonTypes.map(item => item.label)
    },
    selectedReasonTypeLabel() {
      return this.reasonTypeLabels[this.reasonTypeIndex] || 'Other'
    }
  },
  onShow() {
    const session = requireRole(['student', 'teacher', 'admin'])
    if (!session) return
    this.session = session
    const now = Date.now()
    if (!this.courses.length || now - this.lastLoadedAt > this.loadTtlMs) {
      this.load()
    }
  },
  methods: {
    async load(forceRefresh = false) {
      this.loading = true
      const result = await callAiemsFunction('get-dashboard-data', {
        session: getSession(),
        forceRefresh
      })
      this.loading = false

      if (!result.ok) {
        uni.showToast({ title: result.message || 'Failed to load leave data.', icon: 'none' })
        return
      }

      this.courses = result.data.courses || []
      this.leaveRequests = result.data.leaveRequests || []
      if (!this.courses.length) {
        console.warn('[AI-EMS] No courses returned for leave page.', {
          session: getSession(),
          dashboardMeta: result.data.meta || null
        })
      }
      this.lastLoadedAt = Date.now()

      if (this.courseIndex >= this.courses.length) {
        this.courseIndex = 0
      }
      if (this.reasonTypeIndex >= this.reasonTypes.length) {
        this.reasonTypeIndex = 0
      }
    },
    refresh() {
      this.load(true)
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
        courseOfferingId: course.courseOfferingId,
        leaveDate: this.date,
        reasonType: reasonType.value,
        reasonDetail
      })

      if (result.ok) {
        this.reasonDetail = ''
        uni.showToast({ title: 'Submitted', icon: 'success' })
        this.load(true)
        return
      }

      uni.showToast({ title: result.message || 'Submit failed.', icon: 'none' })
    },
    changeReasonType(event) {
      this.reasonTypeIndex = Number(event.detail.value)
    },
    changeCourse(event) {
      this.courseIndex = Number(event.detail.value)
    },
    changeDate(event) {
      this.date = event.detail.value
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
        this.load(true)
        return
      }

      uni.showToast({ title: result.message || 'Review failed.', icon: 'none' })
    },
    async cancelLeave(item) {
      const result = await callAiemsFunction('cancel-leave', {
        session: getSession(),
        leaveId: item._id
      })

      if (result.ok) {
        uni.showToast({ title: 'Cancelled', icon: 'success' })
        this.load(true)
        return
      }

      uni.showToast({ title: result.message || 'Cancel failed.', icon: 'none' })
    },
    backHome() {
      uni.reLaunch({ url: dashboardUrl(this.session.role) })
    },
    formatCourseLabel(course) {
      if (!course) {
        return 'Unnamed course'
      }
      const title = [course.code, course.name].filter(Boolean).join(' ').trim() || 'Unnamed course'
      const selected = course.selectedTeacherName || ''
      const teachers = selected ? ` (${selected})` : Array.isArray(course.teacherNames) && course.teacherNames.length ? ` (${course.teacherNames.join(', ')})` : ''
      return title + teachers
    },
    leaveTitle(item) {
      return [item.studentName || this.session.displayName, item.courseName].filter(Boolean).join(' - ')
    },
    reasonTypeLabel(value) {
      const type = this.reasonTypes.find(item => item.value === value)
      return type ? type.label : value
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

.top-actions {
  margin-top: 0;
}
</style>
