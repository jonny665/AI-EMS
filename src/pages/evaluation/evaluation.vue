<template>
  <view class="page">
    <view class="section">
      <view class="row">
        <view>
          <text class="section-title">Course Evaluation</text>
          <text class="muted">{{ session.displayName }} · {{ session.role }}</text>
        </view>
        <button class="secondary-btn" @click="backHome">Home</button>
      </view>
    </view>

    <view v-if="session.role === 'student'" class="section">
      <text class="section-title">Submit Anonymous Feedback</text>
      <view class="field">
        <text class="label">Course</text>
        <picker :range="courseNames" :value="courseIndex" @change="changeCourse">
          <view class="picker-value">{{ courseNames[courseIndex] }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">Rating (1-5)</text>
        <input v-model="rating" type="number" />
      </view>
      <view class="field">
        <text class="label">Feedback</text>
        <textarea v-model="feedback" placeholder="Your feedback is stored with an anonymous token." />
      </view>
      <button class="primary-btn full-btn" @click="submitEvaluation">Submit</button>
    </view>

    <view class="section">
      <text class="section-title">Aggregated Evaluation Summary</text>
      <view v-for="item in summaries" :key="item.courseId" class="card">
        <text class="value">{{ item.courseName }}</text>
        <text class="muted">Average {{ item.average }} / 5 · {{ item.count }} response(s)</text>
        <view v-for="(comment, index) in item.feedback" :key="index" class="comment">
          <text class="muted">Anonymous feedback: {{ comment }}</text>
        </view>
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
      courses: [],
      summaries: [],
      courseIndex: 0,
      rating: 5,
      feedback: ''
    }
  },
  computed: {
    courseNames() {
      return this.courses.map(item => `${item.code} ${item.name}`)
    }
  },
  onShow() {
    const session = requireRole(['student', 'teacher', 'admin'])
    if (!session) return
    this.session = session
    this.load()
  },
  methods: {
    async load() {
      const dashboard = await callAiemsFunction('get-dashboard-data', { session: getSession() })
      if (dashboard.ok) this.courses = dashboard.data.courses || []
      const result = await callAiemsFunction('get-evaluation-summary', { session: getSession() })
      if (result.ok) this.summaries = result.data || []
    },
    async submitEvaluation() {
      const course = this.courses[this.courseIndex]
      const rating = Number(this.rating)
      if (!course || rating < 1 || rating > 5 || !this.feedback.trim()) {
        uni.showToast({ title: 'Valid course, rating and feedback are required.', icon: 'none' })
        return
      }
      const result = await callAiemsFunction('submit-evaluation', {
        session: getSession(),
        courseId: course._id,
        rating,
        feedback: this.feedback.trim()
      })
      if (result.ok) {
        this.feedback = ''
        uni.showToast({ title: 'Submitted anonymously', icon: 'success' })
        this.load()
      }
    },
    changeCourse(event) {
      this.courseIndex = Number(event.detail.value)
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

.full-btn {
  width: 100%;
}

.comment {
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #e2e8f0;
}
</style>
