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
      <text class="section-title">My Courses</text>
      <DataCard
        v-for="course in data.courses"
        :key="course.courseOfferingId || course._id"
        :title="course.code + ' ' + course.name"
        :subtitle="courseSubtitle(course)"
      >
        <view v-if="course.teacherOptions && course.teacherOptions.length > 1" class="teacher-select-panel" :class="{ locked: course.teacherSelected }">
          <view class="teacher-select-head">
            <view>
              <text class="label">Selected Teacher</text>
              <text class="teacher-select-note">
                {{ course.teacherSelected ? 'Selection is locked after one choice.' : 'Choose once. You cannot change it later.' }}
              </text>
            </view>
            <text class="teacher-lock-pill" :class="{ locked: course.teacherSelected }">
              {{ course.teacherSelected ? 'Locked' : 'One-time' }}
            </text>
          </view>
          <view v-if="course.teacherSelected" class="teacher-final-choice">
            <text class="teacher-final-name">{{ course.selectedTeacherName || 'Teacher selected' }}</text>
            <text class="teacher-final-meta">Final choice saved</text>
          </view>
          <view v-else class="teacher-choice-grid">
            <view
              v-for="option in course.teacherOptions"
              :key="option.teacherId"
              class="teacher-choice-card"
              @click="selectTeacher(course, option.teacherId)"
            >
              <view class="teacher-choice-copy">
                <text class="teacher-choice-name">{{ option.name }}</text>
                <text class="teacher-choice-no">{{ option.teacherNo || option.teacherId }}</text>
              </view>
              <text class="teacher-choice-action">Choose</text>
            </view>
          </view>
          <text v-if="isCourseFull(course) && !course.teacherSelected" class="teacher-select-note warning">Course is full.</text>
        </view>
      </DataCard>
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
      if (this.profile.attendanceStats || this.profile.attendanceRate !== undefined) {
        return Number(this.profile.attendanceRate || 0)
      }
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
    lastUpdatedText() {
      return this.lastUpdatedAt ? 'Updated ' + this.formatTime(this.lastUpdatedAt) : ''
    }
  },
  onShow() {
    const session = requireRole(['student'])
    if (!session) return
    this.session = session
    const now = Date.now()
    if (!this.lastUpdatedAt || now - this.lastUpdatedAt > 30000) {
      this.load()
    }
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
        if (!this.data.courses.length) {
          console.warn('[AI-EMS] No courses returned for student dashboard.', {
            session: getSession(),
            dashboardMeta: result.data.meta || null
          })
        }
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
    courseLabel(courseId) {
      const course = this.data.courses.find(c => c.courseOfferingId === courseId)
      return course ? course.code + ' ' + course.name : courseId
    },
    courseSubtitle(course) {
      const teachers = Array.isArray(course.teacherNames) ? course.teacherNames.join(', ') : ''
      const selected = course.selectedTeacherName ? 'Selected: ' + course.selectedTeacherName : ''
      const capacity = course.capacity ? `${Number(course.enrolledCount || 0)} / ${Number(course.capacity || 0)} seats` : ''
      const status = course.completed ? 'completed' : course.teacherSelected ? 'teacher locked' : this.isCourseFull(course) ? 'full' : course.teacherSelectionRequired ? 'teacher pending' : ''
      return [selected || (teachers ? 'Teachers: ' + teachers : ''), course.schedule, course.credits ? course.credits + ' credits' : '', capacity, status].filter(Boolean).join(' - ')
    },
    async selectTeacher(course, teacherId) {
      if (course.teacherSelected) {
        uni.showToast({ title: 'Teacher choice is locked and cannot be changed.', icon: 'none' })
        return
      }
      if (this.isCourseFull(course)) {
        uni.showToast({ title: 'This course has reached capacity.', icon: 'none' })
        return
      }
      const result = await callAiemsFunction('select-course-teacher', {
        session: getSession(),
        courseOfferingId: course.courseOfferingId,
        teacherId
      })
      if (result.ok) {
        uni.showToast({ title: 'Teacher selected', icon: 'success' })
        this.load(true)
        return
      }
      uni.showToast({ title: result.message || 'Selection failed.', icon: 'none' })
    },
    isCourseFull(course) {
      const capacity = Number(course && course.capacity || 0)
      return Boolean(capacity && Number(course.enrolledCount || 0) >= capacity)
    },
    attendanceSubtitle(item) {
      return [item.source, item.distanceToClassroomM ? item.distanceToClassroomM + 'm' : ''].filter(Boolean).join(' - ')
    },
    formatCourseLabel(course) {
      const title = [course.code, course.name].filter(Boolean).join(' ').trim() || 'Unnamed course'
      const teachers = Array.isArray(course.teacherNames) && course.teacherNames.length ? ` (${course.teacherNames.join(', ')})` : ''
      return title + teachers
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

.teacher-select {
  min-width: 260rpx;
}

.teacher-select-panel {
  margin-top: 16rpx;
  padding: 20rpx;
  border: 1rpx solid #dbeafe;
  border-radius: 18rpx;
  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
  box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.05);
}

.teacher-select-panel.locked {
  border-color: #bbf7d0;
  background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);
}

.teacher-select-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.teacher-select-note {
  display: block;
  margin-top: 6rpx;
  color: #64748b;
  font-size: 24rpx;
  line-height: 1.5;
}

.teacher-select-note.warning {
  margin-top: 12rpx;
  color: #b45309;
}

.teacher-lock-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 22rpx;
  font-weight: 700;
  white-space: nowrap;
}

.teacher-lock-pill.locked {
  background: #dcfce7;
  color: #166534;
}

.teacher-final-choice {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 18rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 16rpx;
  background: #f8fafc;
}

.teacher-final-name {
  color: #0f172a;
  font-size: 30rpx;
  font-weight: 600;
}

.teacher-final-meta {
  color: #64748b;
  font-size: 24rpx;
}

.teacher-choice-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.teacher-choice-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  min-height: 82rpx;
  padding: 16rpx;
  border: 1rpx solid #cbd5e1;
  border-radius: 16rpx;
  background: #ffffff;
}

.teacher-choice-card:active {
  border-color: #2563eb;
  background: #eff6ff;
}

.teacher-choice-copy {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}

.teacher-choice-name {
  color: #0f172a;
  font-size: 28rpx;
  font-weight: 600;
}

.teacher-choice-no {
  color: #64748b;
  font-size: 24rpx;
}

.teacher-choice-action {
  flex-shrink: 0;
  padding: 8rpx 12rpx;
  border-radius: 999rpx;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 22rpx;
  font-weight: 700;
}

@media (max-width: 700px) {
  .teacher-choice-grid {
    grid-template-columns: 1fr;
  }
}
</style>
