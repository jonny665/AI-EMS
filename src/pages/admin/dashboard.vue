<template>
  <view class="page">
    <PageHeader
      title="Admin Dashboard"
      :displayName="session.displayName"
      :username="session.username"
    >
      <button class="secondary-btn refresh-btn" :loading="loading" @click="refresh">Refresh</button>
    </PageHeader>

    <NavTabs :role="session.role" current="dashboard" />

    <view class="section">
      <view class="section-head">
        <view>
          <text class="section-title">System Overview</text>
          <text class="muted">Role-based academic operations</text>
        </view>
        <text class="muted">{{ lastUpdatedText }}</text>
      </view>
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
      <text class="section-title">Profile Change Reviews</text>
      <view class="field">
        <text class="label">Review Comment</text>
        <textarea v-model="profileReviewComment" placeholder="Optional note" />
      </view>
      <template v-if="!data.profileChangeRequests.length">
        <text class="muted">No pending profile changes.</text>
      </template>
      <DataCard
        v-for="item in data.profileChangeRequests"
        :key="item._id"
        :title="profileRequestTitle(item)"
        :subtitle="formatChangeRequest(item)"
      >
        <view class="inline-actions">
          <button class="primary-btn compact-btn" @click="reviewProfile(item, 'approved')">Approve</button>
          <button class="danger-btn compact-btn" @click="reviewProfile(item, 'rejected')">Reject</button>
        </view>
      </DataCard>
    </view>

    <view class="section">
      <text class="section-title">Pending Leave Requests</text>
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
          <button class="primary-btn compact-btn" @click="reviewLeave(item, 'approved')">Approve</button>
          <button class="danger-btn compact-btn" @click="reviewLeave(item, 'rejected')">Reject</button>
        </view>
      </DataCard>
    </view>

    <view class="section">
      <text class="section-title">Course Quality Monitor</text>
      <template v-if="!data.evaluationSummary.length">
        <text class="muted">No evaluation summary yet.</text>
      </template>
      <DataCard
        v-for="item in data.evaluationSummary"
        :key="item.courseOfferingId || item.courseId"
        :title="item.courseName"
        :subtitle="'Average ' + item.average + ' / 5 - ' + item.count + ' response(s)'"
      >
        <StatusBadge :status="item.average < 3 ? 'high' : 'present'" />
      </DataCard>
    </view>

    <view class="section">
      <text class="section-title">Quick Actions</text>
      <view class="btn-row">
        <button class="primary-btn" @click="go('/pages/leave/leave')">Leave Reviews</button>
        <button class="primary-btn" @click="go('/pages/evaluation/evaluation')">Evaluations</button>
        <button class="primary-btn" @click="go('/pages/materials/materials')">Materials</button>
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
import StatusBadge from '../../components/StatusBadge.vue'
import { callAiemsFunction } from '../../common/api.js'
import { getSession, requireRole } from '../../common/session.js'

export default {
  components: { PageHeader, NavTabs, DataCard, StatCard, StatusBadge },
  data() {
    return {
      session: {},
      loading: false,
      lastUpdatedAt: 0,
      profileReviewComment: '',
      sysStats: {
        totalStudents: 0,
        totalTeachers: 0,
        activeCourses: 0
      },
      data: {
        leaveRequests: [],
        profileChangeRequests: [],
        evaluationSummary: [],
        atRiskStudents: [],
        metrics: { courses: 0, pendingLeaves: 0, evaluations: 0, profileChanges: 0, riskStudents: 0 }
      }
    }
  },
  computed: {
    metricList() {
      return [
        { label: 'Courses', value: this.data.metrics.courses },
        { label: 'Pending Leaves', value: this.data.metrics.pendingLeaves },
        { label: 'Evaluations Submitted', value: this.data.metrics.evaluations },
        { label: 'Profile Reviews', value: this.data.metrics.profileChanges },
        { label: 'At-Risk Students', value: this.data.metrics.riskStudents }
      ]
    },
    lastUpdatedText() {
      return this.lastUpdatedAt ? 'Updated ' + this.formatTime(this.lastUpdatedAt) : ''
    }
  },
  onShow() {
    const session = requireRole(['admin'])
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
          leaveRequests: result.data.leaveRequests || [],
          profileChangeRequests: result.data.profileChangeRequests || [],
          evaluationSummary: result.data.evaluationSummary || [],
          atRiskStudents: result.data.atRiskStudents || [],
          metrics: result.data.metrics || this.data.metrics
        }
        this.sysStats = result.data.systemStats || this.sysStats
        this.lastUpdatedAt = Date.now()
      }
    },
    refresh() {
      this.load(true)
    },
    async reviewLeave(item, decision) {
      const result = await callAiemsFunction('review-leave', {
        session: getSession(),
        leaveId: item._id,
        decision
      })
      this.afterReview(result, decision)
    },
    async reviewProfile(item, decision) {
      const result = await callAiemsFunction('review-profile-change', {
        session: getSession(),
        requestId: item._id,
        decision,
        reviewComment: this.profileReviewComment.trim()
      })
      this.afterReview(result, decision)
    },
    afterReview(result, decision) {
      if (result.ok) {
        uni.showToast({ title: decision === 'approved' ? 'Approved' : 'Rejected', icon: 'success' })
        this.load(true)
        return
      }
      uni.showToast({ title: result.message || 'Review failed.', icon: 'none' })
    },
    profileRequestTitle(item) {
      return [item.requesterName || item.requester_user_id, item.targetType || item.target_type].filter(Boolean).join(' - ')
    },
    formatChangeRequest(item) {
      const changes = item.changes || {}
      return Object.keys(changes).map(key => {
        const change = changes[key] || {}
        return (change.label || key) + ': ' + change.oldValue + ' -> ' + change.newValue
      }).join('; ')
    },
    formatTime(value) {
      const date = new Date(value)
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    },
    go(url) {
      uni.navigateTo({ url })
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

.inline-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.compact-btn {
  min-width: 126rpx;
  font-size: 24rpx;
}
</style>
