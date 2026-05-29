<template>
  <view class="progress-wrap">
    <view class="progress-header">
      <text class="progress-label">{{ label }}</text>
      <text class="progress-value">{{ percentage }}% ({{ current }}/{{ total }})</text>
    </view>
    <view class="progress-track">
      <view class="progress-fill" :style="fillStyle"></view>
    </view>
  </view>
</template>

<script>
export default {
  props: {
    current: { type: Number, required: true },
    total: { type: Number, required: true },
    label: { type: String, default: '' }
  },
  computed: {
    percentage() {
      if (!this.total) return 0
      return Math.round(this.current / this.total * 100)
    },
    barColor() {
      if (this.percentage < 60) return '#dc2626'
      if (this.percentage < 80) return '#ca8a04'
      return '#16a34a'
    },
    fillStyle() {
      return `width:${this.percentage}%;background:${this.barColor}`
    }
  }
}
</script>

<style scoped>
.progress-wrap {
  margin-top: 20rpx;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.progress-label {
  color: #334155;
  font-size: 24rpx;
  font-weight: 600;
}

.progress-value {
  color: #64748b;
  font-size: 22rpx;
}

.progress-track {
  height: 16rpx;
  background: #e2e8f0;
  border-radius: 8rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 8rpx;
  transition: width 0.4s ease;
}
</style>
