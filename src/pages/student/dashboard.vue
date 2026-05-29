<template>
  <view class="page">
    <PageHeader
      title="Student Dashboard"
      :displayName="session.displayName"
      :username="session.username"
    >
      <button class="secondary-btn refresh-btn" :loading="loading" @click="refresh">Refresh</button>
    </PageHeader>

    <NavTabs :role="session.role" current="dashboard" />

    <view class="section">
      <view class="section-head">
        <view>
          <text class="section-title">Academic Overview</text>
          <text class="muted">{{ profile.major }} - {{ profile.adminClass || profile.enrollmentYear }}</text>
        </view>
        <text class="muted">{{ lastUpdatedText }}</text>
      </view>
      <view class="row">
        <StatCard :value="profile.gpa" label="GPA" />
        <StatCard :value="creditText" label="Credits" />
        <StatCard :value="attendanceRate + '%'" label="Attendance" />
      </view>
      <ProgressBar
        :current="profile.creditsEarned"
        :total="profile.totalCredits"
        label="Graduation Progress"
      />
    </view>

    <view class="section">
      <text class="section-title">Training Plan</text>
      <ProgressBar
        v-for="item in moduleItems"
        :key="item.key"
        :current="item.current"
        :total="item.total"
        :label="item.label"
      />
      <view class="info-grid">
        <view class="info-cell">
          <text class="label">Percentile</text>
          <text class="value">{{ profile.percentileRank || 0 }}%</text>
        </view>
        <view class="info-cell">
          <text class="label">Interest Tags</text>
          <text class="value">{{ interestText }}</text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">Recommended Courses</text>
      <template v-if="!data.recommendations.length">
        <text class="muted">No recommendations yet.</text>
      </template>
      <DataCard
        v-for="item in data.recommendations"
        :key="item._id || item.courseOfferingId"
        :title="item.courseName"
        :subtitle="[item.pathName, item.reason].filter(Boolean).join(' - ')"
      >
        <StatusBadge status="new" />
      </DataCard>
    </view>

    <view class="section">
      <text class="section-title">Academic Alerts</text>
      <template v-if="!data.academicAlerts.length">
        <text class="muted">No active alerts.</text>
      </template>
      <DataCard
        v-for="item in data.academicAlerts"
        :key="item._id"
        :title="item.message"
        :subtitle="[item.alertType, item.severity].filter(Boolean).join(' - ')"
      >
        <StatusBadge :status="item.severity || item.status" />
      </DataCard>
    </view>

    <view class="section">
      <text class="section-title">Profile Review</text>
      <view class="info-grid">
        <view class="info-cell">
          <text class="label">Student ID</text>
          <text class="value">{{ profile.studentNo }}</text>
        </view>
        <view class="info-cell">
          <text class="label">Major</text>
          <text class="value">{{ profile.major }}</text>
        </view>
      </view>
      <view class="field">
        <text class="label">Email</text>
        <input v-model="profileForm.contact.email" />
      </view>
      <view class="field">
        <text class="label">Phone</text>
        <input v-model="profileForm.contact.phone" />
      </view>
      <view class="field">
        <text class="label">Address</text>
        <input v-model="profileForm.contact.address" />
      </view>
      <view class="field">
        <text class="label">Guardian Phone</text>
        <input v-model="profileForm.familyInfo.guardianPhone" />
      </view>
      <button class="primary-btn full-btn" :loading="savingProfile" @click="submitProfileChange">
        Submit for Review
      </button>
      <DataCard
        v-for="item in data.profileChangeRequests"
        :key="item._id"
        :title="formatChangeRequest(item)"
        :subtitle="[item.status, formatDate(item.createdAt)].filter(Boolean).join(' - ')"
      >
        <StatusBadge :status="item.status" />
      </DataCard>
    </view>

    <view class="section">
      <text class="section-title">Location Check-in</text>
      <view class="field">
        <text class="label">Course</text>
        <picker :range="courseLabels" :value="checkinCourseIndex" @change="changeCheckinCourse">
          <view class="picker-value">{{ courseLabels[checkinCourseIndex] || 'No courses available' }}</view>
        </picker>
      </view>
      <button class="primary-btn full-btn" :loading="checkingIn" @click="checkIn">Check In</button>
    </view>

    <view class="section">
      <text class="section-title">My Courses</text>
      <DataCard
        v-for="course in data.courses"
        :key="course.courseOfferingId || course._id"
        :title="course.code + ' ' + course.name"
        :subtitle="courseSubtitle(course)"
      />
    </view>

    <view class="section">
      <text class="section-title">Course Materials</text>
      <template v-if="!data.materials.length">
        <text class="muted">No visible materials yet.</text>
      </template>
      <DataCard
        v-for="item in data.materials"
        :key="item._id"
        :title="item.title"
        :subtitle="[item.courseName, item.fileType].filter(Boolean).join(' - ')"
      />
    </view>

    <view class="section">
      <text class="section-title">Recent Attendance</text>
      <template v-if="!data.attendance.length">
        <text class="muted">No attendance records yet.</text>
      </template>
      <DataCard
        v-for="item in data.attendance"
        :key="item._id"
        :title="item.date + '  ' + courseLabel(item.courseOfferingId)"
        :subtitle="attendanceSubtitle(item)"
      >
        <StatusBadge :status="item.status" />
      </DataCard>
    </view>

    <view class="section">
      <text class="section-title">My Leave Requests</text>
      <template v-if="!data.leaveRequests.length">
        <text class="muted">No leave requests yet.</text>
      </template>
      <DataCard
        v-for="item in data.leaveRequests"
        :key="item._id"
        :title="item.courseName"
        :subtitle="[item.date, item.reason].filter(Boolean).join(' - ')"
      >
        <StatusBadge :status="item.status" />
      </DataCard>
    </view>
  </view>
</template>

<script>
import PageHeader from '../../components/PageHeader.vue'
import NavTabs from '../../components/NavTabs.vue'
import DataCard from '../../components/DataCard.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import ProgressBar from '../../components/ProgressBar.vue'
import StatCard from '../../components/StatCard.vue'
import { callAiemsFunction } from '../../common/api.js'
import { getSession, requireRole } from '../../common/session.js'

export default {
  components: { PageHeader, NavTabs, DataCard, StatusBadge, ProgressBar, StatCard },
  data() {
    return {
      session: {},
      loading: false,
      savingProfile: false,
      checkingIn: false,
      checkinCourseIndex: 0,
      lastUpdatedAt: 0,
      profile: {
        major: '',
        gpa: '0.0',
        creditsEarned: 0,
        totalCredits: 0,
        enrollmentYear: '',
        contact: {},
        familyInfo: {},
        moduleCredits: {},
        interestTags: []
      },
      profileForm: {
        contact: { email: '', phone: '', address: '' },
        familyInfo: { guardianPhone: '' }
      },
      data: {
        courses: [],
        attendance: [],
        leaveRequests: [],
        materials: [],
        recommendations: [],
        academicAlerts: [],
        profileChangeRequests: []
      }
    }
  },
  computed: {
    attendanceRate() {
      const records = this.data.attendance
      if (!records.length) return 0
      const present = records.filter(r => ['present', 'on_leave', 'excused'].includes(r.status)).length
      return Math.round(present / records.length * 100)
    },
    creditText() {
      return this.profile.creditsEarned + ' / ' + this.profile.totalCredits
    },
    moduleItems() {
      const modules = this.profile.moduleCredits || {}
      const labels = {
        general: 'General Education',
        majorRequired: 'Major Required',
        majorElective: 'Major Elective',
        practice: 'Practice'
      }
      return Object.keys(labels).map(key => ({
        key,
        label: labels[key],
        current: Number(modules[key] && modules[key].current || 0),
        total: Number(modules[key] && modules[key].total || 0)
      }))
    },
    interestText() {
      return (this.profile.interestTags || []).join(', ') || 'Not selected'
    },
    courseLabels() {
      return this.data.courses.map(item => this.formatCourseLabel(item))
    },
    lastUpdatedText() {
      return this.lastUpdatedAt ? 'Updated ' + this.formatTime(this.lastUpdatedAt) : ''
    }
  },
  onShow() {
    const session = requireRole(['student'])
    if (!session) return
    this.session = session
    this.load()
  },
  methods: {
    emptyProfile() {
      return {
        major: '',
        gpa: '0.0',
        creditsEarned: 0,
        totalCredits: 0,
        enrollmentYear: '',
        contact: {},
        familyInfo: {},
        moduleCredits: {},
        interestTags: []
      }
    },
    emptyProfileForm() {
      return {
        contact: { email: '', phone: '', address: '' },
        familyInfo: { guardianPhone: '' }
      }
    },
    async load(forceRefresh = false) {
      this.loading = true
      const result = await callAiemsFunction('get-dashboard-data', {
        session: getSession(),
        forceRefresh
      })
      this.loading = false
      if (result.ok) {
        this.data = {
          ...this.data,
          ...result.data,
          courses: result.data.courses || [],
          attendance: result.data.attendance || [],
          leaveRequests: result.data.leaveRequests || [],
          materials: result.data.materials || [],
          recommendations: result.data.recommendations || [],
          academicAlerts: result.data.academicAlerts || [],
          profileChangeRequests: result.data.profileChangeRequests || []
        }
        this.profile = { ...this.emptyProfile(), ...(result.data.profile || {}) }
        this.profileForm = {
          contact: {
            email: this.profile.contact && this.profile.contact.email || '',
            phone: this.profile.contact && this.profile.contact.phone || '',
            address: this.profile.contact && this.profile.contact.address || ''
          },
          familyInfo: {
            guardianPhone: this.profile.familyInfo && this.profile.familyInfo.guardianPhone || ''
          }
        }
        if (this.checkinCourseIndex >= this.data.courses.length) this.checkinCourseIndex = 0
        this.lastUpdatedAt = Date.now()
      }
    },
    refresh() {
      this.load(true)
    },
    async submitProfileChange() {
      this.savingProfile = true
      const result = await callAiemsFunction('submit-profile-change', {
        session: getSession(),
        changes: {
          'contact.email': this.profileForm.contact.email,
          'contact.phone': this.profileForm.contact.phone,
          'contact.address': this.profileForm.contact.address,
          'familyInfo.guardianPhone': this.profileForm.familyInfo.guardianPhone
        }
      })
      this.savingProfile = false
      if (result.ok) {
        uni.showToast({ title: 'Submitted', icon: 'success' })
        this.load(true)
        return
      }
      uni.showToast({ title: result.message || 'Submit failed.', icon: 'none' })
    },
    async checkIn() {
      const course = this.data.courses[this.checkinCourseIndex]
      if (!course) {
        uni.showToast({ title: 'No course selected.', icon: 'none' })
        return
      }
      this.checkingIn = true
      const location = await this.resolveLocation(course)
      const result = await callAiemsFunction('submit-attendance-checkin', {
        session: getSession(),
        courseOfferingId: course.courseOfferingId,
        latitude: location.latitude,
        longitude: location.longitude
      })
      this.checkingIn = false
      if (result.ok) {
        const data = result.data || {}
        uni.showToast({
          title: data.withinGeofence === false ? 'Outside geofence' : 'Checked in',
          icon: data.withinGeofence === false ? 'none' : 'success'
        })
        this.load(true)
        return
      }
      uni.showToast({ title: result.message || 'Check-in failed.', icon: 'none' })
    },
    resolveLocation(course) {
      return new Promise(resolve => {
        uni.getLocation({
          type: 'gcj02',
          success: location => resolve(location),
          fail: () => {
            const classroom = course.classroom || {}
            resolve({
              latitude: Number(classroom.latitude || 31.230416),
              longitude: Number(classroom.longitude || 121.473701)
            })
          }
        })
      })
    },
    changeCheckinCourse(event) {
      this.checkinCourseIndex = Number(event.detail.value)
    },
    courseLabel(courseId) {
      const course = this.data.courses.find(c => c.courseOfferingId === courseId)
      return course ? course.code + ' ' + course.name : courseId
    },
    courseSubtitle(course) {
      return [course.schedule, course.credits ? course.credits + ' credits' : ''].filter(Boolean).join(' - ')
    },
    attendanceSubtitle(item) {
      return [item.source, item.distanceToClassroomM ? item.distanceToClassroomM + 'm' : ''].filter(Boolean).join(' - ')
    },
    formatCourseLabel(course) {
      return [course.code, course.name].filter(Boolean).join(' ').trim() || 'Unnamed course'
    },
    formatChangeRequest(item) {
      const changes = item.changes || {}
      return Object.keys(changes).map(key => {
        const change = changes[key] || {}
        return (change.label || key) + ': ' + change.newValue
      }).join('; ')
    },
    formatDate(value) {
      const timestamp = Number(value || 0)
      return timestamp ? new Date(timestamp).toISOString().slice(0, 10) : ''
    },
    formatTime(value) {
      const date = new Date(value)
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }
  }
}
</script>

<style scoped>
.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 14rpx;
}

.refresh-btn {
  min-width: 150rpx;
}

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
  margin-top: 10rpx;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin: 16rpx 0;
}

.info-cell {
  padding: 16rpx;
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
}
</style>
