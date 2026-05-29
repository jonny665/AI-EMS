<template>
  <view class="page">
    <PageHeader
      title="Admin Dashboard"
      :displayName="session.displayName"
      :username="session.username"
    >
    </PageHeader>

    <NavTabs :role="session.role" current="dashboard" />

    <view class="section">
      <text class="section-title">System Overview</text>
      <view class="row">
        <StatCard :value="sysStats.totalStudents" label="Students" />
        <StatCard :value="sysStats.totalTeachers" label="Teachers" />
        <StatCard :value="sysStats.activeCourses" label="Courses" />
      </view>
    </view>

    <view class="section">
      <text class="section-title">System Metrics</text>
      <DataCard
        v-for="m in metricList"
        :key="m.label"
        :title="String(m.value)"
        :subtitle="m.label"
      />
    </view>

    <view class="section">
      <text class="section-title">Pending Leave Requests</text>
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
      <text class="section-title">Quick Actions</text>
      <view class="btn-row">
        <button class="primary-btn" @click="go('/pages/leave/leave')">Leave Reviews</button>
        <button class="primary-btn" @click="go('/pages/evaluation/evaluation')">Evaluations</button>
        <button class="primary-btn" @click="go('/pages/assistant/assistant')">Assistant</button>
      </view>
    </view>
  </view>
</template>

<script>
import PageHeader from '../../components/PageHeader.vue'
import NavTabs from '../../components/NavTabs.vue'
import DataCard from '../../components/DataCard.vue'
import StatCard from '../../components/StatCard.vue'
import { callAiemsFunction } from '../../common/api.js'
import { clearSession, getSession, requireRole } from '../../common/session.js'

const SYSTEM_STATS = {
  totalStudents: 2000,
  totalTeachers: 200,
  activeCourses: 45
}

export default {
  components: { PageHeader, NavTabs, DataCard, StatCard },
  data() {
    return {
      session: {},
      sysStats: SYSTEM_STATS,
      data: {
        leaveRequests: [],
        metrics: { courses: 0, pendingLeaves: 0, evaluations: 0 }
      }
    }
  },
  computed: {
    metricList() {
      return [
        { label: 'Courses', value: this.data.metrics.courses },
        { label: 'Pending Leaves', value: this.data.metrics.pendingLeaves },
        { label: 'Evaluations Submitted', value: this.data.metrics.evaluations }
      ]
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

.muted {
  color: #64748b;
  font-size: 24rpx;
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.primary-btn {
  min-width: 180rpx;
  margin: 0;
  background: #2563eb;
  color: #ffffff;
  border-radius: 8rpx;
  font-size: 26rpx;
  line-height: 2.5;
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
