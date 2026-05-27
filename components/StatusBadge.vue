<template>
  <text class="status-badge" :style="badgeStyle">{{ label }}</text>
</template>

<script>
const STYLE_MAP = {
  present:  { bg: '#dcfce7', text: '#16a34a' },
  approved: { bg: '#dcfce7', text: '#16a34a' },
  absent:   { bg: '#fee2e2', text: '#dc2626' },
  rejected: { bg: '#fee2e2', text: '#dc2626' },
  on_leave: { bg: '#fff7ed', text: '#ea580c' },
  pending:  { bg: '#fefce8', text: '#ca8a04' }
}

const LABEL_MAP = {
  present: 'Present',
  approved: 'Approved',
  absent: 'Absent',
  rejected: 'Rejected',
  on_leave: 'On Leave',
  pending: 'Pending'
}

export default {
  props: {
    status: { type: String, required: true }
  },
  computed: {
    label() {
      return LABEL_MAP[this.status] || this.status
    },
    badgeStyle() {
      const s = STYLE_MAP[this.status] || { bg: '#f1f5f9', text: '#475569' }
      return `background:${s.bg};color:${s.text}`
    }
  }
}
</script>

<style scoped>
.status-badge {
  display: inline-block;
  padding: 4rpx 16rpx;
  border-radius: 6rpx;
  font-size: 22rpx;
  font-weight: 600;
  white-space: nowrap;
}
</style>
