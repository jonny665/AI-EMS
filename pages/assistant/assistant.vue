<template>
  <view class="page">
    <PageHeader title="AI Assistant" :displayName="session.displayName" :username="session.username">
      <button class="secondary-btn" :disabled="loading" @click="newChat">New Chat</button>
    </PageHeader>
    <NavTabs :role="session.role" current="assistant" />

    <!-- Chat Section -->
    <view class="section">
      <view class="section-head">
        <view>
          <text class="section-title">Conversation</text>
          <text class="muted">{{ apiSettings.provider }} / {{ apiSettings.model }}</text>
        </view>
        <text class="muted" v-if="messages.length">{{ messages.length }} messages</text>
      </view>

      <scroll-view scroll-y class="chat-scroll" :scroll-into-view="scrollAnchor">
        <view v-if="!messages.length" class="empty-chat">
          <text class="empty-icon">💬</text>
          <text class="section-title">Ask me anything</text>
          <text class="muted">Questions are answered by DeepSeek with knowledge base retrieval.</text>
        </view>

        <view
          v-for="message in messages"
          :id="message.id"
          :key="message.id"
          class="msg-row"
          :class="message.role"
        >
          <view class="msg-bubble">
            <text class="msg-text">{{ message.content }}</text>
            <view v-if="message.sourceTitle" class="msg-source">
              <text class="msg-source-label">Source:</text>
              <text class="msg-source-title">{{ message.sourceTitle }}</text>
            </view>
          </view>
        </view>

        <view v-if="loading" class="msg-row assistant">
          <view class="msg-bubble">
            <text class="msg-text loading-dots">Thinking...</text>
          </view>
        </view>

        <view id="bottomAnchor" class="bottom-anchor"></view>
      </scroll-view>

      <view class="composer">
        <textarea
          v-model="query"
          auto-height
          maxlength="2000"
          :disabled="loading"
          placeholder="Ask a question..."
          class="composer-input"
          @confirm="ask"
        />
        <button class="primary-btn composer-btn" :loading="loading" @click="ask">Send</button>
      </view>
    </view>

    <!-- API Settings Section -->
    <view class="section">
      <view class="section-head">
        <text class="section-title">API Settings</text>
        <button class="secondary-btn" @click="showSettings = !showSettings">
          {{ showSettings ? 'Hide' : 'Configure' }}
        </button>
      </view>

      <view v-if="showSettings">
        <view class="field">
          <text class="label">Provider</text>
          <picker
            :value="providerIndex"
            :range="providers"
            class="picker-value"
            @change="onProviderChange"
          >
            <text>{{ apiSettings.provider || 'Select provider' }}</text>
          </picker>
        </view>

        <view class="field">
          <text class="label">API Key</text>
          <view class="api-key-row">
            <input
              :value="apiSettings.apiKey"
              :password="!showKey"
              placeholder="sk-..."
              class="api-key-input"
              @input="onKeyInput"
            />
            <button class="secondary-btn compact-btn" @click="showKey = !showKey">
              {{ showKey ? 'Hide' : 'Show' }}
            </button>
          </view>
        </view>

        <view class="field">
          <view class="row">
            <text class="label">Model</text>
            <button
              class="secondary-btn compact-btn"
              :loading="fetchingModels"
              @click="fetchModels"
              style="margin:0"
            >
              Refresh
            </button>
          </view>
          <picker
            :value="modelIndex"
            :range="modelOptions"
            class="picker-value"
            @change="onModelChange"
          >
            <text v-if="apiSettings.model">{{ apiSettings.model }}</text>
            <text v-else class="muted">Select or search…</text>
          </picker>
          <input
            :value="apiSettings.model"
            placeholder="Or type any model name…"
            class="api-key-input"
            style="margin-top:12rpx"
            @input="e => apiSettings.model = e.detail.value"
          />
        </view>

        <view class="row api-params">
          <view class="field param-half">
            <text class="label">Temperature ({{ apiSettings.temperature }})</text>
            <slider
              :value="apiSettings.temperature"
              :min="0"
              :max="2"
              :step="0.1"
              show-value
              activeColor="#2563eb"
              @change="onTempChange"
            />
          </view>
          <view class="field param-half">
            <text class="label">Max Tokens ({{ apiSettings.maxTokens }})</text>
            <slider
              :value="apiSettings.maxTokens"
              :min="256"
              :max="8192"
              :step="256"
              show-value
              activeColor="#2563eb"
              @change="onTokensChange"
            />
          </view>
        </view>

        <button class="primary-btn full-btn" @click="saveSettings">Save Settings</button>
        <text class="muted" style="display:block;margin-top:16rpx;text-align:center;">
          Settings are stored locally. API key is sent to the cloud function with each request.
        </text>
      </view>
    </view>
  </view>
</template>

<script>
import { callAiemsFunction } from '../../common/api.js'
import { getSession, requireRole } from '../../common/session.js'
import PageHeader from '../../components/PageHeader.vue'
import NavTabs from '../../components/NavTabs.vue'

const SETTINGS_KEY = 'ai_ems_api_settings'

const DEFAULT_SETTINGS = {
  provider: 'deepseek',
  apiKey: '',
  model: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 2048,
}

export default {
  components: { PageHeader, NavTabs },
  data() {
    return {
      session: {},
      query: '',
      messages: [],
      currentConversationId: '',
      loading: false,
      scrollAnchor: '',
      showSettings: false,
      showKey: false,
      apiSettings: { ...DEFAULT_SETTINGS },
      providers: ['deepseek', 'openai'],
      fetchedModels: [],
      fetchingModels: false,
    }
  },
  computed: {
    providerIndex() {
      const idx = this.providers.indexOf(this.apiSettings.provider)
      return idx >= 0 ? idx : 0
    },
    modelOptions() {
      const defaults = this.apiSettings.provider === 'openai'
        ? ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1']
        : ['deepseek-chat', 'deepseek-reasoner']
      const merged = [...new Set([...defaults, ...this.fetchedModels])]
      return merged
    },
    modelIndex() {
      const idx = this.modelOptions.indexOf(this.apiSettings.model)
      return idx >= 0 ? idx : -1
    },
  },
  onShow() {
    const session = requireRole(['student', 'teacher', 'admin'])
    if (!session) return
    this.session = session
    this.loadSettings()
    this.loadHistory()
  },
  methods: {
    loadSettings() {
      try {
        const saved = uni.getStorageSync(SETTINGS_KEY)
        if (saved) {
          this.apiSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
        }
      } catch (_) {
        // use defaults
      }
    },
    saveSettings() {
      try {
        uni.setStorageSync(SETTINGS_KEY, JSON.stringify(this.apiSettings))
        uni.showToast({ title: 'Settings saved.', icon: 'success' })
      } catch (_) {
        uni.showToast({ title: 'Failed to save settings.', icon: 'none' })
      }
    },
    onProviderChange(e) {
      this.apiSettings.provider = this.providers[e.detail.value]
    },
    onKeyInput(e) {
      this.apiSettings.apiKey = e.detail.value
    },
    onModelChange(e) {
      const val = this.modelOptions[e.detail.value]
      if (val) this.apiSettings.model = val
    },
    async fetchModels() {
      if (!this.apiSettings.apiKey) {
        uni.showToast({ title: 'Set API key first.', icon: 'none' })
        return
      }
      this.fetchingModels = true
      try {
        const result = await callAiemsFunction('ask-assistant', {
          session: getSession(),
          query: '__list_models__',
          apiSettings: {
            provider: this.apiSettings.provider,
            apiKey: this.apiSettings.apiKey,
          },
        })
        if (result.ok && result.data && Array.isArray(result.data.models)) {
          this.fetchedModels = result.data.models
          uni.showToast({ title: `Found ${this.fetchedModels.length} models.`, icon: 'success' })
        } else {
          uni.showToast({ title: result.message || 'Failed to fetch models.', icon: 'none' })
        }
      } catch (_) {
        uni.showToast({ title: 'Failed to fetch models.', icon: 'none' })
      }
      this.fetchingModels = false
    },
    onTempChange(e) {
      this.apiSettings.temperature = e.detail.value
    },
    onTokensChange(e) {
      this.apiSettings.maxTokens = e.detail.value
    },

    async loadHistory() {
      const result = await callAiemsFunction('get-ai-history', {
        session: getSession(),
        forceRefresh: true,
      })
      if (!result.ok) return
      const data = result.data || {}
      this.currentConversationId = data.activeConversationId || ''
      this.messages = (data.messages || []).map((item) =>
        this.buildMessage(
          item.role,
          item.content,
          item.citations && item.citations[0] ? item.citations[0].title || '' : '',
          item._id,
        ),
      )
      this.scrollToBottom()
    },
    async ask() {
      const question = this.query.trim()
      if (!question) return

      this.messages.push(this.buildMessage('user', question))
      this.query = ''
      this.loading = true
      this.scrollToBottom()

      const result = await callAiemsFunction('ask-assistant', {
        session: getSession(),
        conversationId: this.currentConversationId,
        query: question,
        history: this.messages.slice(-10),
        apiSettings: {
          provider: this.apiSettings.provider,
          apiKey: this.apiSettings.apiKey,
          model: this.apiSettings.model,
          temperature: this.apiSettings.temperature,
          maxTokens: this.apiSettings.maxTokens,
        },
      })
      this.loading = false

      if (result.ok) {
        const data = result.data || {}
        this.currentConversationId = data.conversationId || this.currentConversationId
        this.messages.push(
          this.buildMessage('assistant', data.answer || '', data.sourceTitle || ''),
        )
        this.scrollToBottom()
        return
      }

      uni.showToast({ title: result.message || 'Query failed.', icon: 'none' })
    },
    newChat() {
      this.currentConversationId = ''
      this.messages = []
      this.scrollAnchor = ''
    },
    buildMessage(role, content, sourceTitle = '', id = '') {
      return {
        id: id || `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role,
        content,
        sourceTitle,
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
  },
}
</script>

<style scoped>
.chat-scroll {
  height: 600rpx;
  margin-bottom: 24rpx;
  user-select: text;
  -webkit-user-select: text;
}

.empty-chat {
  margin-top: 120rpx;
  text-align: center;
}

.empty-icon {
  display: block;
  font-size: 64rpx;
  margin-bottom: 16rpx;
}

.msg-row {
  display: flex;
  margin-bottom: 22rpx;
}

.msg-row.assistant {
  justify-content: flex-start;
}

.msg-row.user {
  justify-content: flex-end;
}

.msg-bubble {
  max-width: 640rpx;
  padding: 22rpx 24rpx;
  border-radius: 12rpx;
  box-sizing: border-box;
}

.msg-row.assistant .msg-bubble {
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-top-left-radius: 4rpx;
}

.msg-row.user .msg-bubble {
  background: #2563eb;
  border-top-right-radius: 4rpx;
}

.msg-row.user .msg-text {
  color: #ffffff;
}

.msg-text {
  display: block;
  color: #1f2937;
  font-size: 28rpx;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  -webkit-user-select: text;
}

.loading-dots {
  color: #94a3b8 !important;
  font-style: italic;
}

.msg-source {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #e2e8f0;
}

.msg-source-label {
  color: #2563eb;
  font-size: 22rpx;
  font-weight: 600;
}

.msg-source-title {
  color: #64748b;
  font-size: 22rpx;
}

.bottom-anchor {
  height: 8rpx;
}

.composer {
  display: flex;
  align-items: flex-end;
  gap: 16rpx;
}

.composer-input {
  flex: 1;
  min-height: 80rpx;
  max-height: 200rpx;
  padding: 18rpx;
  background: #ffffff;
  border: 1rpx solid #cbd5e1;
  border-radius: 8rpx;
  font-size: 28rpx;
  line-height: 1.55;
  box-sizing: border-box;
}

.composer-btn {
  min-width: 120rpx !important;
  margin: 0 !important;
}

.api-key-row {
  display: flex;
  gap: 12rpx;
  align-items: center;
}

.api-key-input {
  flex: 1;
  padding: 18rpx;
  background: #ffffff;
  border: 1rpx solid #cbd5e1;
  border-radius: 8rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.compact-btn {
  min-width: 100rpx !important;
  font-size: 22rpx !important;
}

.api-params {
  display: flex;
  gap: 24rpx;
}

.param-half {
  flex: 1;
}
</style>
