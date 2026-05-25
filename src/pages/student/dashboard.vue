<template>
  <view class="page">
    <PageHeader
      title="Student Dashboard"
      :displayName="session.displayName"
      :username="session.username"
    >
    </PageHeader>

    <NavTabs :role="session.role" current="dashboard" />

    <view class="section">
      <text class="section-title">Academic Overview</text>
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
      <text class="section-title">My Courses</text>
      <DataCard
        v-for="course in data.courses"
        :key="course._id"
        :title="course.code + ' ' + course.name"
        :subtitle="course.schedule + ' · ' + course.credits + ' credits'"
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
        :title="item.date + '  ' + courseLabel(item.courseId)"
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
        :subtitle="item.date + ' · ' + item.reason"
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
import { clearSession, getSession, requireRole } from '../../common/session.js'

const STUDENT_PROFILE = {
  major: 'Software Engineering',
  gpa: 3.6,
  creditsEarned: 45,
  totalCredits: 120,
  enrollmentYear: 2024
}

export default {
  components: { PageHeader, NavTabs, DataCard, StatusBadge, ProgressBar, StatCard },
  data() {
    return {
      session: {},
      profile: STUDENT_PROFILE,
      data: {
        courses: [],
        attendance: [],
        leaveRequests: []
      }
    }
  },
  computed: {
    attendanceRate() {
      const records = this.data.attendance
      if (!records.length) return 0
      const present = records.filter(r => r.status === 'present').length
      return Math.round(present / records.length * 100)
    },
    creditText() {
      return this.profile.creditsEarned + ' / ' + this.profile.totalCredits
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
      const course = this.data.courses.find(c => c._id === courseId)
      return course ? course.code + ' ' + course.name : courseId
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
</style>
