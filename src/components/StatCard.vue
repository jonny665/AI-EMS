<template>
  <view class="stat-card">
    <text class="stat-value">{{ value }}</text>
    <text class="stat-label">{{ label }}</text>
  </view>
</template>

<script>
export default {
  props: {
    value: { type: [String, Number], required: true },
    label: { type: String, required: true }
  }
}
</script>

<style scoped>
.stat-card {
  flex: 1;
  min-width: 180rpx;
  padding: 20rpx 12rpx;
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
  text-align: center;
}

.stat-value {
  display: block;
  color: #0f172a;
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  display: block;
  margin-top: 6rpx;
  color: #64748b;
  font-size: 22rpx;
}
</style>
