<template>
  <view class="page">
    <view class="section">
      <view class="row">
        <view>
          <text class="section-title">AI Assistant</text>
          <text class="muted">Local knowledge-base retrieval with fallback</text>
        </view>
        <button class="secondary-btn" @click="backHome">Home</button>
      </view>
    </view>

    <view class="section">
      <text class="section-title">Ask a Question</text>
      <textarea v-model="query" placeholder="Try: How does leave approval affect attendance?" />
      <button class="primary-btn full-btn" :loading="loading" @click="ask">Ask</button>
    </view>

    <view v-if="answer" class="section">
      <text class="section-title">Answer</text>
      <view class="card">
        <text class="value">{{ answer.answer }}</text>
        <text class="muted">Source: {{ answer.sourceTitle }} · Grounded: {{ answer.grounded ? 'yes' : 'no' }}</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">Suggested Questions</text>
      <view v-for="item in suggestions" :key="item" class="card" @click="query = item">
        <text class="value">{{ item }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { callAiemsFunction } from '../../common/api.js'
import { dashboardUrl, getSession, requireRole } from '../../common/session.js'

export default {
  data() {
    return {
      session: {},
      query: 'How does leave approval affect attendance?',
      answer: null,
      loading: false,
      suggestions: [
        'How does leave approval affect attendance?',
        'Can teachers see anonymous evaluation identities?',
        'What should I check before graduation?',
        'Can the assistant generate official documents?'
      ]
    }
  },
  onLoad() {
    const session = requireRole(['student', 'teacher', 'admin'])
    if (session) this.session = session
  },
  methods: {
    async ask() {
      if (!this.query.trim()) {
        uni.showToast({ title: 'Please enter a question.', icon: 'none' })
        return
      }
      this.loading = true
      const result = await callAiemsFunction('ask-assistant', {
        session: getSession(),
        query: this.query.trim()
      })
      this.loading = false
      if (result.ok) this.answer = result.data
    },
    backHome() {
      uni.reLaunch({ url: dashboardUrl(this.session.role) })
    }
  }
}
</script>

<style scoped>
.full-btn {
  width: 100%;
  margin-top: 18rpx;
}
</style>
