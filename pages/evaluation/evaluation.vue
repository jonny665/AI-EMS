<template>
  <view class="evaluation-page">
    <!-- Student View: Submit Evaluation Form -->
    <view v-if="userRole === 'student'" class="submit-section">
      <view class="page-title">Course Evaluation</view>
      
      <view class="form-item">
        <text class="label">Select Course</text>
        <picker mode="selector" :range="courseList" range-key="name" @change="onCourseChange">
          <view class="picker">{{ selectedCourse ? selectedCourse.name : 'Please select a course' }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="label">Course Rating</text>
        <view class="rating-group">
          <text 
            v-for="star in 5" 
            :key="star" 
            class="star" 
            :class="{ active: rating >= star }"
            @click="rating = star"
          >★</text>
        </view>
      </view>

      <view class="form-item">
        <text class="label">Evaluation Content (max 500 characters)</text>
        <textarea 
          v-model="content" 
          class="textarea" 
          placeholder="Write your honest feedback for this course. All submissions are fully anonymous."
          maxlength="500"
        />
        <text class="word-count">{{ content.length }}/500</text>
      </view>

      <button class="submit-btn" @click="submitEvaluation">Submit Evaluation</button>
    </view>

    <!-- Teacher/Admin View: Aggregated Results -->
    <view v-else class="summary-section">
      <view class="page-title">Course Evaluation Summary</view>

      <!-- Summary Cards -->
      <view class="summary-card" v-for="item in evaluationSummary" :key="item.course_id">
        <view class="course-name">{{ item.course_name }}</view>
        <view class="stats-row">
          <view class="stat-item">
            <text class="stat-value">{{ item.average_rating }}</text>
            <text class="stat-label">Average Rating</text>
          </view>
          <view class="stat-item">
            <text class="stat-value">{{ item.total_evaluations }}</text>
            <text class="stat-label">Total Evaluations</text>
          </view>
        </view>
      </view>

      <!-- Anonymous Evaluation List -->
      <view class="list-title">Anonymous Evaluation Details</view>
      <view class="evaluation-item" v-for="(evalItem, index) in evaluationList" :key="index">
        <view class="eval-header">
          <text class="eval-rating">Rating: {{ evalItem.rating }}/5</text>
          <text class="eval-time">{{ formatTime(evalItem.create_time) }}</text>
        </view>
        <text class="eval-content">{{ evalItem.content }}</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      userRole: '',
      courseList: [],
      selectedCourse: null,
      rating: 0,
      content: '',
      evaluationSummary: [],
      evaluationList: []
    };
  },
  onLoad() {
    this.loadStudentCourses();
    this.userRole = uni.getStorageSync('role') || 'student';
    if (this.userRole !== 'student') {
      this.loadEvaluationSummary();
    }
  },
  methods: {
    async loadStudentCourses() {
      this.courseList = [
        { id: 'CS001', name: 'Introduction to Software Engineering' },
        { id: 'CS002', name: 'Database Principles' }
      ];
    },
    onCourseChange(e) {
      const selectIndex = e.detail.value;
      if (selectIndex >= 0 && this.courseList[selectIndex]) {
        this.selectedCourse = this.courseList[selectIndex];
      }
    },
    async submitEvaluation() {
      if (!this.selectedCourse) {
        uni.showToast({ title: 'Please select a course', icon: 'none' });
        return;
      }
      if (this.rating <= 0) {
        uni.showToast({ title: 'Please rate the course', icon: 'none' });
        return;
      }
      if (!this.content.trim()) {
        uni.showToast({ title: 'Please write evaluation content', icon: 'none' });
        return;
      }

      uni.showLoading({ title: 'Submitting...' });
      try {
        const res = await uniCloud.callFunction({
          // 已改成和你文件夹一致的下划线名字
          name: 'submit-evaluation',
          data: {
            course_id: this.selectedCourse.id,
            course_name: this.selectedCourse.name,
            rating: this.rating,
            content: this.content
          }
        });
        uni.hideLoading();
        if (res.result.code === 200) {
          uni.showToast({ title: 'Submitted Successfully', icon: 'success' });
          this.selectedCourse = null;
          this.rating = 0;
          this.content = '';
        } else {
          uni.showToast({ title: res.result.message, icon: 'none' });
        }
      } catch (err) {
        uni.hideLoading();
        uni.showToast({ title: 'Submission failed, please retry', icon: 'none' });
      }
    },
    async loadEvaluationSummary() {
      uni.showLoading({ title: 'Loading...' });
      try {
        const res = await uniCloud.callFunction({
          // 已改成和你文件夹一致的下划线名字
          name: 'get-evaluation-summary',
        });
        uni.hideLoading();
        if (res.result.code === 200) {
          this.evaluationSummary = res.result.data.summary;
          this.evaluationList = res.result.data.anonymous_evaluations;
        }
      } catch (err) {
        uni.hideLoading();
        uni.showToast({ title: 'Load failed, please retry', icon: 'none' });
      }
    },
    formatTime(timestamp) {
      const date = new Date(timestamp);
      return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    }
  }
};
</script>

<style scoped>
.evaluation-page {
  padding: 20rpx;
  background: #f5f7fa;
  min-height: 100vh;
}
.page-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 30rpx;
}
.form-item {
  background: #fff;
  padding: 24rpx;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
}
.label {
  display: block;
  font-size: 28rpx;
  color: #666;
  margin-bottom: 16rpx;
}
.picker {
  font-size: 30rpx;
  color: #333;
  padding: 10rpx 0;
}
.rating-group {
  display: flex;
  gap: 20rpx;
}
.star {
  font-size: 48rpx;
  color: #ddd;
}
.star.active {
  color: #ffc107;
}
.textarea {
  width: 100%;
  min-height: 200rpx;
  font-size: 28rpx;
  line-height: 1.6;
}
.word-count {
  display: block;
  text-align: right;
  font-size: 24rpx;
  color: #999;
  margin-top: 10rpx;
}
.submit-btn {
  width: 100%;
  height: 88rpx;
  background: #409eff;
  color: #fff;
  border-radius: 44rpx;
  margin-top: 40rpx;
}
.summary-card {
  background: #fff;
  padding: 24rpx;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
}
.course-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}
.stats-row {
  display: flex;
  justify-content: space-around;
}
.stat-item {
  text-align: center;
}
.stat-value {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #409eff;
}
.stat-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
}
.list-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin: 30rpx 0 20rpx;
}
.evaluation-item {
  background: #fff;
  padding: 24rpx;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
}
.eval-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.eval-rating {
  font-size: 28rpx;
  color: #ffc107;
}
.eval-time {
  font-size: 24rpx;
  color: #999;
}
.eval-content {
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
}
</style>