<script>
export default {
  onLaunch() {
    console.log('AI-EMS launch')
  },
  onShow() {
    console.log('AI-EMS show')
  },
  onHide() {
    console.log('AI-EMS hide')
  }
}
</script>

<style>
page {
  min-height: 100%;
  background: #f4f6f9;
  color: #1f2937;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.page {
  padding: 28rpx;
}

.section {
  margin-bottom: 24rpx;
  padding: 24rpx;
  background: #ffffff;
  border: 1rpx solid #e5e7eb;
  border-radius: 8rpx;
}

.section-title {
  display: block;
  margin-bottom: 14rpx;
  color: #0f172a;
  font-size: 32rpx;
  font-weight: 700;
}

.muted {
  color: #64748b;
  font-size: 24rpx;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 18rpx;
}

.primary-btn,
.secondary-btn,
.danger-btn {
  min-width: 180rpx;
  margin: 0;
  border-radius: 8rpx;
  font-size: 26rpx;
  line-height: 2.5;
}

.primary-btn {
  background: #2563eb;
  color: #ffffff;
}

.secondary-btn {
  background: #e2e8f0;
  color: #0f172a;
}

.danger-btn {
  background: #fee2e2;
  color: #991b1b;
}

.card {
  margin-top: 16rpx;
  padding: 18rpx;
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
}

.label {
  color: #334155;
  font-size: 24rpx;
  font-weight: 600;
}

.value {
  color: #111827;
  font-size: 28rpx;
}

input,
textarea,
picker {
  box-sizing: border-box;
  width: 100%;
  margin-top: 10rpx;
  padding: 18rpx;
  background: #ffffff;
  border: 1rpx solid #cbd5e1;
  border-radius: 8rpx;
  font-size: 28rpx;
}

textarea {
  min-height: 160rpx;
}
</style>
