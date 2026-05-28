<template>
  <view class="assistant-container">
    <scroll-view class="message-list" scroll-y="true" :scroll-top="scrollTop">
      <view v-for="(msg, index) in messages" :key="index" :class="['message-item', msg.role]">
        <view class="avatar">
          <text v-if="msg.role === 'user'">Me</text>
          <text v-else>AI</text>
        </view>
        <view class="message-content">
          <text class="content-text">{{ msg.content }}</text>
          <view v-if="msg.source" class="source-tag">Source: {{ msg.source }}</view>
        </view>
      </view>
      <view v-if="loading" class="message-item assistant">
        <view class="avatar">AI</view>
        <view class="message-content">
          <text class="loading-text">Retrieving knowledge base...</text>
        </view>
      </view>
    </scroll-view>

    <view class="input-area">
      <input 
        v-model="inputText" 
        placeholder="Enter your question..."
        @confirm="sendMessage"
        :disabled="loading"
      />
      <button 
        class="send-btn" 
        @click="sendMessage" 
        :disabled="loading || !inputText.trim()"
      >
        Send
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { callAiemsFunction } from '../../common/api.js'
import { getSession } from '../../common/session.js'

const inputText = ref('')
const messages = ref([
  {
    role: 'assistant',
    content: 'Hello! I am the AI Academic Assistant. I can answer questions about school policies, courses, and common issues. How can I help you?',
    source: 'System Welcome'
  }
])
const loading = ref(false)
const scrollTop = ref(0)

const sendMessage = async () => {
  if (!inputText.value.trim() || loading.value) return

  messages.value.push({
    role: 'user',
    content: inputText.value.trim()
  })
  const question = inputText.value
  inputText.value = ''
  loading.value = true

  await nextTick()
  scrollTop.value = 999999

  try {
    const res = await callAiemsFunction('ask-assistant', {
      session: getSession(),
      query: question
    })

    if (res.ok && res.data) {
      messages.value.push({
        role: 'assistant',
        content: res.data.answer || 'No answer returned from the assistant.',
        source: res.data.source || res.data.sourceTitle || 'System Prompt'
      })
    } else {
      messages.value.push({
        role: 'assistant',
        content: res.message || 'Unable to get a response from the assistant.',
        source: 'System Prompt'
      })
    }

  } catch (error) {
    messages.value.push({
      role: 'assistant',
      content: 'Network connection failed. Please check your connection and try again.',
      source: 'System Prompt'
    })
  } finally {
    loading.value = false
    await nextTick()
    scrollTop.value = 999999
  }
}
</script>

<style scoped>
.assistant-container {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #f5f7fa;
  padding-bottom: 180rpx;
}

.message-list {
  flex: 1;
  padding: 20rpx;
  padding-bottom: 220rpx;
}

.message-item {
  display: flex;
  margin-bottom: 30rpx;
  align-items: flex-start;
}

.message-item.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background-color: #409eff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  flex-shrink: 0;
}

.message-item.user .avatar {
  background-color: #67c23a;
}

.message-content {
  max-width: 70%;
  margin: 0 20rpx;
  padding: 20rpx 30rpx;
  border-radius: 20rpx;
  background-color: white;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
}

.message-item.user .message-content {
  background-color: #ecf5ff;
}

.content-text {
  font-size: 28rpx;
  line-height: 1.6;
  color: #333;
}

.source-tag {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #909399;
}

.loading-text {
  font-size: 28rpx;
  color: #909399;
}

.input-area {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  padding: 20rpx;
  background-color: white;
  border-top: 1rpx solid #ebeef5;
  align-items: center;
  z-index: 10;
}

.input-area input {
  flex: 1;
  height: 70rpx;
  padding: 0 20rpx;
  border: 1rpx solid #dcdfe6;
  border-radius: 35rpx;
  font-size: 28rpx;
}

.send-btn {
  width: 120rpx;
  height: 70rpx;
  margin-left: 20rpx;
  background-color: #409eff;
  color: white;
  border: none;
  border-radius: 35rpx;
  font-size: 28rpx;
}

.send-btn:disabled {
  background-color: #c0c4cc;
}
</style>