<template>
  <view class="page login-page">
    <view class="hero">
      <text class="title">AI-EMS</text>
      <text class="subtitle">Educational Management System</text>
    </view>

    <view class="section">
      <text class="section-title">Login</text>
      <view class="field">
        <text class="label">Username</text>
        <input v-model="username" placeholder="Enter username" />
      </view>
      <view class="field">
        <view class="field-head">
          <text class="label">Password</text>
          <text class="toggle-link" @click="togglePassword">{{ showPassword ? 'Hide' : 'Show' }}</text>
        </view>
        <view class="password-row">
          <input v-model="password" class="password-input" :password="!showPassword" placeholder="Enter password" />
        </view>
      </view>
      <button class="primary-btn full-btn" :loading="loading" @click="login">Login</button>
      <text v-if="message" class="error">{{ message }}</text>
    </view>
  </view>
</template>

<script>
import { callAiemsFunction } from '../../common/api.js'
import { dashboardUrl, setSession } from '../../common/session.js'

export default {
  data() {
    return {
      username: '',
      password: '',
      showPassword: false,
      loading: false,
      message: ''
    }
  },
  methods: {
    togglePassword() {
      this.showPassword = !this.showPassword
    },
    async login() {
      this.loading = true
      this.message = ''
      const result = await callAiemsFunction('auth-login', {
        username: this.username.trim(),
        password: this.password
      })
      this.loading = false

      if (!result.ok) {
        this.message = result.message || 'Login failed.'
        return
      }

      setSession(result.user)
      uni.reLaunch({ url: dashboardUrl(result.user.role) })
    }
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: #eef4ff;
}

.hero {
  padding: 56rpx 10rpx 24rpx;
}

.title {
  display: block;
  color: #0f172a;
  font-size: 56rpx;
  font-weight: 800;
}

.subtitle {
  display: block;
  margin-top: 8rpx;
  color: #475569;
  font-size: 26rpx;
}

.field {
  margin-bottom: 18rpx;
}

.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 10rpx;
}

.password-row {
  display: flex;
  align-items: center;
}

.password-input {
  flex: 1;
  width: auto;
}

.toggle-link {
  color: #2563eb;
  font-size: 24rpx;
}

.full-btn {
  width: 100%;
  margin-top: 24rpx;
}

.error {
  display: block;
  margin-top: 18rpx;
  color: #b91c1c;
  font-size: 24rpx;
}

</style>
