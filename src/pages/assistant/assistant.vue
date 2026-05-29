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

        <view v-for="message in messages" :id="message.id" :key="message.id" class="message-row" :class="message.role">
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
        <textarea v-model="query" auto-height maxlength="500" :disabled="loading"
          placeholder="Ask the local knowledge base" class="composer-input" />
        <button class="send-btn" :loading="loading" @click="ask">&gt;</button>
      </view>
    </view>
  </view>
</template>

<script>
  import {
    callAiemsFunction
  } from '../../common/api.js'
  import {
    dashboardUrl,
    getSession,
    requireRole
  } from '../../common/session.js'

  export default {
    data() {
      return {
        session: {},
        query: '',
        messages: [],
        currentConversationId: '',
        loading: false,
        scrollAnchor: '',
        lastLoadedAt: 0,
        historyTtlMs: 45000
      }
    },
    onShow() {
      const session = requireRole(['student', 'teacher', 'admin'])
      if (!session) return
      this.session = session
      this.lockPageScroll()
      const now = Date.now()
      if (!this.messages.length || now - this.lastLoadedAt > this.historyTtlMs) {
        this.loadHistory()
      }
    },
    onHide() {
      this.unlockPageScroll()
    },
    onUnload() {
      this.unlockPageScroll()
    },
    methods: {
      lockPageScroll() {
        // H5 wraps pages outside the component tree, so the outer document must be locked too.
        if (typeof document === 'undefined') return
        document.documentElement.classList.add('ai-ems-assistant-lock')
        document.body.classList.add('ai-ems-assistant-lock')
      },
      unlockPageScroll() {
        if (typeof document === 'undefined') return
        document.documentElement.classList.remove('ai-ems-assistant-lock')
        document.body.classList.remove('ai-ems-assistant-lock')
      },
      async loadHistory(forceRefresh = false) {
        const result = await callAiemsFunction('get-ai-history', {
          session: getSession(),
          forceRefresh,
          skipRetentionCleanup: true
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
        this.lastLoadedAt = Date.now()
        this.scrollToBottom()
      },
      async ask() {
        const question = this.query.trim()
        if (!question) {
          uni.showToast({
            title: 'Please enter a question.',
            icon: 'none'
          })
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
          this.lastLoadedAt = Date.now()
          this.scrollToBottom()
          return
        }

        uni.showToast({
          title: result.message || 'Query failed.',
          icon: 'none'
        })
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
        if (!this.messages || this.messages.length === 0) return;
        this.$nextTick(() => {
          this.scrollAnchor = ''
          setTimeout(() => {
            this.scrollAnchor = 'bottomAnchor'
          }, 20)
        })
      },
      backHome() {
        uni.reLaunch({
          url: dashboardUrl(this.session.role)
        })
      }
    }
  }
</script>

<style scoped>
  :global(html.ai-ems-assistant-lock),
  :global(body.ai-ems-assistant-lock),
  :global(body.ai-ems-assistant-lock uni-page-body),
  :global(body.ai-ems-assistant-lock uni-page-wrapper),
  :global(body.ai-ems-assistant-lock uni-page),
  :global(body.ai-ems-assistant-lock #app) {
    height: 100vh !important;
    overflow: hidden !important;
  }

  .assistant-shell {
    height: calc(100vh - 44px);
    height: calc(100dvh - 44px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #f7f8fa;
    color: #333333;
    box-sizing: border-box;
  }

  .chat-main {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
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
    color: #111827;
    font-size: 40rpx;
    font-weight: 800;
    line-height: 1.25;
  }

  .chat-subtitle,
  .empty-copy {
    display: block;
    margin-top: 8rpx;
    color: #6b7280;
    font-size: 26rpx;
    line-height: 1.5;
  }

  .header-btn {
    flex: 0 0 auto;
    margin: 0;
    padding: 0 32rpx;
    background: #ffffff;
    color: #374151;
    border: 1rpx solid #e5e7eb;
    border-radius: 40rpx;
    font-size: 26rpx;
    font-weight: 500;
    line-height: 2.5;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  }

  .message-scroll {
    flex: 1 1 auto;
    min-height: 0;
    height: 0;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 60vh;
    text-align: center;
  }

  .message-row {
    display: flex;
    gap: 20rpx;
    margin-bottom: 32rpx;
  }

  .message-row.user {
    flex-direction: row-reverse;
  }

  .role-dot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72rpx;
    height: 72rpx;
    flex: 0 0 72rpx;
    background: #ffffff;
    color: #4b5563;
    border: 1rpx solid #e5e7eb;
    border-radius: 50%;
    font-size: 22rpx;
    font-weight: bold;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.03);
  }

  .message-row.user .role-dot {
    background: #3b82f6;
    color: #ffffff;
    border: none;
    box-shadow: 0 4rpx 12rpx rgba(59, 130, 246, 0.3);
  }

  .message-card {
    max-width: 75%;
    padding: 24rpx 28rpx;
    background: #ffffff;
    border: 1rpx solid #e5e7eb;
    border-radius: 20rpx;
    border-top-left-radius: 4rpx;
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
    box-sizing: border-box;
  }

  .message-row.user .message-card {
    background: #3b82f6;
    border: none;
    border-radius: 20rpx;
    border-top-right-radius: 4rpx;
    box-shadow: 0 4rpx 16rpx rgba(59, 130, 246, 0.2);
  }

  .message-text {
    display: block;
    color: #1f2937;
    font-size: 28rpx;
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .message-row.user .message-text {
    color: #ffffff;
  }

  .source-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    margin-top: 20rpx;
    padding-top: 16rpx;
    border-top: 1rpx dashed #d1d5db;
  }

  .message-row.user .source-row {
    border-top: 1rpx dashed rgba(255, 255, 255, 0.3);
  }

  .source-label {
    padding: 2rpx 12rpx;
    background: #f3f4f6;
    color: #4b5563;
    border-radius: 12rpx;
    font-size: 20rpx;
    font-weight: 500;
  }

  .source-title {
    color: #6b7280;
    font-size: 22rpx;
    line-height: 1.4;
  }

  .bottom-anchor {
    height: 12rpx;
  }

  .composer-wrap {
    flex: 0 0 auto;
    width: 100%;
    padding: 16rpx 28rpx max(16rpx, env(safe-area-inset-bottom));
    background: #f7f8fa;
    box-sizing: border-box;
  }

  .composer {
    display: flex;
    align-items: flex-end;
    gap: 20rpx;
    width: 100%;
    max-width: 1080rpx;
    margin: 0 auto;
    padding: 20rpx 24rpx 20rpx 36rpx;
    background: #ffffff;
    border: 1rpx solid #e5e7eb;
    border-radius: 48rpx;
    box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
    box-sizing: border-box;
    transition: all 0.2s ease-in-out;
  }
  
  .composer:focus-within {
    border-color: #3b82f6;
    box-shadow: 0 8rpx 24rpx rgba(59, 130, 246, 0.1);
  }

  .composer-input {
    min-height: 48rpx;
    max-height: 200rpx;
    flex: 1;
    color: #1f2937;
    font-size: 30rpx;
    line-height: 1.5;
    padding-bottom: 12rpx;
  }

  .send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72rpx;
    height: 72rpx;
    flex: 0 0 72rpx;
    margin: 0;
    padding: 0;
    background: #3b82f6;
    color: #ffffff;
    border-radius: 50%;
    font-size: 36rpx;
    font-weight: bold;
    line-height: 72rpx;
    box-shadow: 0 4rpx 12rpx rgba(59, 130, 246, 0.3);
    transition: transform 0.1s;
  }
  
  .send-btn:active {
    transform: scale(0.95);
  }
</style>
