<template>
  <view class="page">
    <view class="section">
      <view class="row">
        <view>
          <text class="section-title">Leave Workflow</text>
          <text class="muted"
            >{{ session.displayName }} · {{ session.role }}</text
          >
        </view>
        <button class="secondary-btn" @click="backHome">Home</button>
      </view>
    </view>

    <view v-if="session.role === 'student'" class="section">
      <text class="section-title">Submit Leave Request</text>
      <view class="field">
        <text class="label">Course</text>
        <picker
          :range="courseLabels"
          :value="courseIndex"
          @change="changeCourse"
        >
          <view class="picker-value">{{ selectedCourseLabel }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">Leave Type</text>
        <picker
          :range="reasonTypeLabels"
          :value="reasonTypeIndex"
          @change="changeReasonType"
        >
          <view class="picker-value">{{
            reasonTypeLabels[reasonTypeIndex]
          }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">Date</text>
        <picker mode="date" :value="date" @change="changeDate">
          <view class="picker-value">{{ date }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">Reason Detail</text>
        <textarea
          v-model="reasonDetail"
          placeholder="Explain the leave reason briefly."
        />
      </view>
      <button class="primary-btn full-btn" @click="submitLeave">Submit</button>
    </view>

    <view v-if="session.role !== 'student'" class="section">
      <text class="section-title">Review Comment</text>
      <textarea
        v-model="reviewComment"
        placeholder="Optional note for the student."
      />
    </view>

    <view class="section">
      <text class="section-title">{{
        session.role === "student" ? "My Leave Requests" : "Pending Review"
      }}</text>
      <view v-if="!leaveRequests.length" class="muted"
        >No leave requests available.</view
      >
      <view v-for="item in leaveRequests" :key="item._id" class="card">
        <text class="value"
          >{{ item.studentName || session.displayName }} ·
          {{ item.courseName || item.course_name }}</text
        >
        <text class="muted"
          >{{ item.date || item.leaveDate }} ·
          {{ item.reasonType || item.reason_type || "other" }} ·
          {{ item.status }}</text
        >
        <text class="muted">{{
          item.reasonDetail || item.reason_detail || item.reason
        }}</text>
        <text v-if="item.reviewComment || item.review_comment" class="muted"
          >Review: {{ item.reviewComment || item.review_comment }}</text
        >
        <view
          v-if="session.role !== 'student' && item.status === 'pending'"
          class="btn-row"
        >
          <button class="primary-btn" @click="review(item, 'approved')">
            Approve
          </button>
          <button class="danger-btn" @click="review(item, 'rejected')">
            Reject
          </button>
        </view>
        <view
          v-if="
            session.role === 'student' &&
            ['pending', 'approved'].includes(item.status)
          "
          class="btn-row"
        >
          <button class="secondary-btn" @click="cancelLeave(item)">
            Cancel
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { callAiemsFunction } from "../../common/api.js";
import { dashboardUrl, getSession, requireRole } from "../../common/session.js";

export default {
  data() {
    return {
      session: {},
      courses: [],
      leaveRequests: [],
      courseIndex: 0,
      reasonTypeIndex: 0,
      date: new Date().toISOString().slice(0, 10),
      reasonDetail: "",
      reviewComment: "",
      reasonTypes: [
        { value: "sick", label: "Sick Leave" },
        { value: "personal", label: "Personal Leave" },
        { value: "official", label: "Official Duty" },
        { value: "other", label: "Other" },
      ],
    };
  },
  computed: {
    courseLabels() {
      return this.courses.map((item) => this.formatCourseLabel(item))
    },
    selectedCourseLabel() {
      if (!this.courseLabels.length) {
        return 'No courses available'
      }
      return this.courseLabels[this.courseIndex] || this.courseLabels[0]
    },
    reasonTypeLabels() {
      return this.reasonTypes.map((item) => item.label);
    },
  },
  onShow() {
    const session = requireRole(["student", "teacher", "admin"]);
    if (!session) return;
    this.session = session;
    this.load();
  },
  methods: {
    async load() {
      const result = await callAiemsFunction("get-dashboard-data", {
        session: getSession(),
      });
      if (!result.ok) {
        uni.showToast({
          title: result.message || 'Failed to load leave data.',
          icon: 'none',
        })
        return;
      }
      this.courses = (result.data.courses || []).map((item) => this.normalizeCourse(item));
      this.leaveRequests = (result.data.leaveRequests || []).map((item) => this.normalizeLeave(item));
      if (this.courseIndex >= this.courses.length) {
        this.courseIndex = 0;
      }
    },
    async submitLeave() {
      const course = this.courses[this.courseIndex];
      const reasonDetail = this.reasonDetail.trim();
      if (!course || !reasonDetail) {
        uni.showToast({
          title: "Course and reason are required.",
          icon: "none",
        });
        return;
          courseId: course._id,
          courseOfferingId: course._id,
          courseName: this.formatCourseLabel(course),
        session: getSession(),
        courseId: course._id,
        courseOfferingId: course._id,
        courseName:
          `${course.code || course.course_code} ${course.name}`.trim(),
        date: this.date,
        leaveDate: this.date,
        reasonType: reasonType.value,
        reasonDetail,
        reason: reasonDetail,
          return;
      });

        uni.showToast({
          title: result.message || 'Submit failed.',
          icon: 'none',
        })
      if (result.ok) {
        this.reasonDetail = "";
        uni.showToast({ title: "Submitted", icon: "success" });
        this.load();
      }
    },
    changeReasonType(event) {
      changeDate(event) {
        this.date = event.detail.value;
      },
      this.reasonTypeIndex = Number(event.detail.value);
    },
    changeCourse(event) {
      this.courseIndex = Number(event.detail.value);
    },
    async review(item, decision) {
      const result = await callAiemsFunction("review-leave", {
        session: getSession(),
        leaveId: item._id,
        decision,
        reviewComment: this.reviewComment.trim(),
      });
      if (result.ok) {
          return;
        uni.showToast({

        uni.showToast({
          title: result.message || 'Review failed.',
          icon: 'none',
        })
          title: decision === "approved" ? "Approved" : "Rejected",
          icon: "success",
        });
        this.load();
      }
    },
    async cancelLeave(item) {
      const result = await callAiemsFunction("cancel-leave", {
        session: getSession(),
        leaveId: item._id,
      });
      if (result.ok) {
        uni.showToast({ title: "Cancelled", icon: "success" });
        this.load();
        return;
      }

      uni.showToast({
        title: result.message || 'Cancel failed.',
        icon: 'none',
      })
    },
    backHome() {
      uni.reLaunch({ url: dashboardUrl(this.session.role) });
    },
    formatCourseLabel(course) {
      if (!course) {
        return 'Unnamed course';
      }
      const code = course.code || course.course_code || course.courseCode || '';
      const name = course.name || course.course_name || course.title || '';
      return [code, name].filter(Boolean).join(' ').trim() || name || code || 'Unnamed course';
    },
    normalizeCourse(course) {
      if (!course) {
        return course;
      }
      const code = course.code || course.course_code || course.courseCode || '';
      const name = course.name || course.course_name || course.title || '';
      return {
        ...course,
        code,
        course_code: course.course_code || code,
        name,
        course_name: course.course_name || name,
      };
    },
    normalizeLeave(item) {
      if (!item) {
        return item;
      }
      return {
        ...item,
        studentId: item.studentId || item.student_id,
        student_id: item.student_id || item.studentId,
        studentName: item.studentName || item.student_name,
        student_name: item.student_name || item.studentName,
        courseName: item.courseName || item.course_name,
        course_name: item.course_name || item.courseName,
        leaveDate: item.leaveDate || item.leave_date,
        leave_date: item.leave_date || item.leaveDate,
        reasonType: item.reasonType || item.reason_type,
        reason_type: item.reason_type || item.reasonType,
        reasonDetail: item.reasonDetail || item.reason_detail,
        reason_detail: item.reason_detail || item.reasonDetail,
        reason: item.reason || item.reason_detail || item.reasonDetail,
        reviewComment: item.reviewComment || item.review_comment,
        review_comment: item.review_comment || item.reviewComment,
      };
    },
  },
};
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
</style>
