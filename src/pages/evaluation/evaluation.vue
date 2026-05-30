<template>
  <view class="page">
    <view class="section">
      <view class="row">
        <view>
          <text class="section-title">Course Evaluation</text>
          <text class="muted">{{ session.displayName }} - {{ session.role }}</text>
        </view>
        <view class="btn-row top-actions">
          <button class="secondary-btn" :loading="loading" @click="refresh">Refresh</button>
          <button class="secondary-btn" @click="backHome">Home</button>
        </view>
      </view>
    </view>

    <view v-if="session.role === 'student'" class="section">
      <text class="section-title">Submit Anonymous Feedback</text>
      <template v-if="courses.length">
        <view class="field">
          <text class="label">Course</text>
          <picker :range="courseNames" :value="courseIndex" @change="changeCourse">
            <view class="picker-value">{{ selectedCourseName }}</view>
          </picker>
        </view>
        <view class="score-grid">
          <view v-for="field in scoreFields" :key="field.key" class="field">
            <text class="label">{{ field.label }}</text>
            <input v-model="scores[field.key]" type="number" />
          </view>
        </view>
        <view class="field">
          <text class="label">Feedback</text>
          <textarea v-model="feedback" maxlength="500" placeholder="Your feedback will be stored anonymously." />
        </view>
        <button class="primary-btn full-btn" :loading="submitting" @click="submitEvaluation">Submit</button>
      </template>
      <view v-else class="empty-note">
        <text class="muted">No completed courses available for evaluation.</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">Aggregated Evaluation Summary</text>
      <template v-if="!summaries.length">
        <text class="muted">No evaluation records available.</text>
      </template>
      <view v-for="item in summaries" :key="item.courseOfferingId || item.courseId" class="card">
        <view class="summary-head">
          <view>
            <text class="value">{{ item.courseName }}</text>
            <text class="muted">Average {{ item.average }} / 5 - {{ item.count }} response(s)</text>
          </view>
          <StatusBadge :status="item.average < 3 ? 'high' : 'present'" />
        </view>
        <view v-if="item.averageScores" class="dimension-grid">
          <view v-for="field in scoreFields" :key="field.key" class="dimension-cell">
            <text class="label">{{ field.label }}</text>
            <text class="value">{{ formatScore(item.averageScores[field.key]) }}</text>
          </view>
        </view>
        <view v-for="(comment, index) in item.feedback" :key="index" class="comment">
          <text class="muted">Anonymous feedback: {{ comment }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import StatusBadge from '../../components/StatusBadge.vue'
import { callAiemsFunction } from '../../common/api.js'
import { dashboardUrl, getSession, requireRole } from '../../common/session.js'

export default {
  components: { StatusBadge },
  data() {
    return {
      session: {},
      courses: [],
      summaries: [],
      courseIndex: 0,
      loading: false,
      submitting: false,
      feedback: '',
      scores: {
        content: 5,
        teaching_method: 5,
        difficulty: 3,
        workload: 3,
        achievement: 5,
        overall: 5
      },
      scoreFields: [
        { key: 'content', label: 'Content' },
        { key: 'teaching_method', label: 'Teaching' },
        { key: 'difficulty', label: 'Difficulty' },
        { key: 'workload', label: 'Workload' },
        { key: 'achievement', label: 'Achievement' },
        { key: 'overall', label: 'Overall' }
      ],
      lastLoadedAt: 0,
      loadTtlMs: 30000
    }
  },
  computed: {
    courseNames() {
      return this.courses.map(item => this.formatCourseLabel(item))
    },
    selectedCourseName() {
      return this.courseNames[this.courseIndex] || 'No courses available'
    }
  },
  onShow() {
    const session = requireRole(['student', 'teacher', 'admin'])
    if (!session) return
    this.session = session
    const now = Date.now()
    if (!this.lastLoadedAt || now - this.lastLoadedAt > this.loadTtlMs) {
      this.load()
    }
  },
  methods: {
    defaultScores() {
      return {
        content: 5,
        teaching_method: 5,
        difficulty: 3,
        workload: 3,
        achievement: 5,
        overall: 5
      }
    },
    async load(forceRefresh = false) {
      this.loading = true
      const dashboard = await callAiemsFunction('get-dashboard-data', {
        session: getSession(),
        forceRefresh
      })
      if (dashboard.ok) {
        this.courses = this.filterEvaluableCourses(dashboard.data.courses || [])
      }

      const result = await callAiemsFunction('get-evaluation-summary', {
        session: getSession(),
        forceRefresh
      })
      this.loading = false
      if (result.ok) {
        this.summaries = result.summary || result.data || []
      }
      this.lastLoadedAt = Date.now()
      if (this.courseIndex >= this.courses.length) this.courseIndex = 0
    },
    refresh() {
      this.load(true)
    },
    async submitEvaluation() {
      const course = this.courses[this.courseIndex]
      const scores = this.normalizedScores()
      if (!course || !scores || !this.feedback.trim()) {
        uni.showToast({ title: 'Valid course, scores and feedback are required.', icon: 'none' })
        return
      }
      if (!this.canEvaluateCourse(course)) {
        uni.showToast({ title: 'Course evaluations open only after the course has ended.', icon: 'none' })
        return
      }

      this.submitting = true
      const result = await callAiemsFunction('submit-evaluation', {
        session: getSession(),
        courseOfferingId: course.courseOfferingId || course._id,
        rating: scores.overall,
        scores,
        feedback: this.feedback.trim()
      })
      this.submitting = false

      if (result.ok) {
        this.feedback = ''
        this.scores = this.defaultScores()
        uni.showToast({ title: 'Submitted anonymously', icon: 'success' })
        this.load(true)
        return
      }

      uni.showToast({ title: result.message || 'Submit failed.', icon: 'none' })
    },
    normalizedScores() {
      const next = {}
      for (const field of this.scoreFields) {
        const value = Number(this.scores[field.key])
        if (!Number.isFinite(value) || value < 1 || value > 5) {
          return null
        }
        next[field.key] = value
      }
      return next
    },
    changeCourse(event) {
      this.courseIndex = Number(event.detail.value)
    },
    filterEvaluableCourses(courses) {
      if (this.session.role !== 'student') return courses
      return courses.filter(course => this.canEvaluateCourse(course))
    },
    canEvaluateCourse(course) {
      return Boolean(course && (course.completed === true || course.enrollmentStatus === 'completed'))
    },
    formatCourseLabel(course) {
      return [course.code, course.name].filter(Boolean).join(' ').trim()
    },
    formatScore(value) {
      const numberValue = Number(value || 0)
      return numberValue ? numberValue.toFixed(1) : '0.0'
    },
    backHome() {
      uni.reLaunch({ url: dashboardUrl(this.session.role) })
    }
  }
}
</script>

<style scoped>
.field {
  margin-bottom: 18rpx;
}

.picker-value {
  padding: 18rpx;
  background: #ffffff;
  border: 1rpx solid #cbd5e1;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.score-grid,
.dimension-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.dimension-grid {
  margin-top: 16rpx;
}

.dimension-cell {
  padding: 14rpx;
  background: #ffffff;
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
}

.summary-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.full-btn {
  width: 100%;
}

.empty-note {
  padding-top: 12rpx;
}

.comment {
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #e2e8f0;
}

.top-actions {
  margin-top: 0;
}
</style>
