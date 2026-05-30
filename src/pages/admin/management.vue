<template>
  <view class="page">
    <PageHeader title="Admin Management" :displayName="session.displayName" :username="session.username">
      <button class="secondary-btn refresh-btn" :loading="loading" @click="refresh">Refresh</button>
    </PageHeader>

    <NavTabs :role="session.role" current="management" />

    <view class="section">
      <view class="section-head">
        <view>
          <text class="section-title">Create Account</text>
          <text class="muted">Account and role profile are saved together.</text>
        </view>
      </view>

      <view class="form-grid">
        <view class="field">
          <text class="label">Username</text>
          <input v-model="accountForm.username" placeholder="s2024001" />
        </view>
        <view class="field">
          <text class="label">Initial Password</text>
          <input v-model="accountForm.password" password placeholder="Set initial password" />
        </view>
        <view class="field">
          <text class="label">Role</text>
          <picker :range="accountRoleLabels" :value="accountRoleIndex" @change="changeAccountRole">
            <view class="picker-value">{{ accountRoleLabels[accountRoleIndex] }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="label">Name</text>
          <input v-model="accountForm.displayName" placeholder="Display name" />
        </view>
        <view v-if="accountForm.roleCode === 'student'" class="field">
          <text class="label">Student No.</text>
          <input v-model="accountForm.studentNo" placeholder="S2024001" />
        </view>
        <view v-if="accountForm.roleCode === 'teacher'" class="field">
          <text class="label">Teacher No.</text>
          <input v-model="accountForm.teacherNo" placeholder="T1003" />
        </view>
        <view class="field">
          <text class="label">Email</text>
          <input v-model="accountForm.email" placeholder="student@ai-ems.test" />
        </view>
        <view class="field">
          <text class="label">Phone</text>
          <input v-model="accountForm.phone" placeholder="13700000000" />
        </view>
        <view v-if="accountForm.roleCode === 'student'" class="field">
          <text class="label">Major</text>
          <picker :range="optionLabels.majors" :value="majorIndex" @change="majorIndex = Number($event.detail.value)">
            <view class="picker-value">{{ optionLabels.majors[majorIndex] || 'Select major' }}</view>
          </picker>
        </view>
        <view v-if="accountForm.roleCode === 'student'" class="field">
          <text class="label">Enrollment Year</text>
          <input v-model="accountForm.enrollmentYear" type="number" placeholder="2024" />
        </view>
        <view v-if="accountForm.roleCode === 'teacher'" class="field">
          <text class="label">Department</text>
          <picker :range="optionLabels.departments" :value="teacherDepartmentIndex" @change="teacherDepartmentIndex = Number($event.detail.value)">
            <view class="picker-value">{{ optionLabels.departments[teacherDepartmentIndex] || 'Select department' }}</view>
          </picker>
        </view>
        <view v-if="accountForm.roleCode === 'teacher'" class="field">
          <text class="label">Title</text>
          <input v-model="accountForm.title" placeholder="Lecturer" />
        </view>
        <view v-if="accountForm.roleCode === 'teacher'" class="field">
          <text class="label">Office</text>
          <input v-model="accountForm.office" placeholder="Teaching Building 3-503" />
        </view>
      </view>
      <button class="primary-btn full-btn" :loading="savingAccount" @click="saveAccount">{{ accountSubmitLabel }}</button>
    </view>

    <view class="section">
      <text class="section-title">Publish Course to Cohort</text>
      <view class="form-grid">
        <view class="field">
          <text class="label">Course Code</text>
          <input v-model="courseForm.courseCode" placeholder="JC3506" />
        </view>
        <view class="field">
          <text class="label">Course Name</text>
          <input v-model="courseForm.courseName" placeholder="Software Design" />
        </view>
        <view class="field">
          <text class="label">Credits</text>
          <input v-model="courseForm.credits" type="number" placeholder="15" />
        </view>
        <view class="field">
          <text class="label">Capacity</text>
          <input v-model="courseForm.capacity" type="number" placeholder="50" />
        </view>
        <view class="field">
          <text class="label">Target Major</text>
          <picker :range="optionLabels.majors" :value="courseMajorIndex" @change="courseMajorIndex = Number($event.detail.value)">
            <view class="picker-value">{{ optionLabels.majors[courseMajorIndex] || 'Select major' }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="label">Cohort Year</text>
          <input v-model="courseForm.gradeYear" type="number" placeholder="2024" />
        </view>
        <view class="field">
          <text class="label">Classroom</text>
          <picker :range="optionLabels.classrooms" :value="classroomIndex" @change="classroomIndex = Number($event.detail.value)">
            <view class="picker-value">{{ optionLabels.classrooms[classroomIndex] || 'Select classroom' }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="label">Weekday</text>
          <picker :range="weekdayLabels" :value="weekdayIndex" @change="weekdayIndex = Number($event.detail.value)">
            <view class="picker-value">{{ weekdayLabels[weekdayIndex] }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="label">Start Date</text>
          <picker mode="date" :value="courseForm.startDate" @change="courseForm.startDate = $event.detail.value">
            <view class="picker-value">{{ courseForm.startDate }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="label">End Date</text>
          <picker mode="date" :value="courseForm.endDate" @change="courseForm.endDate = $event.detail.value">
            <view class="picker-value">{{ courseForm.endDate }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="label">Class Start</text>
          <picker mode="time" :value="courseForm.classStartTime" @change="courseForm.classStartTime = $event.detail.value">
            <view class="picker-value">{{ courseForm.classStartTime || 'Select start time' }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="label">Class End</text>
          <picker mode="time" :value="courseForm.classEndTime" @change="courseForm.classEndTime = $event.detail.value">
            <view class="picker-value">{{ courseForm.classEndTime || 'Select end time' }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="label">Total Sessions</text>
          <input v-model="courseForm.totalSessions" type="number" placeholder="16" />
        </view>
        <view class="field">
          <text class="label">Section</text>
          <input v-model="courseForm.sectionNo" placeholder="01" />
        </view>
      </view>

      <view class="field">
        <text class="label">Assigned Teachers</text>
        <view v-if="options.teachers.length" class="teacher-list">
          <view
            v-for="teacher in options.teachers"
            :key="teacher.value"
            class="teacher-option"
            :class="{ selected: courseForm.teacherIds.includes(teacher.value) }"
            @click="toggleTeacher(teacher.value)"
          >
            <text class="teacher-check">{{ courseForm.teacherIds.includes(teacher.value) ? '✓' : '+' }}</text>
            <view class="teacher-copy">
              <text class="teacher-name">{{ teacher.label }}</text>
              <text v-if="teacher.subtitle" class="teacher-meta">{{ teacher.subtitle }}</text>
            </view>
          </view>
        </view>
        <text v-else class="empty-hint">No teachers available. Create a teacher account first.</text>
      </view>

      <button class="primary-btn full-btn" :loading="savingCourse" @click="saveCourse">Publish Course</button>
    </view>

    <view class="section">
      <text class="section-title">Published Courses</text>
      <DataCard
        v-for="course in courses"
        :key="course.courseOfferingId"
        :title="[course.courseCode, course.courseName].filter(Boolean).join(' ')"
        :subtitle="courseSummary(course)"
      />
    </view>

    <view class="section">
      <text class="section-title">Recent Accounts</text>
      <DataCard
        v-for="account in accounts.slice(0, 8)"
        :key="account._id"
        :title="account.displayName || account.username"
        :subtitle="[account.username, account.primaryRole, account.status].filter(Boolean).join(' - ')"
      >
        <view class="account-actions">
          <button class="mini-btn" @click="resetAccountPassword(account)">Reset Password</button>
          <button class="mini-btn danger" :disabled="!canDeleteAccount(account)" @click="deleteAccount(account)">Delete</button>
        </view>
      </DataCard>
    </view>
  </view>
</template>

<script>
import PageHeader from '../../components/PageHeader.vue'
import NavTabs from '../../components/NavTabs.vue'
import DataCard from '../../components/DataCard.vue'
import { callAiemsFunction } from '../../common/api.js'
import { getSession, requireRole } from '../../common/session.js'

export default {
  components: { PageHeader, NavTabs, DataCard },
  data() {
    return {
      session: {},
      loading: false,
      savingAccount: false,
      savingCourse: false,
      accounts: [],
      courses: [],
      options: { departments: [], majors: [], semesters: [], trainingPlans: [], teachers: [], classrooms: [] },
      accountRoleOptions: [
        { value: 'student', label: 'Student' },
        { value: 'teacher', label: 'Teacher' }
      ],
      accountRoleIndex: 0,
      majorIndex: 0,
      teacherDepartmentIndex: 0,
      courseMajorIndex: 0,
      classroomIndex: 0,
      weekdayIndex: 0,
      weekdayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      accountForm: {
        roleCode: 'student',
        username: '',
        password: '',
        displayName: '',
        studentNo: '',
        teacherNo: '',
        email: '',
        phone: '',
        enrollmentYear: '2024',
        title: '',
        office: ''
      },
      courseForm: {
        courseCode: '',
        courseName: '',
        credits: '15',
        capacity: '50',
        gradeYear: '2024',
        sectionNo: '01',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        classStartTime: '10:00',
        classEndTime: '12:00',
        totalSessions: '16',
        teacherIds: []
      }
    }
  },
  computed: {
    optionLabels() {
      const labels = {}
      Object.keys(this.options).forEach(key => {
        labels[key] = (this.options[key] || []).map(item => item.label || item.value)
      })
      return labels
    },
    accountRoleLabels() {
      return this.accountRoleOptions.map(item => item.label)
    },
    accountSubmitLabel() {
      return 'Create Student/Teacher'
    }
  },
  onShow() {
    const session = requireRole(['admin'])
    if (!session) return
    this.session = session
    this.load()
  },
  methods: {
    emptyAccountForm() {
      return {
        roleCode: 'student',
        username: '',
        password: '',
        displayName: '',
        studentNo: '',
        teacherNo: '',
        email: '',
        phone: '',
        enrollmentYear: '2024',
        title: '',
        office: ''
      }
    },
    emptyCourseForm() {
      return {
        courseCode: '',
        courseName: '',
        credits: '15',
        capacity: '50',
        gradeYear: '2024',
        sectionNo: '01',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        classStartTime: '10:00',
        classEndTime: '12:00',
        totalSessions: '16',
        teacherIds: []
      }
    },
    async load(forceRefresh = false) {
      this.loading = true
      const result = await callAiemsFunction('get-admin-management-data', {
        session: getSession(),
        forceRefresh
      })
      this.loading = false
      if (!result.ok) {
        uni.showToast({ title: result.message || 'Failed to load management data.', icon: 'none' })
        return
      }
      this.accounts = result.data.accounts || []
      this.courses = result.data.courses || []
      this.options = { ...this.options, ...(result.data.options || {}) }
    },
    refresh() {
      this.load(true)
    },
    optionValue(key, index) {
      const option = (this.options[key] || [])[index]
      return option ? option.value : ''
    },
    changeAccountRole(event) {
      this.accountRoleIndex = Number(event.detail.value)
      const role = this.accountRoleOptions[this.accountRoleIndex] || this.accountRoleOptions[0]
      this.accountForm.roleCode = role.value
    },
    async saveAccount() {
      const password = this.accountForm.password.trim()
      const roleCode = this.accountForm.roleCode || 'student'
      if (!this.accountForm.username || !this.accountForm.displayName || !password) {
        uni.showToast({ title: 'Username, name and password are required.', icon: 'none' })
        return
      }
      if (roleCode === 'student' && (!this.accountForm.studentNo || !this.optionValue('majors', this.majorIndex) || !this.accountForm.enrollmentYear)) {
        uni.showToast({ title: 'Student number, major and enrollment year are required.', icon: 'none' })
        return
      }
      if (roleCode === 'teacher' && (!this.accountForm.teacherNo || !this.optionValue('departments', this.teacherDepartmentIndex))) {
        uni.showToast({ title: 'Teacher number and department are required.', icon: 'none' })
        return
      }
      const payload = {
        session: getSession(),
        username: this.accountForm.username.trim(),
        password,
        displayName: this.accountForm.displayName.trim(),
        email: this.accountForm.email.trim(),
        phone: this.accountForm.phone.trim(),
        roleCode
      }
      if (roleCode === 'student') {
        payload.studentProfile = {
          studentNo: this.accountForm.studentNo.trim(),
          majorId: this.optionValue('majors', this.majorIndex),
          enrollmentYear: Number(this.accountForm.enrollmentYear || 0)
        }
      } else {
        payload.teacherProfile = {
          teacherNo: this.accountForm.teacherNo.trim(),
          departmentId: this.optionValue('departments', this.teacherDepartmentIndex),
          title: this.accountForm.title.trim(),
          office: this.accountForm.office.trim()
        }
      }
      this.savingAccount = true
      const result = await callAiemsFunction('save-admin-account', payload)
      this.savingAccount = false
      if (result.ok) {
        uni.showToast({ title: roleCode === 'teacher' ? 'Teacher created' : 'Student created', icon: 'success' })
        this.accountForm = this.emptyAccountForm()
        this.accountRoleIndex = 0
        this.load(true)
        return
      }
      uni.showToast({ title: result.message || 'Save failed.', icon: 'none' })
    },
    canDeleteAccount(account) {
      return account && account._id && account._id !== this.session.userId
    },
    resetAccountPassword(account) {
      if (!account || !account._id) return
      uni.showModal({
        title: 'Reset Password',
        content: '',
        editable: true,
        placeholderText: 'Enter new password',
        success: async (modal) => {
          if (!modal.confirm) return
          const password = String(modal.content || '').trim()
          if (!password) {
            uni.showToast({ title: 'New password is required.', icon: 'none' })
            return
          }
          const result = await callAiemsFunction('save-admin-account', {
            session: getSession(),
            userId: account._id,
            roleCode: account.primaryRole,
            password
          })
          if (result.ok) {
            uni.showToast({ title: 'Password reset', icon: 'success' })
            this.load(true)
            return
          }
          uni.showToast({ title: result.message || 'Reset failed.', icon: 'none' })
        }
      })
    },
    deleteAccount(account) {
      if (!this.canDeleteAccount(account)) {
        uni.showToast({ title: 'You cannot delete the current admin account.', icon: 'none' })
        return
      }
      uni.showModal({
        title: 'Delete Account',
        content: `Delete ${account.displayName || account.username}? This cannot be undone.`,
        confirmText: 'Delete',
        success: async (modal) => {
          if (!modal.confirm) return
          const result = await callAiemsFunction('delete-admin-account', {
            session: getSession(),
            userId: account._id
          })
          if (result.ok) {
            uni.showToast({ title: 'Account deleted', icon: 'success' })
            this.load(true)
            return
          }
          uni.showToast({ title: result.message || 'Delete failed.', icon: 'none' })
        }
      })
    },
    toggleTeacher(teacherId) {
      if (!teacherId) return
      const selected = new Set(this.courseForm.teacherIds)
      if (selected.has(teacherId)) {
        selected.delete(teacherId)
      } else {
        selected.add(teacherId)
      }
      this.courseForm.teacherIds = Array.from(selected)
    },
    async saveCourse() {
      if (!this.courseForm.courseCode || !this.courseForm.courseName || !this.optionValue('majors', this.courseMajorIndex) || !this.courseForm.gradeYear || !this.optionValue('classrooms', this.classroomIndex) || !this.courseForm.teacherIds.length) {
        uni.showToast({ title: 'Course code, name, major, cohort year, classroom and teachers are required.', icon: 'none' })
        return
      }
      this.savingCourse = true
      const result = await callAiemsFunction('save-admin-course', {
        session: getSession(),
        courseCode: this.courseForm.courseCode.trim(),
        courseName: this.courseForm.courseName.trim(),
        majorId: this.optionValue('majors', this.courseMajorIndex),
        classroomId: this.optionValue('classrooms', this.classroomIndex),
        gradeYear: Number(this.courseForm.gradeYear || 0),
        sectionNo: this.courseForm.sectionNo.trim() || '01',
        teacherIds: this.courseForm.teacherIds,
        capacity: Number(this.courseForm.capacity || 0),
        selectionStatus: 'open',
        courseStartDate: this.courseForm.startDate,
        courseEndDate: this.courseForm.endDate,
        classWeekday: this.weekdayIndex + 1,
        classStartTime: this.courseForm.classStartTime.trim(),
        classEndTime: this.courseForm.classEndTime.trim(),
        totalSessions: Number(this.courseForm.totalSessions || 0),
        credits: Number(this.courseForm.credits || 0),
        courseType: 'major_required',
        difficultyLevel: 3
      })
      this.savingCourse = false
      if (result.ok) {
        uni.showToast({ title: 'Course published', icon: 'success' })
        this.courseForm = this.emptyCourseForm()
        this.load(true)
        return
      }
      uni.showToast({ title: result.message || 'Publish failed.', icon: 'none' })
    },
    courseSummary(course) {
      const schedule = [course.startDate, course.endDate, course.classStartTime && course.classEndTime ? course.classStartTime + '-' + course.classEndTime : ''].filter(Boolean).join(' / ')
      return [
        'Cohort ' + (course.gradeYear || ''),
        course.majorName || '',
        course.classroomName || '',
        (course.teacherNames || []).join(', '),
        course.credits ? course.credits + ' credits' : '',
        course.totalSessions ? course.totalSessions + ' sessions' : '',
        schedule
      ].filter(Boolean).join(' - ')
    }
  }
}
</script>

<style scoped>
.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 14rpx;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

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

.teacher-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 12rpx;
}

.teacher-option {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-height: 80rpx;
  padding: 14rpx 16rpx;
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
  color: #0f172a;
}

.teacher-option.selected {
  background: #eff6ff;
  border-color: #2563eb;
}

.teacher-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34rpx;
  height: 34rpx;
  border: 1rpx solid #94a3b8;
  border-radius: 50%;
  color: #2563eb;
  font-size: 24rpx;
  line-height: 1;
  flex-shrink: 0;
}

.teacher-option.selected .teacher-check {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}

.teacher-copy {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}

.teacher-name {
  color: #0f172a;
  font-size: 28rpx;
}

.teacher-meta,
.empty-hint {
  color: #64748b;
  font-size: 24rpx;
}

.empty-hint {
  display: block;
  margin-top: 12rpx;
}

.full-btn {
  width: 100%;
}

.account-actions {
  display: flex;
  gap: 10rpx;
  align-items: center;
}

.mini-btn {
  min-width: 150rpx;
  padding: 8rpx 14rpx;
  border: 1rpx solid #cbd5e1;
  border-radius: 8rpx;
  background: #ffffff;
  color: #1e293b;
  font-size: 24rpx;
  line-height: 1.4;
}

.mini-btn.danger {
  border-color: #fecaca;
  color: #b91c1c;
}

.mini-btn[disabled] {
  color: #94a3b8;
  background: #f1f5f9;
  border-color: #e2e8f0;
}

.refresh-btn {
  min-width: 150rpx;
}

@media (max-width: 700px) {
  .form-grid,
  .teacher-list {
    grid-template-columns: 1fr;
  }

  .account-actions {
    margin-top: 14rpx;
    width: 100%;
  }
}
</style>
