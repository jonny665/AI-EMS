<template>
  <view class="assistant-shell">
    <view class="chat-main">
      <view class="chat-header">
        <view>
          <text class="chat-title">AI Assistant</text>
          <text class="chat-subtitle">Local knowledge-base retrieval</text>
        </view>
        <button class="header-btn" @click="backHome">Home</button>
      </view>

      <scroll-view scroll-y class="message-scroll" :scroll-into-view="scrollAnchor">
        <view v-if="!messages.length" class="empty-state">
          <text class="empty-title">Local Knowledge Q&A</text>
          <text class="empty-copy">Ask a question after importing records into the knowledge_base collection.</text>
        </view>

        <view
          v-for="message in messages"
          :id="message.id"
          :key="message.id"
          class="message-row"
          :class="message.role"
        >
          <view class="role-dot">{{ message.role === 'user' ? 'You' : 'KB' }}</view>
          <view class="message-card">
            <text class="message-text">{{ message.content }}</text>
            <view v-if="message.sourceTitle" class="source-row">
              <text class="source-label">Source</text>
              <text class="source-title">{{ message.sourceTitle }}</text>
            </view>
          </view>
        </view>

        <view id="bottomAnchor" class="bottom-anchor"></view>
      </scroll-view>
    </view>

    <view class="composer-wrap">
      <view class="composer">
        <textarea
          v-model="query"
          auto-height
          maxlength="500"
          :disabled="loading"
          placeholder="Ask the local knowledge base"
          class="composer-input"
        />
        <button class="send-btn" :loading="loading" @click="ask">&gt;</button>
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
      query: '',
      messages: [],
      currentConversationId: '',
      loading: false,
      scrollAnchor: ''
    }
  },
  onShow() {
    const session = requireRole(['student', 'teacher', 'admin'])
    if (!session) return
    this.session = session
    this.loadHistory()
  },
  methods: {
    async loadHistory() {
      const result = await callAiemsFunction('get-ai-history', {
        session: getSession(),
        forceRefresh: true
      })
      if (!result.ok) return
      const data = result.data || {}
      this.currentConversationId = data.activeConversationId || ''
      this.messages = (data.messages || []).map(item =>
        this.buildMessage(
          item.role,
          item.content,
          item.citations && item.citations[0] ? item.citations[0].title || '' : '',
          item._id
        )
      )
      this.scrollToBottom()
    },
    async ask() {
      const question = this.query.trim()
      if (!question) {
        uni.showToast({ title: 'Please enter a question.', icon: 'none' })
        return
      }

      this.messages.push(this.buildMessage('user', question))
      this.query = ''
      this.loading = true
      this.scrollToBottom()

      const result = await callAiemsFunction('ask-assistant', {
        session: getSession(),
        conversationId: this.currentConversationId,
        query: question,
        history: this.messages.slice(-10)
      })
      this.loading = false

      if (result.ok) {
        const data = result.data || {}
        this.currentConversationId = data.conversationId || this.currentConversationId
        this.messages.push(this.buildMessage('assistant', data.answer || '', data.sourceTitle || ''))
        this.scrollToBottom()
        return
      }

      uni.showToast({ title: result.message || 'Query failed.', icon: 'none' })
    },
    buildMessage(role, content, sourceTitle = '', id = '') {
      return {
        id: id || `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role,
        content,
        sourceTitle
      }
    },
    scrollToBottom() {
      this.$nextTick(() => {
        this.scrollAnchor = ''
        setTimeout(() => {
          this.scrollAnchor = 'bottomAnchor'
        }, 20)
      })
    },
    backHome() {
      uni.reLaunch({ url: dashboardUrl(this.session.role) })
    }
  }
}
</script>

<style scoped>
.assistant-shell {
  min-height: 100vh;
  padding-bottom: 190rpx;
  background: #141414;
  color: #f3f4f6;
  box-sizing: border-box;
}

.chat-main {
  width: 100%;
  max-width: 1080rpx;
  margin: 0 auto;
  padding: 34rpx 28rpx 0;
  box-sizing: border-box;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 28rpx;
}

.chat-title,
.empty-title {
  display: block;
  color: #f7f7f7;
  font-size: 38rpx;
  font-weight: 700;
  line-height: 1.25;
}

.chat-subtitle,
.empty-copy {
  display: block;
  margin-top: 8rpx;
  color: #a3a3a3;
  font-size: 24rpx;
  line-height: 1.5;
}

.header-btn {
  flex: 0 0 auto;
  margin: 0;
  padding: 0 26rpx;
  background: #242424;
  color: #f4f4f5;
  border: 1rpx solid #3f3f46;
  border-radius: 30rpx;
  font-size: 24rpx;
  line-height: 2.5;
}

.message-scroll {
  height: calc(100vh - 280rpx);
}

.empty-state {
  margin-top: 22vh;
  text-align: center;
}

.message-row {
  display: flex;
  gap: 18rpx;
  margin-bottom: 22rpx;
}

.message-row.user {
  flex-direction: row-reverse;
}

.role-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 58rpx;
  height: 58rpx;
  flex: 0 0 58rpx;
  background: #2f2f2f;
  color: #d4d4d8;
  border-radius: 50%;
  font-size: 20rpx;
  font-weight: 700;
}

.message-card {
  max-width: 760rpx;
  padding: 22rpx 24rpx;
  background: #202020;
  border: 1rpx solid #333333;
  border-radius: 8rpx;
  box-sizing: border-box;
}

.message-row.user .message-card {
  background: #2d2d2d;
}

.message-text {
  display: block;
  color: #f5f5f5;
  font-size: 28rpx;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.source-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #3f3f46;
}

.source-label {
  color: #8bcbff;
  font-size: 22rpx;
}

.source-title {
  color: #d4d4d8;
  font-size: 22rpx;
}

.bottom-anchor {
  height: 12rpx;
}

.composer-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 22rpx 28rpx 34rpx;
  background: linear-gradient(180deg, rgba(20, 20, 20, 0), #141414 32%);
  box-sizing: border-box;
}

.composer {
  display: flex;
  align-items: flex-end;
  gap: 16rpx;
  width: 100%;
  max-width: 1080rpx;
  margin: 0 auto;
  padding: 18rpx 18rpx 18rpx 26rpx;
  background: #2b2b2b;
  border: 1rpx solid #3d3d3d;
  border-radius: 34rpx;
  box-sizing: border-box;
}

.composer-input {
  min-height: 56rpx;
  max-height: 180rpx;
  flex: 1;
  color: #f5f5f5;
  font-size: 28rpx;
  line-height: 1.55;
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 66rpx;
  height: 66rpx;
  flex: 0 0 66rpx;
  margin: 0;
  padding: 0;
  background: #f4f4f5;
  color: #18181b;
  border-radius: 50%;
  font-size: 34rpx;
  font-weight: 700;
  line-height: 66rpx;
}
</style>
