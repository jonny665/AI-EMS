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
          <text class="empty-icon">AI</text>
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
            <view v-if="message.role === 'assistant' && message.blocks && message.blocks.length" class="msg-rendered">
              <block v-for="(block, blockIndex) in message.blocks" :key="blockIndex">
                <text v-if="block.type === 'paragraph'" class="md-paragraph">{{ block.text }}</text>
                <text v-else-if="block.type === 'heading'" class="md-heading">{{ block.text }}</text>
                <view v-else-if="block.type === 'list'" class="md-list">
                  <text v-for="(item, itemIndex) in block.items" :key="itemIndex" class="md-list-item">{{ block.ordered ? itemIndex + 1 + '. ' : '- ' }}{{ item }}</text>
                </view>
                <text v-else-if="block.type === 'quote'" class="md-quote">{{ block.text }}</text>
                <text v-else-if="block.type === 'code'" class="md-code">{{ block.text }}</text>
                <scroll-view v-else-if="block.type === 'table'" scroll-x class="md-table-scroll">
                  <view class="md-table" :style="{ minWidth: Math.max(block.headers.length * 190, 520) + 'rpx' }">
                    <view class="md-table-row md-table-head">
                      <text v-for="(cell, cellIndex) in block.headers" :key="'h-' + cellIndex" class="md-table-cell">{{ cell }}</text>
                    </view>
                    <view v-for="(row, rowIndex) in block.rows" :key="'r-' + rowIndex" class="md-table-row">
                      <text v-for="(cell, cellIndex) in block.headers" :key="'c-' + cellIndex" class="md-table-cell">{{ row[cellIndex] || '' }}</text>
                    </view>
                  </view>
                </scroll-view>
              </block>
            </view>
            <text v-else class="msg-text">{{ message.content }}</text>
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
        <view class="composer-bar">
          <view class="composer-tools">
            <text class="composer-tool">+</text>
            <text class="composer-mode">Default</text>
          </view>
          <button class="primary-btn composer-btn" :loading="loading" @click="ask">↑</button>
        </view>
      </view>
    </view>

    <!-- API Settings Section -->
    <view class="section">
      <view class="section-head">
        <view>
          <text class="section-title">API Settings</text>
          <text class="muted">DeepSeek key and generation controls</text>
        </view>
        <button class="secondary-btn settings-toggle" @click="showSettings = !showSettings">
          {{ showSettings ? 'Hide' : 'Configure' }}
        </button>
      </view>

      <view v-if="showSettings" class="settings-form">
        <view class="settings-row">
          <view class="field setting-provider">
            <text class="label">Provider</text>
            <picker
              :value="providerIndex"
              :range="providers"
              class="picker-shell"
              @change="onProviderChange"
            >
              <view class="input-box">{{ apiSettings.provider || 'Select provider' }}</view>
            </picker>
          </view>

          <view class="field setting-key">
            <text class="label">API Key</text>
            <view class="input-with-btn">
              <input
                :value="apiSettings.apiKey"
                :password="!showKey"
                placeholder="sk-..."
                class="input-box"
                @input="onKeyInput"
              />
              <button class="secondary-btn compact-btn" @click="showKey = !showKey">
                {{ showKey ? 'Hide' : 'Show' }}
              </button>
            </view>
          </view>
        </view>

        <view class="field setting-model">
          <view class="label-row">
            <text class="label">Model</text>
            <button class="secondary-btn compact-btn" :loading="fetchingModels" @click="fetchModels">Refresh</button>
          </view>
          <view class="settings-row">
            <picker
              :value="modelIndex"
              :range="modelOptions"
              class="picker-shell flex-1"
              @change="onModelChange"
            >
              <view class="input-box">{{ modelOptions.includes(apiSettings.model) ? apiSettings.model : 'Custom Model' }}</view>
            </picker>
            <input
              :value="apiSettings.model"
              placeholder="Or type any model name..."
              class="input-box flex-1"
              @input="e => apiSettings.model = e.detail.value"
            />
          </view>
        </view>

        <view class="settings-row param-row">
          <view class="field flex-1">
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
          <view class="field flex-1">
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

        <view class="settings-actions">
          <button class="primary-btn save-settings-btn" @click="saveSettings">Save Settings</button>
        </view>
        <text class="muted notice-text">
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
        renderHtml: role === 'assistant' ? this.renderMarkdown(content) : '',
        blocks: role === 'assistant' ? this.parseMarkdownBlocks(content) : []
      }
    },
    parseMarkdownBlocks(content) {
      const lines = String(content || '').replace(/\r\n/g, '\n').split('\n')
      const blocks = []
      let list = null
      let inCode = false
      let codeLines = []
      const flushList = () => {
        if (!list) return
        blocks.push(list)
        list = null
      }
      const flushCode = () => {
        if (!inCode) return
        blocks.push({ type: 'code', text: codeLines.join('\n') })
        inCode = false
        codeLines = []
      }
      for (let index = 0; index < lines.length; index += 1) {
        const rawLine = lines[index]
        const line = rawLine.trim()
        if (line.startsWith('```')) {
          if (inCode) {
            flushCode()
          } else {
            flushList()
            inCode = true
            codeLines = []
          }
          continue
        }
        if (inCode) {
          codeLines.push(rawLine)
          continue
        }
        if (!line) {
          flushList()
          continue
        }
        if (this.isMarkdownTableStart(lines, index)) {
          flushList()
          const table = this.parseMarkdownTableBlock(lines, index)
          blocks.push(table.block)
          index = table.nextIndex - 1
          continue
        }
        const heading = line.match(/^(#{1,3})\s+(.+)$/)
        if (heading) {
          flushList()
          blocks.push({ type: 'heading', text: this.stripInlineMarkdown(heading[2]) })
          continue
        }
        const unordered = line.match(/^[-*]\s+(.+)$/)
        const ordered = line.match(/^\d+\.\s+(.+)$/)
        if (unordered || ordered) {
          const orderedList = Boolean(ordered)
          if (!list || list.ordered !== orderedList) {
            flushList()
            list = { type: 'list', ordered: orderedList, items: [] }
          }
          list.items.push(this.stripInlineMarkdown((unordered || ordered)[1]))
          continue
        }
        if (line.startsWith('>')) {
          flushList()
          blocks.push({ type: 'quote', text: this.stripInlineMarkdown(line.replace(/^>\s*/, '')) })
          continue
        }
        flushList()
        blocks.push({ type: 'paragraph', text: this.stripInlineMarkdown(line) })
      }
      flushList()
      flushCode()
      return blocks
    },
    parseMarkdownTableBlock(lines, startIndex) {
      const rows = []
      let index = startIndex
      while (index < lines.length && String(lines[index] || '').trim().includes('|')) {
        rows.push(String(lines[index] || '').trim())
        index += 1
      }
      const headers = this.parseTableRow(rows[0]).map(this.stripInlineMarkdown)
      const bodyRows = rows
        .slice(2)
        .map(row => this.parseTableRow(row).map(this.stripInlineMarkdown))
        .filter(row => row.length)
      return {
        block: { type: 'table', headers, rows: bodyRows },
        nextIndex: index
      }
    },
    stripInlineMarkdown(value) {
      return String(value || '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1')
    },
    renderMarkdown(content) {
      const lines = String(content || '').replace(/\r\n/g, '\n').split('\n')
      const html = []
      let listType = ''
      let listItems = []
      let inCode = false
      let codeLines = []
      const flushList = () => {
        if (!listType) return
        html.push(`<${listType} style="margin:8px 0 8px 22px;padding:0;">${listItems.join('')}</${listType}>`)
        listType = ''
        listItems = []
      }
      const flushCode = () => {
        if (!inCode) return
        html.push(`<pre style="margin:10px 0;padding:10px 12px;background:#0f172a;color:#e2e8f0;border-radius:6px;white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.55;">${this.escapeHtml(codeLines.join('\n'))}</pre>`)
        inCode = false
        codeLines = []
      }
      for (let index = 0; index < lines.length; index += 1) {
        const rawLine = lines[index]
        const line = rawLine.trim()
        if (line.startsWith('```')) {
          if (inCode) {
            flushCode()
          } else {
            flushList()
            inCode = true
            codeLines = []
          }
          return
        }
        if (inCode) {
          codeLines.push(rawLine)
          continue
        }
        if (!line) {
          flushList()
          html.push('<div style="height:6px;"></div>')
          continue
        }
        if (this.isMarkdownTableStart(lines, index)) {
          flushList()
          const parsed = this.renderMarkdownTable(lines, index)
          html.push(parsed.html)
          index = parsed.nextIndex - 1
          continue
        }
        const heading = line.match(/^(#{1,3})\s+(.+)$/)
        if (heading) {
          flushList()
          const size = heading[1].length === 1 ? 18 : heading[1].length === 2 ? 16 : 15
          html.push(`<h${heading[1].length} style="margin:12px 0 6px;color:#0f172a;font-size:${size}px;font-weight:700;">${this.inlineMarkdown(heading[2])}</h${heading[1].length}>`)
          continue
        }
        const unordered = line.match(/^[-*]\s+(.+)$/)
        const ordered = line.match(/^\d+\.\s+(.+)$/)
        if (unordered || ordered) {
          const nextType = unordered ? 'ul' : 'ol'
          if (listType && listType !== nextType) flushList()
          listType = nextType
          listItems.push(`<li style="margin:4px 0;line-height:1.65;">${this.inlineMarkdown((unordered || ordered)[1])}</li>`)
          continue
        }
        if (line.startsWith('>')) {
          flushList()
          html.push(`<blockquote style="margin:8px 0;padding:8px 12px;border-left:3px solid #2563eb;background:#eff6ff;color:#334155;">${this.inlineMarkdown(line.replace(/^>\s*/, ''))}</blockquote>`)
          continue
        }
        flushList()
        html.push(`<p style="margin:6px 0;line-height:1.7;color:#1f2937;">${this.inlineMarkdown(line)}</p>`)
      }
      flushList()
      flushCode()
      return html.join('')
    },
    isMarkdownTableStart(lines, index) {
      const current = String(lines[index] || '').trim()
      const next = String(lines[index + 1] || '').trim()
      return current.includes('|') && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(next)
    },
    renderMarkdownTable(lines, startIndex) {
      const rows = []
      let index = startIndex
      while (index < lines.length && String(lines[index] || '').trim().includes('|')) {
        rows.push(String(lines[index] || '').trim())
        index += 1
      }
      const header = this.parseTableRow(rows[0])
      const body = rows.slice(2).map(row => this.parseTableRow(row)).filter(row => row.length)
      const headHtml = header
        .map(cell => `<th style="padding:9px 10px;border:1px solid #cbd5e1;background:#eff6ff;color:#0f172a;text-align:left;font-weight:700;white-space:nowrap;">${this.inlineMarkdown(cell)}</th>`)
        .join('')
      const bodyHtml = body
        .map(row => `<tr>${header.map((_, cellIndex) => `<td style="padding:9px 10px;border:1px solid #cbd5e1;color:#1f2937;vertical-align:top;">${this.inlineMarkdown(row[cellIndex] || '')}</td>`).join('')}</tr>`)
        .join('')
      return {
        html: `<div style="overflow-x:auto;margin:12px 0;"><table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.55;">${headHtml ? `<thead><tr>${headHtml}</tr></thead>` : ''}<tbody>${bodyHtml}</tbody></table></div>`,
        nextIndex: index
      }
    },
    parseTableRow(row) {
      return String(row || '')
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(cell => cell.trim())
    },
    inlineMarkdown(value) {
      return this.escapeHtml(value)
        .replace(/`([^`]+)`/g, '<code style="padding:1px 5px;background:#e2e8f0;border-radius:4px;color:#0f172a;font-size:13px;">$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight:700;color:#0f172a;">$1</strong>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" style="color:#2563eb;">$1</a>')
    },
    escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  margin-bottom: 16rpx;
  border-radius: 50%;
  background: #eff6ff;
  color: #2563eb;
  font-size: 30rpx;
  font-weight: 700;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
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
  max-width: min(760rpx, 86%);
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

.msg-rich {
  display: block;
  color: #1f2937;
  font-size: 28rpx;
  line-height: 1.65;
  user-select: text;
  -webkit-user-select: text;
}

.msg-rendered {
  display: block;
  color: #1f2937;
  font-size: 28rpx;
  line-height: 1.65;
}

.md-paragraph,
.md-heading,
.md-list-item,
.md-quote,
.md-code {
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
}

.md-paragraph {
  margin: 8rpx 0;
}

.md-heading {
  margin: 16rpx 0 8rpx;
  color: #0f172a;
  font-size: 32rpx;
  font-weight: 700;
}

.md-list {
  margin: 8rpx 0 8rpx 18rpx;
}

.md-list-item {
  margin: 4rpx 0;
}

.md-quote {
  margin: 12rpx 0;
  padding: 12rpx 16rpx;
  background: #eff6ff;
  border-left: 6rpx solid #2563eb;
  color: #334155;
}

.md-code {
  margin: 12rpx 0;
  padding: 16rpx;
  background: #0f172a;
  border-radius: 8rpx;
  color: #e2e8f0;
  font-family: Consolas, "SFMono-Regular", monospace;
  font-size: 24rpx;
}

.md-table-scroll {
  width: 100%;
  margin: 16rpx 0;
}

.md-table {
  border-top: 1rpx solid #cbd5e1;
  border-left: 1rpx solid #cbd5e1;
}

.md-table-row {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(190rpx, 1fr);
}

.md-table-head {
  background: #eff6ff;
}

.md-table-cell {
  padding: 14rpx 16rpx;
  border-right: 1rpx solid #cbd5e1;
  border-bottom: 1rpx solid #cbd5e1;
  color: #1f2937;
  font-size: 26rpx;
  line-height: 1.45;
  word-break: break-word;
}

.md-table-head .md-table-cell {
  color: #0f172a;
  font-weight: 700;
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
  flex-direction: column;
  gap: 10rpx;
  padding: 14rpx 16rpx;
  background: #ffffff;
  border: 1rpx solid #cbd5e1;
  border-radius: 12rpx;
  box-sizing: border-box;
}

.composer-input {
  width: 100%;
  min-height: 78rpx;
  max-height: 220rpx;
  padding: 0;
  margin: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  font-size: 28rpx;
  line-height: 42rpx;
  box-sizing: border-box;
  overflow-y: auto;
}

.composer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.composer-tools {
  display: flex;
  align-items: center;
  gap: 18rpx;
  color: #64748b;
  font-size: 24rpx;
}

.composer-tool {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38rpx;
  height: 38rpx;
  border: 1rpx solid #cbd5e1;
  border-radius: 50%;
  color: #64748b;
  font-size: 30rpx;
  line-height: 1;
}

.composer-mode {
  line-height: 1;
}

.composer-btn {
  display: flex !important;
  align-items: center;
  justify-content: center;
  width: 56rpx !important;
  min-width: 56rpx !important;
  height: 56rpx !important;
  margin: 0 !important;
  padding: 0 !important;
  flex-shrink: 0;
  border-radius: 50% !important;
  font-size: 34rpx !important;
  line-height: 1 !important;
  box-sizing: border-box;
}

.settings-toggle {
  width: auto !important;
  min-width: 140rpx !important;
  padding: 0 24rpx !important;
  flex-shrink: 0;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 18rpx;
  padding: 24rpx;
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
}

.settings-row {
  display: flex;
  gap: 24rpx;
  align-items: flex-start;
}

.settings-row > .field {
  margin-bottom: 0;
}

.setting-provider {
  flex: 0 0 300rpx;
}

.setting-key {
  flex: 1;
}

.flex-1 {
  flex: 1;
  min-width: 0;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.label-row .label {
  margin-bottom: 0;
}

.picker-shell {
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
}

.input-box {
  flex: 1;
  height: 68rpx;
  line-height: 68rpx;
  padding: 0 16rpx;
  background: #ffffff;
  border: 1rpx solid #cbd5e1;
  border-radius: 8rpx;
  color: #0f172a;
  font-size: 28rpx;
  box-sizing: border-box;
}

.input-with-btn {
  display: flex;
  gap: 12rpx;
  align-items: center;
}

.input-with-btn .input-box {
  min-width: 0;
}

.compact-btn {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: auto !important;
  min-width: 104rpx !important;
  height: 68rpx !important;
  padding: 0 20rpx !important;
  font-size: 24rpx !important;
  line-height: 1 !important;
  margin: 0 !important;
  flex-shrink: 0;
}

.param-row {
  margin-top: 4rpx;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12rpx;
}

.save-settings-btn {
  width: auto !important;
  min-width: 220rpx !important;
  height: 72rpx !important;
  line-height: 72rpx !important;
  margin: 0 !important;
}

.notice-text {
  display: block;
  margin-top: 16rpx;
  color: #64748b;
  text-align: center;
  font-size: 24rpx;
}

.save-settings-btn {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 220rpx !important;
  min-width: 220rpx !important;
  height: 64rpx !important;
  padding: 0 28rpx !important;
  line-height: 1 !important;
}

@media (max-width: 700px) {
  .composer {
    align-items: stretch;
  }

  .api-key-row,
  .api-params,
  .settings-form {
    display: block;
  }

  .settings-form .field {
    margin-bottom: 18rpx;
  }

  .compact-btn {
    margin-top: 12rpx !important;
  }
}
</style>
