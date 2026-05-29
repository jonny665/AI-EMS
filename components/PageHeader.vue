<template>
  <view class="page-header">
    <view class="header-row">
      <view class="header-left">
        <text class="header-title">{{ title }}</text>
        <text class="header-sub">{{ displayName }} - {{ username }}</text>
      </view>
      <view class="header-right">
        <slot></slot>
        <button class="logout-btn" @click="handleLogout">Logout</button>
      </view>
    </view>
  </view>
</template>

<script>
import { clearSession } from '../common/session.js'

export default {
  props: {
    title: { type: String, required: true },
    displayName: { type: String, default: '' },
    username: { type: String, default: '' }
  },
  methods: {
    handleLogout() {
      clearSession()
      uni.reLaunch({ url: '/pages/login/login' })
    }
  }
}
</script>

<style scoped>
.page-header {
  margin-bottom: 20rpx;
  padding: 24rpx 28rpx;
  background: #ffffff;
  border-bottom: 1rpx solid #e5e7eb;
}

.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.header-left {
  flex: 1;
}

.header-title {
  display: block;
  color: #0f172a;
  font-size: 36rpx;
  font-weight: 700;
}

.header-sub {
  display: block;
  margin-top: 6rpx;
  color: #64748b;
  font-size: 24rpx;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}

.logout-btn {
  margin: 0;
  padding: 0 20rpx;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 8rpx;
  font-size: 24rpx;
  line-height: 2.2;
}
</style>
