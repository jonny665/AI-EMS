<template>
  <view class="page">
    <view class="section">
      <view class="row">
        <view>
          <text class="section-title">Course Materials</text>
          <text class="muted">{{ session.displayName }} - {{ session.role }}</text>
        </view>
        <view class="btn-row top-actions">
          <button class="secondary-btn" :loading="loading" @click="refresh">Refresh</button>
          <button class="secondary-btn" @click="backHome">Home</button>
        </view>
      </view>
    </view>

    <view v-if="session.role !== 'student'" class="section">
      <text class="section-title">{{ form.materialId ? 'Edit Material' : 'Add Material' }}</text>

      <template v-if="!courses.length">
        <text class="muted">No manageable courses available.</text>
      </template>

      <template v-else>
        <view class="field">
          <text class="label">Course</text>
          <picker :range="courseLabels" :value="courseIndex" @change="changeCourse">
            <view class="picker-value">{{ selectedCourseLabel }}</view>
          </picker>
        </view>

        <view class="field">
          <text class="label">Title</text>
          <input v-model="form.title" placeholder="Material title" />
        </view>

        <view class="field">
          <text class="label">File URL</text>
          <input v-model="form.fileUrl" placeholder="https://..." />
        </view>

        <view class="field">
          <text class="label">File Type</text>
          <picker :range="fileTypes" :value="fileTypeIndex" @change="changeFileType">
            <view class="picker-value">{{ fileTypes[fileTypeIndex] }}</view>
          </picker>
        </view>

        <view class="field">
          <text class="label">Knowledge Document ID</text>
          <input v-model="form.knowledgeDocumentId" placeholder="Optional" />
        </view>

        <view class="switch-row">
          <view>
            <text class="label">Visible to Students</text>
            <text class="muted">Controls whether students can read this material later.</text>
          </view>
          <switch :checked="form.isPublicToStudents" @change="togglePublic" />
        </view>

        <view class="btn-row">
          <button class="primary-btn" :loading="saving" @click="saveMaterial">
            {{ form.materialId ? 'Update' : 'Create' }}
          </button>
          <button v-if="form.materialId" class="secondary-btn" @click="resetForm">Cancel Edit</button>
        </view>
      </template>
    </view>

    <view class="section">
      <text class="section-title">Uploaded Materials</text>
      <template v-if="!materials.length">
        <text class="muted">No course materials yet.</text>
      </template>

      <view v-for="item in materials" :key="item._id" class="card material-card">
        <view>
          <text class="value">{{ item.title }}</text>
          <text class="muted">{{ item.courseName || 'Course not found' }}</text>
          <text class="muted">{{ item.fileType || 'link' }} - {{ item.isPublicToStudents ? 'public' : 'private' }}</text>
          <text class="link-text">{{ item.fileUrl }}</text>
        </view>
        <view class="btn-row">
          <button class="secondary-btn" @click="copyUrl(item)">Copy URL</button>
          <button v-if="session.role !== 'student'" class="primary-btn" @click="editMaterial(item)">Edit</button>
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
      materials: [],
      courseIndex: 0,
      fileTypeIndex: 0,
      fileTypes: ['document', 'slide', 'video', 'link', 'other'],
      loading: false,
      saving: false,
      lastLoadedAt: 0,
      loadTtlMs: 30000,
      form: {
        materialId: '',
        title: '',
        fileUrl: '',
        knowledgeDocumentId: '',
        isPublicToStudents: true
      }
    }
  },
  computed: {
    courseLabels() {
      return this.courses.map(item => this.formatCourseLabel(item))
    },
    selectedCourseLabel() {
      return this.courseLabels[this.courseIndex] || 'No courses available'
    },
    selectedCourseOfferingId() {
      const course = this.courses[this.courseIndex]
      return course ? course.courseOfferingId : ''
    }
  },
  onShow() {
    const session = requireRole(['student', 'teacher', 'admin'])
    if (!session) return
    this.session = session
    const now = Date.now()
    if (!this.materials.length || now - this.lastLoadedAt > this.loadTtlMs) {
      this.load()
    }
  },
  methods: {
    emptyForm() {
      return {
        materialId: '',
        title: '',
        fileUrl: '',
        knowledgeDocumentId: '',
        isPublicToStudents: true
      }
    },
    async load(forceRefresh = false) {
      this.loading = true
      const result = await callAiemsFunction('get-course-materials', {
        session: getSession(),
        forceRefresh
      })
      this.loading = false
      if (!result.ok) {
        uni.showToast({ title: result.message || 'Failed to load materials.', icon: 'none' })
        return
      }

      this.courses = result.data.courses || []
      this.materials = result.data.materials || []
      this.lastLoadedAt = Date.now()
      if (this.courseIndex >= this.courses.length) {
        this.courseIndex = 0
      }
    },
    refresh() {
      this.load(true)
    },
    async saveMaterial() {
      const title = this.form.title.trim()
      const fileUrl = this.form.fileUrl.trim()
      if (!this.selectedCourseOfferingId || !title || !fileUrl) {
        uni.showToast({ title: 'Course, title and URL are required.', icon: 'none' })
        return
      }

      this.saving = true
      const result = await callAiemsFunction('save-course-material', {
        session: getSession(),
        materialId: this.form.materialId,
        courseOfferingId: this.selectedCourseOfferingId,
        title,
        fileUrl,
        fileType: this.fileTypes[this.fileTypeIndex] || 'link',
        isPublicToStudents: this.form.isPublicToStudents,
        knowledgeDocumentId: this.form.knowledgeDocumentId.trim()
      })
      this.saving = false

      if (result.ok) {
        uni.showToast({ title: this.form.materialId ? 'Updated' : 'Created', icon: 'success' })
        this.resetForm()
        this.load(true)
        return
      }

      uni.showToast({ title: result.message || 'Save failed.', icon: 'none' })
    },
    editMaterial(item) {
      const courseIndex = this.courses.findIndex(course => course.courseOfferingId === item.courseOfferingId)
      const fileTypeIndex = this.fileTypes.indexOf(item.fileType || 'link')
      this.courseIndex = courseIndex >= 0 ? courseIndex : 0
      this.fileTypeIndex = fileTypeIndex >= 0 ? fileTypeIndex : this.fileTypes.indexOf('link')
      this.form = {
        materialId: item._id,
        title: item.title || '',
        fileUrl: item.fileUrl || '',
        knowledgeDocumentId: item.knowledgeDocumentId || '',
        isPublicToStudents: item.isPublicToStudents === true
      }
    },
    resetForm() {
      this.form = this.emptyForm()
      this.fileTypeIndex = this.fileTypes.indexOf('link')
    },
    changeCourse(event) {
      this.courseIndex = Number(event.detail.value)
    },
    changeFileType(event) {
      this.fileTypeIndex = Number(event.detail.value)
    },
    togglePublic(event) {
      this.form.isPublicToStudents = event.detail.value === true
    },
    copyUrl(item) {
      if (!item.fileUrl) return
      uni.setClipboardData({
        data: item.fileUrl,
        success: () => uni.showToast({ title: 'Copied', icon: 'success' })
      })
    },
    formatCourseLabel(course) {
      return [course.code, course.name, course.sectionNo].filter(Boolean).join(' ').trim() || 'Unnamed course'
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

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 22rpx;
}

.material-card {
  gap: 18rpx;
}

.link-text {
  display: block;
  margin-top: 10rpx;
  color: #2563eb;
  font-size: 24rpx;
  line-height: 1.5;
  word-break: break-all;
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.primary-btn,
.secondary-btn {
  min-width: 160rpx;
  margin: 0;
}

.top-actions {
  margin-top: 0;
}
</style>
