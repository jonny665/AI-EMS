<template>
  <view class="page">
    <PageHeader
      title="Teacher Dashboard"
      :displayName="session.displayName"
      :username="session.username"
    >
      <button class="secondary-btn refresh-btn" :loading="loading" @click="refresh">Refresh</button>
    </PageHeader>

    <NavTabs :role="session.role" current="dashboard" />

    <view class="section">
      <view class="section-head">
        <view>
          <text class="section-title">Teaching Overview</text>
          <text class="muted">{{ teacherProfile.department }} - {{ teacherProfile.title }}</text>
        </view>
        <text class="muted">{{ lastUpdatedText }}</text>
      </view>
      <view class="row">
        <StatCard :value="data.courses.length" label="Courses" />
        <StatCard :value="teacherProfile.studentCount" label="Students" />
        <StatCard :value="riskStudents.length" label="At Risk" />
      </view>
    </view>

    <view class="section">
      <text class="section-title">Profile Review</text>
      <view class="info-grid">
        <view class="info-cell">
          <text class="label">Teacher ID</text>
          <text class="value">{{ teacherProfile.teacherNo }}</text>
        </view>
        <view class="info-cell">
          <text class="label">Department</text>
          <text class="value">{{ teacherProfile.department }}</text>
        </view>
      </view>
      <view class="field">
        <text class="label">Office</text>
        <input v-model="profileForm.office" />
      </view>
      <view class="field">
        <text class="label">Research Fields</text>
        <input v-model="profileForm.researchFields" />
      </view>
      <view class="field">
        <text class="label">Teaching Experience</text>
        <textarea v-model="profileForm.teachingExperience" />
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
      <text class="section-title">Assigned Courses</text>
      <DataCard
        v-for="course in data.courses"
        :key="course.courseOfferingId || course._id"
        :title="course.code + ' ' + course.name"
        :subtitle="courseSubtitle(course)"
      />
    </view>

    <view class="section">
      <text class="section-title">Attendance Editor</text>
      <template v-if="!attendanceCourses.length">
        <text class="muted">No assigned courses available.</text>
      </template>
      <template v-else>
        <view class="field">
          <text class="label">Course</text>
          <picker :range="attendanceCourseLabels" :value="attendanceCourseIndex" @change="changeAttendanceCourse">
            <view class="picker-value">{{ attendanceCourseLabels[attendanceCourseIndex] || 'Select course' }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="label">Class Session</text>
          <picker :range="attendanceSessionLabels" :value="attendanceSessionIndex" @change="changeAttendanceSession">
            <view class="picker-value">{{ attendanceSessionLabels[attendanceSessionIndex] || 'No sessions' }}</view>
          </picker>
        </view>
        <view v-for="student in attendanceStudents" :key="student.studentId" class="attendance-row">
          <view>
            <text class="value">{{ student.studentName }}</text>
            <text class="muted">{{ student.studentNo }}</text>
          </view>
          <picker
            v-if="attendanceStatus(student) !== 'on_leave'"
            :range="attendanceStatusLabels"
            :value="attendanceStatusIndex(student)"
            @change="changeAttendanceStatus(student, $event)"
          >
            <view class="picker-value compact-picker">{{ attendanceStatusLabel(attendanceStatus(student)) }}</view>
          </picker>
          <StatusBadge v-else status="on_leave" />
        </view>
        <button class="primary-btn full-btn" :loading="savingAttendance" @click="saveAttendance">Save Attendance</button>
      </template>
    </view>

    <view class="section">
      <text class="section-title">At-Risk Students</text>
      <text class="section-hint">Absence threshold: 3+ records</text>
      <template v-if="!riskStudents.length">
        <text class="muted">No at-risk students detected.</text>
      </template>
      <DataCard
        v-for="student in riskStudents"
        :key="student.studentId"
        :title="student.studentName"
        :subtitle="'Absent: ' + student.absenceCount + ' times across ' + student.courseCount + ' course(s)'"
      >
        <StatusBadge :status="student.severity || 'absent'" />
      </DataCard>
    </view>

    <view class="section">
      <text class="section-title">Pending Leave Reviews</text>
      <template v-if="!data.leaveRequests.length">
        <text class="muted">No pending leave requests.</text>
      </template>
      <DataCard
        v-for="item in data.leaveRequests"
        :key="item._id"
        :title="[item.studentName, item.courseName].filter(Boolean).join(' - ')"
        :subtitle="[item.date, item.reason].filter(Boolean).join(' - ')"
      >
        <view class="inline-actions">
          <button class="primary-btn compact-btn" @click="review(item, 'approved')">Approve</button>
          <button class="danger-btn compact-btn" @click="review(item, 'rejected')">Reject</button>
        </view>
      </DataCard>
    </view>

    <view class="section">
      <text class="section-title">Evaluation Snapshot</text>
      <DataCard
        v-for="item in data.evaluationSummary"
        :key="item.courseOfferingId || item.courseId"
        :title="item.courseName"
        :subtitle="'Average ' + item.average + ' / 5 - ' + item.count + ' response(s)'"
      />
    </view>
  </view>
</template>

<script>
import PageHeader from '../../components/PageHeader.vue'
import NavTabs from '../../components/NavTabs.vue'
import DataCard from '../../components/DataCard.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import StatCard from '../../components/StatCard.vue'
import { callAiemsFunction } from '../../common/api.js'
import { getSession, requireRole } from '../../common/session.js'

export default {
  components: { PageHeader, NavTabs, DataCard, StatusBadge, StatCard },
  data() {
    return {
      session: {},
      loading: false,
      savingProfile: false,
      savingAttendance: false,
      lastUpdatedAt: 0,
      reviewComment: '',
      attendanceCourseIndex: 0,
      attendanceSessionIndex: 0,
      attendanceDrafts: {},
      attendanceStatuses: [
        { value: 'present', label: 'Present' },
        { value: 'late', label: 'Late' },
        { value: 'absent', label: 'Absent' },
        { value: 'excused', label: 'Excused' }
      ],
      profileForm: {
        office: '',
        researchFields: '',
        teachingExperience: ''
      },
      teacherProfile: {
        department: '',
        title: '',
        studentCount: 0,
        researchFields: []
      },
      data: {
        courses: [],
        classSessions: [],
        courseStudents: [],
        attendance: [],
        leaveRequests: [],
        evaluationSummary: [],
        profileChangeRequests: [],
        atRiskStudents: [],
        metrics: { courses: 0, pendingLeaves: 0, evaluations: 0 }
      }
    }
  },
  computed: {
    riskStudents() {
      if (this.data.atRiskStudents && this.data.atRiskStudents.length) {
        return this.data.atRiskStudents
      }
      const courseOfferingIds = this.data.courses.map(c => c.courseOfferingId)
      const relevantAttendance = this.data.attendance.filter(a =>
        courseOfferingIds.includes(a.courseOfferingId)
      )
      const grouped = {}
      relevantAttendance.forEach(a => {
        if (a.status !== 'absent') return
        if (!grouped[a.studentId]) {
          grouped[a.studentId] = { count: 0, courseIds: new Set(), name: a.studentName || a.studentId }
        }
        grouped[a.studentId].count++
        grouped[a.studentId].courseIds.add(a.courseOfferingId)
      })
      return Object.entries(grouped)
        .filter(([, d]) => d.count >= 3)
        .map(([studentId, d]) => ({
          studentId,
          studentName: d.name,
          absenceCount: d.count,
          courseCount: d.courseIds.size,
          severity: d.count >= 5 ? 'critical' : 'high'
        }))
    },
    lastUpdatedText() {
      return this.lastUpdatedAt ? 'Updated ' + this.formatTime(this.lastUpdatedAt) : ''
    },
    attendanceCourses() {
      return this.data.courses || []
    },
    attendanceCourseLabels() {
      return this.attendanceCourses.map(course => [course.code, course.name].filter(Boolean).join(' '))
    },
    selectedAttendanceCourse() {
      return this.attendanceCourses[this.attendanceCourseIndex] || null
    },
    attendanceSessionsForCourse() {
      const course = this.selectedAttendanceCourse
      if (!course) return []
      return (this.data.classSessions || []).filter(item => item.courseOfferingId === course.courseOfferingId)
    },
    attendanceSessionLabels() {
      return this.attendanceSessionsForCourse.map(item => ['Session ' + item.sequenceNo, item.sessionDate, item.startTime + '-' + item.endTime].filter(Boolean).join(' - '))
    },
    selectedAttendanceSession() {
      return this.attendanceSessionsForCourse[this.attendanceSessionIndex] || null
    },
    attendanceStudents() {
      const course = this.selectedAttendanceCourse
      if (!course) return []
      return (this.data.courseStudents || []).filter(item => item.courseOfferingId === course.courseOfferingId)
    },
    attendanceStatusLabels() {
      return this.attendanceStatuses.map(item => item.label)
    }
  },
  onShow() {
    const session = requireRole(['teacher'])
    if (!session) return
    this.session = session
    const now = Date.now()
    if (!this.lastUpdatedAt || now - this.lastUpdatedAt > 30000) {
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
      if (result.ok) {
        this.data = {
          ...this.data,
          ...result.data,
          courses: result.data.courses || [],
          classSessions: result.data.classSessions || [],
          courseStudents: result.data.courseStudents || [],
          attendance: result.data.attendance || [],
          leaveRequests: result.data.leaveRequests || [],
          evaluationSummary: result.data.evaluationSummary || [],
          profileChangeRequests: result.data.profileChangeRequests || [],
          atRiskStudents: result.data.atRiskStudents || []
        }
        this.teacherProfile = {
          ...this.teacherProfile,
          ...(result.data.teacherProfile || {})
        }
        this.profileForm = {
          office: this.teacherProfile.office || '',
          researchFields: (this.teacherProfile.researchFields || []).join(', '),
          teachingExperience: this.teacherProfile.teachingExperience || ''
        }
        this.lastUpdatedAt = Date.now()
        this.normalizeAttendanceSelection()
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
          office: this.profileForm.office,
          researchFields: this.profileForm.researchFields.split(',').map(item => item.trim()).filter(Boolean),
          teachingExperience: this.profileForm.teachingExperience
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
    async review(item, decision) {
      const result = await callAiemsFunction('review-leave', {
        session: getSession(),
        leaveId: item._id,
        decision,
        reviewComment: this.reviewComment
      })
      if (result.ok) {
        uni.showToast({ title: decision === 'approved' ? 'Approved' : 'Rejected', icon: 'success' })
        this.load(true)
      } else {
        uni.showToast({ title: result.message || 'Review failed.', icon: 'none' })
      }
    },
    normalizeAttendanceSelection() {
      if (this.attendanceCourseIndex >= this.attendanceCourses.length) this.attendanceCourseIndex = 0
      if (this.attendanceSessionIndex >= this.attendanceSessionsForCourse.length) this.attendanceSessionIndex = 0
    },
    changeAttendanceCourse(event) {
      this.attendanceCourseIndex = Number(event.detail.value)
      this.attendanceSessionIndex = 0
      this.attendanceDrafts = {}
    },
    changeAttendanceSession(event) {
      this.attendanceSessionIndex = Number(event.detail.value)
      this.attendanceDrafts = {}
    },
    attendanceRecord(student) {
      const session = this.selectedAttendanceSession
      if (!session) return null
      return (this.data.attendance || []).find(item =>
        item.studentId === student.studentId &&
        item.courseOfferingId === student.courseOfferingId &&
        item.date === session.sessionDate
      ) || null
    },
    attendanceStatus(student) {
      const key = student.studentId
      if (this.attendanceDrafts[key]) return this.attendanceDrafts[key]
      const record = this.attendanceRecord(student)
      return record ? record.status : 'present'
    },
    attendanceStatusIndex(student) {
      const status = this.attendanceStatus(student)
      const index = this.attendanceStatuses.findIndex(item => item.value === status)
      return index >= 0 ? index : 0
    },
    attendanceStatusLabel(status) {
      const item = this.attendanceStatuses.find(option => option.value === status)
      return item ? item.label : status
    },
    changeAttendanceStatus(student, event) {
      const option = this.attendanceStatuses[Number(event.detail.value)] || this.attendanceStatuses[0]
      this.attendanceDrafts = { ...this.attendanceDrafts, [student.studentId]: option.value }
    },
    async saveAttendance() {
      const course = this.selectedAttendanceCourse
      const session = this.selectedAttendanceSession
      if (!course || !session) {
        uni.showToast({ title: 'Course and session are required.', icon: 'none' })
        return
      }
      const records = this.attendanceStudents
        .filter(student => this.attendanceStatus(student) !== 'on_leave')
        .map(student => ({
          studentId: student.studentId,
          status: this.attendanceStatus(student)
        }))
      if (!records.length) {
        uni.showToast({ title: 'No editable students.', icon: 'none' })
        return
      }
      this.savingAttendance = true
      const result = await callAiemsFunction('save-attendance-records', {
        session: getSession(),
        courseOfferingId: course.courseOfferingId,
        attendanceDate: session.sessionDate,
        records
      })
      this.savingAttendance = false
      if (result.ok) {
        uni.showToast({ title: 'Attendance saved', icon: 'success' })
        this.attendanceDrafts = {}
        this.load(true)
        return
      }
      uni.showToast({ title: result.message || 'Save failed.', icon: 'none' })
    },
    courseSubtitle(course) {
      return [course.schedule, course.credits ? course.credits + ' credits' : '', course.totalSessions ? course.totalSessions + ' sessions' : '', course.materialUploadDeadlineAt ? 'Materials until ' + this.formatDate(course.materialUploadDeadlineAt) : ''].filter(Boolean).join(' - ')
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

.section-hint {
  display: block;
  margin-bottom: 10rpx;
  color: #94a3b8;
  font-size: 22rpx;
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

.inline-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.compact-btn {
  min-width: 126rpx;
  font-size: 24rpx;
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

.picker-value {
  padding: 18rpx;
  background: #ffffff;
  border: 1rpx solid #cbd5e1;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.attendance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #e2e8f0;
}

.compact-picker {
  min-width: 170rpx;
  text-align: center;
}
</style>
