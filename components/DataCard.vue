<template>
  <view class="data-card">
    <view class="data-card-body">
      <view class="data-card-main">
        <text class="data-card-title">{{ title }}</text>
        <text v-if="subtitle" class="data-card-sub">{{ subtitle }}</text>
      </view>
      <view v-if="$slots.default" class="data-card-extra">
        <slot></slot>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  props: {
    title: { type: String, required: true },
    subtitle: { type: String, default: '' }
  }
}
</script>

<style scoped>
.data-card {
  margin-top: 16rpx;
  padding: 18rpx;
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
}

.data-card-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.data-card-main {
  flex: 1;
  min-width: 0;
}

.data-card-title {
  display: block;
  color: #111827;
  font-size: 28rpx;
}

.data-card-sub {
  display: block;
  margin-top: 4rpx;
  color: #64748b;
  font-size: 24rpx;
}

.data-card-extra {
  flex-shrink: 0;
  margin-left: 16rpx;
}
</style>
