<template>
  <view class="page">
    <PageHeader
      title="Teacher Dashboard"
      :displayName="session.displayName"
      :username="session.username"
    >
    </PageHeader>

    <NavTabs :role="session.role" current="dashboard" />

    <view class="section">
      <text class="section-title">Teaching Overview</text>
      <view class="row">
        <StatCard :value="data.courses.length" label="Courses" />
        <StatCard :value="teacherProfile.studentCount" label="Students" />
        <StatCard :value="data.metrics.pendingLeaves" label="Pending" />
      </view>
    </view>

    <view class="section">
      <text class="section-title">Assigned Courses</text>
      <DataCard
        v-for="course in data.courses"
        :key="course._id"
        :title="course.code + ' ' + course.name"
        :subtitle="course.schedule + ' · ' + course.credits + ' credits'"
      />
    </view>

    <view class="section">
      <text class="section-title">At-Risk Students</text>
      <text class="section-hint">Students with 3+ absences</text>
      <template v-if="!atRiskStudents.length">
        <text class="muted">No at-risk students detected.</text>
      </template>
      <DataCard
        v-for="student in atRiskStudents"
        :key="student.studentId"
        :title="student.studentName"
        :subtitle="'Absent: ' + student.absenceCount + ' times across ' + student.courseCount + ' course(s)'"
      >
        <StatusBadge status="absent" />
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
        :title="item.studentName + ' · ' + item.courseName"
        :subtitle="item.date + ' · ' + item.reason"
      >
        <view style="display:flex;gap:8rpx">
          <button class="primary-btn" @click="review(item, 'approved')">Approve</button>
          <button class="danger-btn" @click="review(item, 'rejected')">Reject</button>
        </view>
      </DataCard>
    </view>

    <view class="section">
      <text class="section-title">Evaluation Snapshot</text>
      <DataCard
        v-for="item in data.evaluationSummary"
        :key="item.courseId"
        :title="item.courseName"
        :subtitle="'Average ' + item.average + ' / 5 · ' + item.count + ' response(s)'"
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
import { clearSession, getSession, requireRole } from '../../common/session.js'

const TEACHER_PROFILE = {
  department: 'Computer Science',
  title: 'Professor',
  studentCount: 45
}

export default {
  components: { PageHeader, NavTabs, DataCard, StatusBadge, StatCard },
  data() {
    return {
      session: {},
      teacherProfile: TEACHER_PROFILE,
      data: {
        courses: [],
        attendance: [],
        leaveRequests: [],
        evaluationSummary: [],
        metrics: { courses: 0, pendingLeaves: 0, evaluations: 0 }
      }
    }
  },
  computed: {
    atRiskStudents() {
      const courseIds = this.data.courses.map(c => c._id)
      const relevantAttendance = this.data.attendance.filter(a =>
        courseIds.includes(a.courseId)
      )
      const grouped = {}
      relevantAttendance.forEach(a => {
        if (a.status !== 'absent') return
        if (!grouped[a.studentId]) {
          grouped[a.studentId] = { count: 0, courseIds: new Set() }
        }
        grouped[a.studentId].count++
        grouped[a.studentId].courseIds.add(a.courseId)
      })
      return Object.entries(grouped)
        .filter(([, d]) => d.count >= 3)
        .map(([studentId, d]) => ({
          studentId,
          studentName: this.findStudentName(studentId),
          absenceCount: d.count,
          courseCount: d.courseIds.size
        }))
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
    findStudentName(studentId) {
      const leave = this.data.leaveRequests.find(l => l.studentId === studentId)
      return leave ? leave.studentName : studentId
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
    logout() {
      clearSession()
      uni.reLaunch({ url: '/pages/login/login' })
    }
  }
}
</script>

<style scoped>
.section {
  margin-bottom: 24rpx;
  padding: 24rpx;
  background: #ffffff;
  border: 1rpx solid #e5e7eb;
  border-radius: 8rpx;
}

.section-title {
  display: block;
  margin-bottom: 14rpx;
  color: #0f172a;
  font-size: 32rpx;
  font-weight: 700;
}

.section-hint {
  display: block;
  margin-bottom: 10rpx;
  color: #94a3b8;
  font-size: 22rpx;
}

.muted {
  color: #64748b;
  font-size: 24rpx;
}

.primary-btn {
  min-width: 140rpx;
  margin: 0;
  background: #2563eb;
  color: #ffffff;
  border-radius: 8rpx;
  font-size: 24rpx;
  line-height: 2.2;
}

.danger-btn {
  min-width: 140rpx;
  margin: 0;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 8rpx;
  font-size: 24rpx;
  line-height: 2.2;
}
</style>
