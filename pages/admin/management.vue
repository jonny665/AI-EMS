<template>
  <view class="page">
    <PageHeader
      title="Administration Console"
      :displayName="session.displayName"
      :username="session.username"
    >
      <button class="secondary-btn refresh-btn" :loading="loading" @click="refresh">Refresh</button>
      <button class="secondary-btn" @click="backHome">Home</button>
    </PageHeader>

    <view class="section">
      <view class="section-head">
        <view>
          <text class="section-title">Management Overview</text>
          <text class="muted">Accounts, courses, and course materials</text>
        </view>
        <text class="muted">{{ lastUpdatedText }}</text>
      </view>
      <view class="row stats-row">
        <StatCard :value="managementData.summary.users" label="Accounts" />
        <StatCard :value="managementData.summary.students" label="Students" />
        <StatCard :value="managementData.summary.teachers" label="Teachers" />
        <StatCard :value="managementData.summary.courses" label="Courses" />
        <StatCard :value="managementData.summary.materials" label="Materials" />
      </view>
    </view>

    <view class="tab-row">
      <button class="tab-btn" :class="currentTab === 'accounts' ? 'tab-btn-active' : ''" @click="currentTab = 'accounts'">Accounts</button>
      <button class="tab-btn" :class="currentTab === 'courses' ? 'tab-btn-active' : ''" @click="currentTab = 'courses'">Courses</button>
      <button class="tab-btn" :class="currentTab === 'materials' ? 'tab-btn-active' : ''" @click="currentTab = 'materials'">Materials</button>
    </view>

    <view v-if="currentTab === 'accounts'">
      <view class="section">
        <view class="section-head">
          <view>
            <text class="section-title">Account Form</text>
            <text class="muted">Leave password empty to keep the current one when editing.</text>
          </view>
          <button class="secondary-btn compact-btn" @click="resetAccountForm">New Account</button>
        </view>

        <view class="field">
          <text class="label">Username</text>
          <input v-model="accountForm.username" placeholder="Login username" />
        </view>

        <view class="field">
          <text class="label">Display Name</text>
          <input v-model="accountForm.displayName" placeholder="Display name" />
        </view>

        <view class="field">
          <text class="label">Email</text>
          <input v-model="accountForm.email" placeholder="name@example.com" />
        </view>

        <view class="field">
          <text class="label">Phone</text>
          <input v-model="accountForm.phone" placeholder="Phone number" />
        </view>

        <view class="field">
          <text class="label">Status</text>
          <picker :range="userStatusLabels" :value="accountStatusIndex" @change="changeAccountStatus">
            <view class="picker-value">{{ userStatusLabels[accountStatusIndex] || 'active' }}</view>
          </picker>
        </view>

        <view class="field">
          <text class="label">Role</text>
          <picker v-if="!accountForm.userId" :range="roleLabels" :value="accountRoleIndex" @change="changeAccountRole">
            <view class="picker-value">{{ roleLabels[accountRoleIndex] || 'Student' }}</view>
          </picker>
          <view v-else class="picker-value readonly-value">{{ roleLabel(accountForm.roleCode) }}</view>
        </view>

        <view class="field">
          <text class="label">Password{{ accountForm.userId ? ' (optional)' : '' }}</text>
          <input v-model="accountForm.password" type="password" placeholder="Enter a password" />
        </view>

        <view class="switch-row">
          <view>
            <text class="label">Force Change Password</text>
            <text class="muted">Recommend enabling this after resets or first-time setup.</text>
          </view>
          <switch :checked="accountForm.forceChangePassword" @change="toggleAccountForceChange" />
        </view>

        <view v-if="accountForm.roleCode === 'student'" class="subsection">
          <text class="subsection-title">Student Profile</text>
          <view class="field">
            <text class="label">Student No.</text>
            <input v-model="accountForm.studentProfile.studentNo" placeholder="Student number" />
          </view>
          <view class="field">
            <text class="label">Major</text>
            <picker :range="majorLabels" :value="studentMajorIndex" @change="changeStudentMajor">
              <view class="picker-value">{{ majorLabels[studentMajorIndex] || 'Select major' }}</view>
            </picker>
          </view>
          <view class="field">
            <text class="label">Admin Class</text>
            <picker :range="adminClassLabels" :value="studentAdminClassIndex" @change="changeStudentAdminClass">
              <view class="picker-value">{{ adminClassLabels[studentAdminClassIndex] || 'Select class' }}</view>
            </picker>
          </view>
          <view class="field">
            <text class="label">Enrollment Year</text>
            <input v-model="accountForm.studentProfile.enrollmentYear" type="number" placeholder="2024" />
          </view>
          <view class="field">
            <text class="label">Student Status</text>
            <picker :range="studentStatusLabels" :value="studentStatusIndex" @change="changeStudentStatus">
              <view class="picker-value">{{ studentStatusLabels[studentStatusIndex] || 'active' }}</view>
            </picker>
          </view>
          <view class="field">
            <text class="label">Training Plan ID</text>
            <input v-model="accountForm.studentProfile.trainingPlanId" placeholder="Optional" />
          </view>
        </view>

        <view v-if="accountForm.roleCode === 'teacher'" class="subsection">
          <text class="subsection-title">Teacher Profile</text>
          <view class="field">
            <text class="label">Teacher No.</text>
            <input v-model="accountForm.teacherProfile.teacherNo" placeholder="Teacher number" />
          </view>
          <view class="field">
            <text class="label">Department</text>
            <picker :range="departmentLabels" :value="teacherDepartmentIndex" @change="changeTeacherDepartment">
              <view class="picker-value">{{ departmentLabels[teacherDepartmentIndex] || 'Select department' }}</view>
            </picker>
          </view>
          <view class="field">
            <text class="label">Title</text>
            <input v-model="accountForm.teacherProfile.title" placeholder="Title" />
          </view>
          <view class="field">
            <text class="label">Office</text>
            <input v-model="accountForm.teacherProfile.office" placeholder="Office" />
          </view>
          <view class="field">
            <text class="label">Research Fields</text>
            <textarea v-model="accountForm.teacherProfile.researchFields" placeholder="Comma separated research fields" />
          </view>
          <view class="field">
            <text class="label">Teaching Experience</text>
            <textarea v-model="accountForm.teacherProfile.teachingExperience" placeholder="Short teaching experience summary" />
          </view>
          <view class="field">
            <text class="label">Teacher Status</text>
            <picker :range="teacherStatusLabels" :value="teacherStatusIndex" @change="changeTeacherStatus">
              <view class="picker-value">{{ teacherStatusLabels[teacherStatusIndex] || 'active' }}</view>
            </picker>
          </view>
        </view>

        <button class="primary-btn full-btn" :loading="savingAccount" @click="saveAccount">
          {{ accountForm.userId ? 'Update Account' : 'Create Account' }}
        </button>
      </view>

      <view class="section">
        <text class="section-title">Accounts</text>
        <template v-if="!managementData.accounts.length">
          <text class="muted">No accounts found.</text>
        </template>
        <DataCard
          v-for="item in managementData.accounts"
          :key="item._id"
          :title="[item.displayName, item.username].filter(Boolean).join(' - ')"
          :subtitle="accountSubtitle(item)"
        >
          <view class="inline-actions">
            <StatusBadge :status="item.status" />
            <button class="secondary-btn compact-btn" @click="editAccount(item)">Edit</button>
          </view>
        </DataCard>
      </view>
    </view>

    <view v-else-if="currentTab === 'courses'">
      <view class="section">
        <view class="section-head">
          <view>
            <text class="section-title">Course Form</text>
            <text class="muted">Edit the course master record and its offering together.</text>
          </view>
          <button class="secondary-btn compact-btn" @click="resetCourseForm">New Course</button>
        </view>

        <view class="field">
          <text class="label">Course Code</text>
          <input v-model="courseForm.courseCode" placeholder="JC3506" />
        </view>

        <view class="field">
          <text class="label">Course Name</text>
          <input v-model="courseForm.courseName" placeholder="Course name" />
        </view>

        <view class="field">
          <text class="label">Department</text>
          <picker :range="departmentLabels" :value="courseDepartmentIndex" @change="changeCourseDepartment">
            <view class="picker-value">{{ departmentLabels[courseDepartmentIndex] || 'Select department' }}</view>
          </picker>
        </view>

        <view class="field-grid">
          <view class="field">
            <text class="label">Credits</text>
            <input v-model="courseForm.credits" type="number" placeholder="3" />
          </view>
          <view class="field">
            <text class="label">Difficulty</text>
            <input v-model="courseForm.difficultyLevel" type="number" placeholder="1-5" />
          </view>
        </view>

        <view class="field">
          <text class="label">Course Type</text>
          <picker :range="courseTypeLabels" :value="courseTypeIndex" @change="changeCourseType">
            <view class="picker-value">{{ courseTypeLabels[courseTypeIndex] || 'major_required' }}</view>
          </picker>
        </view>

        <view class="field">
          <text class="label">Description</text>
          <textarea v-model="courseForm.description" placeholder="Course description" />
        </view>

        <view class="field">
          <text class="label">Course Status</text>
          <picker :range="courseStatusLabels" :value="courseStatusIndex" @change="changeCourseStatus">
            <view class="picker-value">{{ courseStatusLabels[courseStatusIndex] || 'active' }}</view>
          </picker>
        </view>

        <view class="field">
          <text class="label">Semester</text>
          <picker :range="semesterLabels" :value="courseSemesterIndex" @change="changeCourseSemester">
            <view class="picker-value">{{ semesterLabels[courseSemesterIndex] || 'Select semester' }}</view>
          </picker>
        </view>

        <view class="field-grid">
          <view class="field">
            <text class="label">Section</text>
            <input v-model="courseForm.sectionNo" placeholder="A01" />
          </view>
          <view class="field">
            <text class="label">Capacity</text>
            <input v-model="courseForm.capacity" type="number" placeholder="50" />
          </view>
        </view>

        <view class="field">
          <text class="label">Selection Status</text>
          <picker :range="selectionStatusLabels" :value="selectionStatusIndex" @change="changeSelectionStatus">
            <view class="picker-value">{{ selectionStatusLabels[selectionStatusIndex] || 'not_started' }}</view>
          </picker>
        </view>

        <view class="field">
          <text class="label">Syllabus URL</text>
          <input v-model="courseForm.syllabusUrl" placeholder="https://..." />
        </view>

        <view class="field">
          <text class="label">Teachers</text>
          <view v-if="!teacherOptionValues.length" class="muted">No teachers available.</view>
          <checkbox-group v-else class="checkbox-grid" :value="courseForm.teacherIds" @change="changeCourseTeachers">
            <label v-for="teacher in teacherOptions" :key="teacher.value" class="checkbox-pill">
              <checkbox :value="teacher.value" />
              <text>{{ teacher.label }}</text>
            </label>
          </checkbox-group>
        </view>

        <button class="primary-btn full-btn" :loading="savingCourse" @click="saveCourse">
          {{ courseForm.courseOfferingId ? 'Update Course' : 'Create Course' }}
        </button>
      </view>

      <view class="section">
        <text class="section-title">Courses</text>
        <template v-if="!managementData.courses.length">
          <text class="muted">No courses found.</text>
        </template>
        <DataCard
          v-for="item in managementData.courses"
          :key="item.courseOfferingId || item._id"
          :title="[item.courseCode, item.courseName, item.sectionNo].filter(Boolean).join(' ')"
          :subtitle="courseSubtitle(item)"
        >
          <view class="inline-actions">
            <StatusBadge :status="item.status" />
            <button class="secondary-btn compact-btn" @click="editCourse(item)">Edit</button>
          </view>
        </DataCard>
      </view>
    </view>

    <view v-else class="section">
      <view class="section-head">
        <view>
          <text class="section-title">Material Form</text>
          <text class="muted">Admin users can use the existing material save endpoint to upload or edit materials.</text>
        </view>
        <button class="secondary-btn compact-btn" @click="resetMaterialForm">New Material</button>
      </view>

      <view class="field">
        <text class="label">Course Offering</text>
        <picker :range="courseLabels" :value="materialCourseIndex" @change="changeMaterialCourse">
          <view class="picker-value">{{ courseLabels[materialCourseIndex] || 'Select course' }}</view>
        </picker>
      </view>

      <view class="field">
        <text class="label">Title</text>
        <input v-model="materialForm.title" placeholder="Material title" />
      </view>

      <view class="field">
        <text class="label">File URL</text>
        <input v-model="materialForm.fileUrl" placeholder="https://..." />
      </view>

      <view class="field">
        <text class="label">File Type</text>
        <picker :range="fileTypeLabels" :value="materialFileTypeIndex" @change="changeMaterialFileType">
          <view class="picker-value">{{ fileTypeLabels[materialFileTypeIndex] || 'link' }}</view>
        </picker>
      </view>

      <view class="field">
        <text class="label">Knowledge Document ID</text>
        <input v-model="materialForm.knowledgeDocumentId" placeholder="Optional" />
      </view>

      <view class="switch-row">
        <view>
          <text class="label">Visible to Students</text>
          <text class="muted">Toggle whether students can see this material.</text>
        </view>
        <switch :checked="materialForm.isPublicToStudents" @change="toggleMaterialVisibility" />
      </view>

      <button class="primary-btn full-btn" :loading="savingMaterial" @click="saveMaterial">
        {{ materialForm.materialId ? 'Update Material' : 'Create Material' }}
      </button>

      <view class="section material-section">
        <text class="section-title">Materials</text>
        <template v-if="!managementData.materials.length">
          <text class="muted">No course materials found.</text>
        </template>
        <DataCard
          v-for="item in managementData.materials"
          :key="item._id"
          :title="item.title"
          :subtitle="materialSubtitle(item)"
        >
          <view class="inline-actions">
            <button class="secondary-btn compact-btn" @click="copyMaterialUrl(item)">Copy URL</button>
            <button class="secondary-btn compact-btn" @click="editMaterial(item)">Edit</button>
          </view>
        </DataCard>
      </view>
    </view>
  </view>
</template>

<script>
import PageHeader from '../../components/PageHeader.vue'
import DataCard from '../../components/DataCard.vue'
import StatCard from '../../components/StatCard.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { callAiemsFunction } from '../../common/api.js'
import { dashboardUrl, getSession, requireRole } from '../../common/session.js'

export default {
  components: { PageHeader, DataCard, StatCard, StatusBadge },
  data() {
    return {
      session: {},
      loading: false,
      savingAccount: false,
      savingCourse: false,
      savingMaterial: false,
      currentTab: 'accounts',
      lastUpdatedAt: 0,
      managementData: {
        accounts: [],
        courses: [],
        materials: [],
        options: {
          roles: [],
          departments: [],
          majors: [],
          adminClasses: [],
          semesters: [],
          teachers: []
        },
        summary: {
          users: 0,
          students: 0,
          teachers: 0,
          courses: 0,
          materials: 0
        }
      },
      accountForm: this.defaultAccountForm(),
      courseForm: this.defaultCourseForm(),
      materialForm: this.defaultMaterialForm(),
      userStatusOptions: [
        { value: 'active', label: 'active' },
        { value: 'disabled', label: 'disabled' },
        { value: 'pending', label: 'pending' }
      ],
      studentStatusOptions: [
        { value: 'active', label: 'active' },
        { value: 'suspended', label: 'suspended' },
        { value: 'graduated', label: 'graduated' },
        { value: 'withdrawn', label: 'withdrawn' }
      ],
      teacherStatusOptions: [
        { value: 'active', label: 'active' },
        { value: 'inactive', label: 'inactive' }
      ],
      courseStatusOptions: [
        { value: 'active', label: 'active' },
        { value: 'inactive', label: 'inactive' }
      ],
      courseTypeOptions: [
        { value: 'general', label: 'general' },
        { value: 'major_required', label: 'major_required' },
        { value: 'major_elective', label: 'major_elective' },
        { value: 'public_elective', label: 'public_elective' },
        { value: 'practice', label: 'practice' }
      ],
      selectionStatusOptions: [
        { value: 'not_started', label: 'not_started' },
        { value: 'open', label: 'open' },
        { value: 'closed', label: 'closed' },
        { value: 'cancelled', label: 'cancelled' }
      ],
      fileTypes: ['document', 'slide', 'video', 'link', 'other']
    }
  },
  computed: {
    summaryCards() {
      return [
        { label: 'Accounts', value: this.managementData.summary.users },
        { label: 'Students', value: this.managementData.summary.students },
        { label: 'Teachers', value: this.managementData.summary.teachers },
        { label: 'Courses', value: this.managementData.summary.courses },
        { label: 'Materials', value: this.managementData.summary.materials }
      ]
    },
    lastUpdatedText() {
      return this.lastUpdatedAt ? 'Updated ' + this.formatTime(this.lastUpdatedAt) : ''
    },
    roleLabels() {
      return this.managementData.options.roles.map(item => item.label)
    },
    roleOptionValues() {
      return this.managementData.options.roles.map(item => item.value)
    },
    departmentLabels() {
      return this.managementData.options.departments.map(item => item.label)
    },
    departmentOptionValues() {
      return this.managementData.options.departments.map(item => item.value)
    },
    majorLabels() {
      return this.managementData.options.majors.map(item => item.label)
    },
    majorOptionValues() {
      return this.managementData.options.majors.map(item => item.value)
    },
    adminClassLabels() {
      return this.managementData.options.adminClasses.map(item => item.label)
    },
    adminClassOptionValues() {
      return this.managementData.options.adminClasses.map(item => item.value)
    },
    semesterLabels() {
      return this.managementData.options.semesters.map(item => item.label)
    },
    semesterOptionValues() {
      return this.managementData.options.semesters.map(item => item.value)
    },
    teacherOptions() {
      return this.managementData.options.teachers
    },
    teacherOptionValues() {
      return this.managementData.options.teachers.map(item => item.value)
    },
    userStatusLabels() {
      return this.userStatusOptions.map(item => item.label)
    },
    studentStatusLabels() {
      return this.studentStatusOptions.map(item => item.label)
    },
    teacherStatusLabels() {
      return this.teacherStatusOptions.map(item => item.label)
    },
    courseStatusLabels() {
      return this.courseStatusOptions.map(item => item.label)
    },
    courseTypeLabels() {
      return this.courseTypeOptions.map(item => item.label)
    },
    selectionStatusLabels() {
      return this.selectionStatusOptions.map(item => item.label)
    },
    fileTypeLabels() {
      return this.fileTypes
    },
    accountRoleIndex() {
      return this.optionIndex(this.roleOptionValues, this.accountForm.roleCode)
    },
    accountStatusIndex() {
      return this.optionIndex(this.userStatusOptions.map(item => item.value), this.accountForm.status)
    },
    studentMajorIndex() {
      return this.optionIndex(this.majorOptionValues, this.accountForm.studentProfile.majorId)
    },
    studentAdminClassIndex() {
      return this.optionIndex(this.adminClassOptionValues, this.accountForm.studentProfile.adminClassId)
    },
    studentStatusIndex() {
      return this.optionIndex(this.studentStatusOptions.map(item => item.value), this.accountForm.studentProfile.status)
    },
    teacherDepartmentIndex() {
      return this.optionIndex(this.departmentOptionValues, this.accountForm.teacherProfile.departmentId)
    },
    teacherStatusIndex() {
      return this.optionIndex(this.teacherStatusOptions.map(item => item.value), this.accountForm.teacherProfile.status)
    },
    courseDepartmentIndex() {
      return this.optionIndex(this.departmentOptionValues, this.courseForm.departmentId)
    },
    courseSemesterIndex() {
      return this.optionIndex(this.semesterOptionValues, this.courseForm.semesterId)
    },
    courseStatusIndex() {
      return this.optionIndex(this.courseStatusOptions.map(item => item.value), this.courseForm.status)
    },
    courseTypeIndex() {
      return this.optionIndex(this.courseTypeOptions.map(item => item.value), this.courseForm.courseType)
    },
    selectionStatusIndex() {
      return this.optionIndex(this.selectionStatusOptions.map(item => item.value), this.courseForm.selectionStatus)
    },
    materialCourseIndex() {
      return this.optionIndex(this.courseOfferingValues, this.materialForm.courseOfferingId)
    },
    materialFileTypeIndex() {
      return this.optionIndex(this.fileTypes, this.materialForm.fileType)
    },
    courseOfferingValues() {
      return this.managementData.courses.map(item => item.courseOfferingId || item._id)
    },
    courseLabels() {
      return this.managementData.courses.map(item => this.courseLabel(item))
    }
  },
  onShow() {
    const session = requireRole(['admin'])
    if (!session) return
    this.session = session
    this.load()
  },
  methods: {
    defaultAccountForm() {
      return {
        userId: '',
        username: '',
        displayName: '',
        email: '',
        phone: '',
        status: 'active',
        roleCode: 'student',
        password: '',
        forceChangePassword: false,
        studentProfile: {
          studentNo: '',
          majorId: '',
          adminClassId: '',
          enrollmentYear: String(new Date().getFullYear()),
          trainingPlanId: '',
          status: 'active'
        },
        teacherProfile: {
          teacherNo: '',
          departmentId: '',
          title: '',
          office: '',
          researchFields: '',
          teachingExperience: '',
          status: 'active'
        }
      }
    },
    defaultCourseForm() {
      return {
        courseId: '',
        courseOfferingId: '',
        courseCode: '',
        courseName: '',
        departmentId: '',
        description: '',
        status: 'active',
        credits: '',
        courseType: 'major_required',
        difficultyLevel: '3',
        semesterId: '',
        sectionNo: '',
        teacherIds: [],
        capacity: '',
        selectionStatus: 'not_started',
        syllabusUrl: ''
      }
    },
    defaultMaterialForm() {
      return {
        materialId: '',
        courseOfferingId: '',
        title: '',
        fileUrl: '',
        fileType: 'link',
        knowledgeDocumentId: '',
        isPublicToStudents: true
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
        uni.showToast({ title: result.message || 'Failed to load admin data.', icon: 'none' })
        return
      }

      this.managementData = {
        ...this.managementData,
        ...result.data,
        accounts: result.data.accounts || [],
        courses: result.data.courses || [],
        materials: result.data.materials || [],
        options: {
          roles: (result.data.options && result.data.options.roles) || [],
          departments: (result.data.options && result.data.options.departments) || [],
          majors: (result.data.options && result.data.options.majors) || [],
          adminClasses: (result.data.options && result.data.options.adminClasses) || [],
          semesters: (result.data.options && result.data.options.semesters) || [],
          teachers: (result.data.options && result.data.options.teachers) || []
        },
        summary: result.data.summary || this.managementData.summary
      }
      this.lastUpdatedAt = Date.now()

      if (!this.accountForm.userId) {
        this.resetAccountForm(this.accountForm.roleCode || 'student')
      }
      if (!this.courseForm.courseOfferingId) {
        this.resetCourseForm()
      }
      if (!this.materialForm.materialId) {
        this.resetMaterialForm()
      }
    },
    refresh() {
      this.load(true)
    },
    backHome() {
      uni.reLaunch({ url: dashboardUrl(this.session.role) })
    },
    optionIndex(values, selectedValue) {
      const index = values.findIndex(item => item === selectedValue)
      return index >= 0 ? index : 0
    },
    roleLabel(roleCode) {
      const option = this.managementData.options.roles.find(item => item.value === roleCode)
      return option ? option.label : roleCode
    },
    courseLabel(course) {
      return [course.courseCode, course.courseName, course.sectionNo].filter(Boolean).join(' ').trim() || 'Unnamed course'
    },
    accountSubtitle(item) {
      const parts = [
        item.primaryRole,
        item.email,
        item.phone,
        item.studentProfile ? item.studentProfile.studentNo : '',
        item.teacherProfile ? item.teacherProfile.teacherNo : '',
        item.status
      ].filter(Boolean)
      return parts.join(' - ')
    },
    courseSubtitle(item) {
      return [item.departmentName, item.semesterName, item.teacherNames.join(', '), item.capacity ? item.capacity + ' seats' : '', item.selectionStatus, item.materialCount ? item.materialCount + ' materials' : '']
        .filter(Boolean)
        .join(' - ')
    },
    materialSubtitle(item) {
      return [item.courseName || item.courseCode, item.fileType, item.isPublicToStudents ? 'public' : 'private', item.uploaderName].filter(Boolean).join(' - ')
    },
    resetAccountForm(roleCode = 'student') {
      const majorId = this.majorOptionValues[0] || ''
      const adminClassId = this.adminClassOptionValues[0] || ''
      const departmentId = this.departmentOptionValues[0] || ''
      const studentStatus = this.studentStatusOptions[0] ? this.studentStatusOptions[0].value : 'active'
      const teacherStatus = this.teacherStatusOptions[0] ? this.teacherStatusOptions[0].value : 'active'
      this.accountForm = this.defaultAccountForm()
      this.accountForm.roleCode = roleCode
      this.accountForm.studentProfile.majorId = majorId
      this.accountForm.studentProfile.adminClassId = adminClassId
      this.accountForm.studentProfile.status = studentStatus
      this.accountForm.teacherProfile.departmentId = departmentId
      this.accountForm.teacherProfile.status = teacherStatus
    },
    resetCourseForm() {
      const departmentId = this.departmentOptionValues[0] || ''
      const semesterId = this.semesterOptionValues[0] || ''
      const teacherIds = this.teacherOptionValues.length ? [this.teacherOptionValues[0]] : []
      this.courseForm = this.defaultCourseForm()
      this.courseForm.departmentId = departmentId
      this.courseForm.semesterId = semesterId
      this.courseForm.teacherIds = teacherIds
      this.courseForm.status = this.courseStatusOptions[0] ? this.courseStatusOptions[0].value : 'active'
      this.courseForm.courseType = this.courseTypeOptions[1] ? this.courseTypeOptions[1].value : 'major_required'
      this.courseForm.selectionStatus = this.selectionStatusOptions[0] ? this.selectionStatusOptions[0].value : 'not_started'
      this.courseForm.difficultyLevel = '3'
    },
    resetMaterialForm() {
      this.materialForm = this.defaultMaterialForm()
      this.materialForm.courseOfferingId = this.courseOfferingValues[0] || ''
      this.materialForm.fileType = this.fileTypes[3] || 'link'
    },
    editAccount(item) {
      this.accountForm = this.defaultAccountForm()
      this.accountForm.userId = item._id || ''
      this.accountForm.username = item.username || ''
      this.accountForm.displayName = item.displayName || ''
      this.accountForm.email = item.email || ''
      this.accountForm.phone = item.phone || ''
      this.accountForm.status = item.status || 'active'
      this.accountForm.roleCode = item.primaryRole || 'student'
      this.accountForm.forceChangePassword = item.mustChangePassword === true
      this.accountForm.password = ''
      if (item.studentProfile) {
        this.accountForm.studentProfile = {
          studentNo: item.studentProfile.studentNo || '',
          majorId: item.studentProfile.majorId || this.majorOptionValues[0] || '',
          adminClassId: item.studentProfile.adminClassId || this.adminClassOptionValues[0] || '',
          enrollmentYear: String(item.studentProfile.enrollmentYear || ''),
          trainingPlanId: item.studentProfile.trainingPlanId || '',
          status: item.studentProfile.status || 'active'
        }
      } else if (item.primaryRole === 'student') {
        this.accountForm.studentProfile = {
          studentNo: '',
          majorId: this.majorOptionValues[0] || '',
          adminClassId: this.adminClassOptionValues[0] || '',
          enrollmentYear: String(new Date().getFullYear()),
          trainingPlanId: '',
          status: 'active'
        }
      }
      if (item.teacherProfile) {
        this.accountForm.teacherProfile = {
          teacherNo: item.teacherProfile.teacherNo || '',
          departmentId: item.teacherProfile.departmentId || this.departmentOptionValues[0] || '',
          title: item.teacherProfile.title || '',
          office: item.teacherProfile.office || '',
          researchFields: Array.isArray(item.teacherProfile.researchFields) ? item.teacherProfile.researchFields.join(', ') : '',
          teachingExperience: item.teacherProfile.teachingExperience || '',
          status: item.teacherProfile.status || 'active'
        }
      } else if (item.primaryRole === 'teacher') {
        this.accountForm.teacherProfile = {
          teacherNo: '',
          departmentId: this.departmentOptionValues[0] || '',
          title: '',
          office: '',
          researchFields: '',
          teachingExperience: '',
          status: 'active'
        }
      }
    },
    editCourse(item) {
      this.courseForm = this.defaultCourseForm()
      this.courseForm.courseId = item.courseId || ''
      this.courseForm.courseOfferingId = item.courseOfferingId || ''
      this.courseForm.courseCode = item.courseCode || ''
      this.courseForm.courseName = item.courseName || ''
      this.courseForm.departmentId = item.departmentId || this.departmentOptionValues[0] || ''
      this.courseForm.description = item.description || ''
      this.courseForm.status = item.status || 'active'
      this.courseForm.credits = String(item.credits || '')
      this.courseForm.courseType = item.courseType || 'major_required'
      this.courseForm.difficultyLevel = String(item.difficultyLevel || '3')
      this.courseForm.semesterId = item.semesterId || this.semesterOptionValues[0] || ''
      this.courseForm.sectionNo = item.sectionNo || ''
      this.courseForm.teacherIds = Array.isArray(item.teacherIds) ? item.teacherIds.slice() : []
      this.courseForm.capacity = String(item.capacity || '')
      this.courseForm.selectionStatus = item.selectionStatus || 'not_started'
      this.courseForm.syllabusUrl = item.syllabusUrl || ''
    },
    editMaterial(item) {
      this.materialForm = this.defaultMaterialForm()
      this.materialForm.materialId = item._id || ''
      this.materialForm.courseOfferingId = item.courseOfferingId || this.courseOfferingValues[0] || ''
      this.materialForm.title = item.title || ''
      this.materialForm.fileUrl = item.fileUrl || ''
      this.materialForm.fileType = item.fileType || 'link'
      this.materialForm.knowledgeDocumentId = item.knowledgeDocumentId || ''
      this.materialForm.isPublicToStudents = item.isPublicToStudents === true
    },
    changeAccountRole(event) {
      const index = Number(event.detail.value)
      this.accountForm.roleCode = this.roleOptionValues[index] || 'student'
      if (this.accountForm.roleCode === 'student') {
        this.accountForm.studentProfile.majorId = this.accountForm.studentProfile.majorId || this.majorOptionValues[0] || ''
        this.accountForm.studentProfile.adminClassId = this.accountForm.studentProfile.adminClassId || this.adminClassOptionValues[0] || ''
      }
      if (this.accountForm.roleCode === 'teacher') {
        this.accountForm.teacherProfile.departmentId = this.accountForm.teacherProfile.departmentId || this.departmentOptionValues[0] || ''
      }
    },
    changeAccountStatus(event) {
      const index = Number(event.detail.value)
      this.accountForm.status = this.userStatusOptions[index] ? this.userStatusOptions[index].value : 'active'
    },
    changeStudentMajor(event) {
      const index = Number(event.detail.value)
      this.accountForm.studentProfile.majorId = this.majorOptionValues[index] || ''
    },
    changeStudentAdminClass(event) {
      const index = Number(event.detail.value)
      this.accountForm.studentProfile.adminClassId = this.adminClassOptionValues[index] || ''
    },
    changeStudentStatus(event) {
      const index = Number(event.detail.value)
      this.accountForm.studentProfile.status = this.studentStatusOptions[index] ? this.studentStatusOptions[index].value : 'active'
    },
    changeTeacherDepartment(event) {
      const index = Number(event.detail.value)
      this.accountForm.teacherProfile.departmentId = this.departmentOptionValues[index] || ''
    },
    changeTeacherStatus(event) {
      const index = Number(event.detail.value)
      this.accountForm.teacherProfile.status = this.teacherStatusOptions[index] ? this.teacherStatusOptions[index].value : 'active'
    },
    toggleAccountForceChange(event) {
      this.accountForm.forceChangePassword = event.detail.value === true
    },
    changeCourseDepartment(event) {
      const index = Number(event.detail.value)
      this.courseForm.departmentId = this.departmentOptionValues[index] || ''
    },
    changeCourseSemester(event) {
      const index = Number(event.detail.value)
      this.courseForm.semesterId = this.semesterOptionValues[index] || ''
    },
    changeCourseStatus(event) {
      const index = Number(event.detail.value)
      this.courseForm.status = this.courseStatusOptions[index] ? this.courseStatusOptions[index].value : 'active'
    },
    changeCourseType(event) {
      const index = Number(event.detail.value)
      this.courseForm.courseType = this.courseTypeOptions[index] ? this.courseTypeOptions[index].value : 'major_required'
    },
    changeSelectionStatus(event) {
      const index = Number(event.detail.value)
      this.courseForm.selectionStatus = this.selectionStatusOptions[index] ? this.selectionStatusOptions[index].value : 'not_started'
    },
    changeCourseTeachers(event) {
      this.courseForm.teacherIds = event.detail.value || []
    },
    changeMaterialCourse(event) {
      const index = Number(event.detail.value)
      this.materialForm.courseOfferingId = this.courseOfferingValues[index] || ''
    },
    changeMaterialFileType(event) {
      const index = Number(event.detail.value)
      this.materialForm.fileType = this.fileTypes[index] || 'link'
    },
    toggleMaterialVisibility(event) {
      this.materialForm.isPublicToStudents = event.detail.value === true
    },
    async saveAccount() {
      if (!this.accountForm.username.trim() || !this.accountForm.displayName.trim()) {
        uni.showToast({ title: 'Username and display name are required.', icon: 'none' })
        return
      }
      if (!this.accountForm.userId && !this.accountForm.password.trim()) {
        uni.showToast({ title: 'Password is required for new accounts.', icon: 'none' })
        return
      }
      if (this.accountForm.roleCode === 'student') {
        if (!this.accountForm.studentProfile.studentNo.trim() || !this.accountForm.studentProfile.majorId || !String(this.accountForm.studentProfile.enrollmentYear || '').trim()) {
          uni.showToast({ title: 'Student profile is incomplete.', icon: 'none' })
          return
        }
      }
      if (this.accountForm.roleCode === 'teacher') {
        if (!this.accountForm.teacherProfile.teacherNo.trim() || !this.accountForm.teacherProfile.departmentId) {
          uni.showToast({ title: 'Teacher profile is incomplete.', icon: 'none' })
          return
        }
      }

      this.savingAccount = true
      const result = await callAiemsFunction('save-admin-account', {
        session: getSession(),
        userId: this.accountForm.userId,
        username: this.accountForm.username.trim(),
        displayName: this.accountForm.displayName.trim(),
        email: this.accountForm.email.trim(),
        phone: this.accountForm.phone.trim(),
        status: this.accountForm.status,
        roleCode: this.accountForm.roleCode,
        password: this.accountForm.password.trim(),
        forceChangePassword: this.accountForm.forceChangePassword,
        studentProfile: {
          ...this.accountForm.studentProfile,
          enrollmentYear: Number(this.accountForm.studentProfile.enrollmentYear || 0),
          majorId: this.accountForm.studentProfile.majorId,
          adminClassId: this.accountForm.studentProfile.adminClassId,
          trainingPlanId: this.accountForm.studentProfile.trainingPlanId.trim(),
          status: this.accountForm.studentProfile.status
        },
        teacherProfile: {
          ...this.accountForm.teacherProfile,
          researchFields: this.accountForm.teacherProfile.researchFields,
          title: this.accountForm.teacherProfile.title.trim(),
          office: this.accountForm.teacherProfile.office.trim(),
          teachingExperience: this.accountForm.teacherProfile.teachingExperience.trim(),
          departmentId: this.accountForm.teacherProfile.departmentId,
          status: this.accountForm.teacherProfile.status
        }
      })
      this.savingAccount = false

      if (result.ok) {
        uni.showToast({ title: this.accountForm.userId ? 'Updated' : 'Created', icon: 'success' })
        this.resetAccountForm(this.accountForm.roleCode)
        this.load(true)
        return
      }
      uni.showToast({ title: result.message || 'Save failed.', icon: 'none' })
    },
    async saveCourse() {
      if (!this.courseForm.courseCode.trim() || !this.courseForm.courseName.trim()) {
        uni.showToast({ title: 'Course code and name are required.', icon: 'none' })
        return
      }
      if (!this.courseForm.departmentId || !this.courseForm.semesterId || !this.courseForm.sectionNo.trim() || !this.courseForm.teacherIds.length || !String(this.courseForm.capacity || '').trim()) {
        uni.showToast({ title: 'Course details are incomplete.', icon: 'none' })
        return
      }

      this.savingCourse = true
      const result = await callAiemsFunction('save-admin-course', {
        session: getSession(),
        courseId: this.courseForm.courseId,
        courseOfferingId: this.courseForm.courseOfferingId,
        courseCode: this.courseForm.courseCode.trim(),
        courseName: this.courseForm.courseName.trim(),
        departmentId: this.courseForm.departmentId,
        description: this.courseForm.description.trim(),
        status: this.courseForm.status,
        credits: Number(this.courseForm.credits || 0),
        courseType: this.courseForm.courseType,
        difficultyLevel: Number(this.courseForm.difficultyLevel || 1),
        semesterId: this.courseForm.semesterId,
        sectionNo: this.courseForm.sectionNo.trim(),
        teacherIds: this.courseForm.teacherIds,
        capacity: Number(this.courseForm.capacity || 0),
        selectionStatus: this.courseForm.selectionStatus,
        syllabusUrl: this.courseForm.syllabusUrl.trim()
      })
      this.savingCourse = false

      if (result.ok) {
        uni.showToast({ title: this.courseForm.courseOfferingId ? 'Updated' : 'Created', icon: 'success' })
        this.resetCourseForm()
        this.load(true)
        return
      }
      uni.showToast({ title: result.message || 'Save failed.', icon: 'none' })
    },
    async saveMaterial() {
      if (!this.materialForm.courseOfferingId || !this.materialForm.title.trim() || !this.materialForm.fileUrl.trim()) {
        uni.showToast({ title: 'Course, title and file URL are required.', icon: 'none' })
        return
      }

      this.savingMaterial = true
      const result = await callAiemsFunction('save-course-material', {
        session: getSession(),
        materialId: this.materialForm.materialId,
        courseOfferingId: this.materialForm.courseOfferingId,
        title: this.materialForm.title.trim(),
        fileUrl: this.materialForm.fileUrl.trim(),
        fileType: this.materialForm.fileType,
        knowledgeDocumentId: this.materialForm.knowledgeDocumentId.trim(),
        isPublicToStudents: this.materialForm.isPublicToStudents
      })
      this.savingMaterial = false

      if (result.ok) {
        uni.showToast({ title: this.materialForm.materialId ? 'Updated' : 'Created', icon: 'success' })
        this.resetMaterialForm()
        this.load(true)
        return
      }
      uni.showToast({ title: result.message || 'Save failed.', icon: 'none' })
    },
    copyMaterialUrl(item) {
      if (!item.fileUrl) return
      uni.setClipboardData({
        data: item.fileUrl,
        success: () => uni.showToast({ title: 'Copied', icon: 'success' })
      })
    },
    formatTime(value) {
      const date = new Date(value)
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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

.stats-row {
  flex-wrap: wrap;
}

.tab-row {
  display: flex;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.tab-btn {
  flex: 1;
  min-width: 0;
  margin: 0;
  background: #e2e8f0;
  color: #475569;
  border-radius: 8rpx;
  font-size: 26rpx;
  line-height: 2.5;
}

.tab-btn-active {
  background: #2563eb;
  color: #ffffff;
  font-weight: 600;
}

.compact-btn {
  min-width: 140rpx;
  font-size: 24rpx;
}

.full-btn {
  width: 100%;
  margin-top: 10rpx;
}

.field {
  margin-bottom: 18rpx;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.picker-value {
  padding: 18rpx;
  background: #ffffff;
  border: 1rpx solid #cbd5e1;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.readonly-value {
  color: #64748b;
}

.subsection {
  margin-bottom: 20rpx;
  padding: 18rpx;
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
}

.subsection-title {
  display: block;
  margin-bottom: 14rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 22rpx;
}

.inline-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  align-items: center;
}

.checkbox-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.checkbox-pill {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 14rpx;
  background: #f8fafc;
  border: 1rpx solid #cbd5e1;
  border-radius: 999rpx;
  font-size: 24rpx;
}

.material-section {
  margin-top: 24rpx;
}

.refresh-btn {
  min-width: 150rpx;
}
</style>
