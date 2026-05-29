<template>
  <view class="nav-tabs">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="nav-btn"
      :class="tab.key === current ? 'nav-btn-active' : ''"
      :disabled="tab.key === current"
      @click="go(tab.url)"
    >
      {{ tab.label }}
    </button>
  </view>
</template>

<script>
export default {
  props: {
    role: { type: String, required: true },
    current: { type: String, required: true }
  },
  computed: {
    tabs() {
      const roleDashboard = `/pages/${this.role}/dashboard`
      const tabs = [
        { key: 'dashboard', url: roleDashboard, label: 'Dashboard' },
        { key: 'leave', url: '/pages/leave/leave', label: 'Leave' },
        { key: 'evaluation', url: '/pages/evaluation/evaluation', label: 'Evaluation' },
        { key: 'materials', url: '/pages/materials/materials', label: 'Materials' },
        { key: 'assistant', url: '/pages/assistant/assistant', label: 'Assistant' }
      ]
      return tabs
    }
  },
  methods: {
    go(url) {
      uni.navigateTo({ url })
    }
  }
}
</script>

<style scoped>
.nav-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 0 28rpx 20rpx 28rpx;
}

.nav-btn {
  flex: 1;
  min-width: 140rpx;
  margin: 0;
  padding: 0;
  background: #e2e8f0;
  color: #475569;
  border-radius: 8rpx;
  font-size: 26rpx;
  line-height: 2.5;
  text-align: center;
}

.nav-btn-active {
  background: #2563eb;
  color: #ffffff;
  font-weight: 600;
}
</style>
