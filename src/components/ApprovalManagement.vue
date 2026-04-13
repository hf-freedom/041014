<template>
  <div class="approval-management">
    <div class="section-header">
      <h2>审批管理</h2>
      <span class="pending-count" v-if="pendingReservations.length > 0">
        待审批: {{ pendingReservations.length }}
      </span>
    </div>

    <div v-if="pendingReservations.length === 0" class="empty-state">
      <p>暂无待审批的预定</p>
    </div>

    <div v-else class="reservation-list">
      <div v-for="reservation in pendingReservations" :key="reservation.id" class="reservation-card">
        <div class="reservation-info">
          <h3>{{ reservation.title }}</h3>
          <p class="room-name">{{ getRoomName(reservation.roomId) }}</p>
          <p class="user-info">
            <span class="label">申请人：</span>
            <span class="value">{{ getUserName(reservation.userId) }}</span>
          </p>
          <p class="time-info">
            <span class="date">{{ reservation.date }}</span>
            <span class="time">{{ reservation.startTime }} - {{ reservation.endTime }}</span>
          </p>
          <p class="create-time">
            <span class="label">申请时间：</span>
            <span class="value">{{ formatDateTime(reservation.createdAt) }}</span>
          </p>
          <span class="status-badge pending">待审批</span>
        </div>
        <div class="reservation-actions">
          <button class="btn btn-small btn-success" @click="approve(reservation)">
            通过
          </button>
          <button class="btn btn-small btn-danger" @click="openRejectModal(reservation)">
            驳回
          </button>
        </div>
      </div>
    </div>

    <!-- 驳回弹窗 -->
    <div v-if="showRejectModal" class="modal-overlay" @click.self="closeRejectModal">
      <div class="modal" style="min-width: 400px">
        <div class="modal-header">
          <h3>驳回预定</h3>
          <button class="modal-close" @click="closeRejectModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>驳回原因</label>
            <textarea 
              v-model="rejectReason" 
              rows="3" 
              placeholder="请输入驳回原因（可选）"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="closeRejectModal">取消</button>
          <button class="btn btn-danger" @click="confirmReject">确认驳回</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useStore } from '../stores'
import { storeToRefs } from 'pinia'
import type { Reservation } from '../types'

const store = useStore()
const { pendingReservations, rooms, users } = storeToRefs(store)

const showRejectModal = ref(false)
const rejectReason = ref('')
const currentReservation = ref<Reservation | null>(null)

const getRoomName = (roomId: string) => {
  return rooms.value.find(r => r.id === roomId)?.name || '未知会议室'
}

const getUserName = (userId: string) => {
  return users.value.find(u => u.id === userId)?.name || '未知用户'
}

const formatDateTime = (isoString: string) => {
  const date = new Date(isoString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const approve = (reservation: Reservation) => {
  if (confirm(`确定要通过"${reservation.title}"的预定申请吗？`)) {
    store.approveReservation(reservation.id)
    alert('已通过该预定申请')
  }
}

const openRejectModal = (reservation: Reservation) => {
  currentReservation.value = reservation
  rejectReason.value = ''
  showRejectModal.value = true
}

const closeRejectModal = () => {
  showRejectModal.value = false
  currentReservation.value = null
  rejectReason.value = ''
}

const confirmReject = () => {
  if (currentReservation.value) {
    store.rejectReservation(currentReservation.value.id, rejectReason.value)
    closeRejectModal()
    alert('已驳回该预定申请')
  }
}
</script>

<style scoped>
.approval-management {
  padding: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-header h2 {
  font-size: 20px;
  color: #303133;
}

.pending-count {
  background: #f56c6c;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #909399;
  background: white;
  border-radius: 8px;
}

.reservation-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.reservation-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border-left: 4px solid #e6a23c;
}

.reservation-info h3 {
  font-size: 16px;
  color: #303133;
  margin-bottom: 8px;
}

.reservation-info .room-name {
  color: #409eff;
  font-size: 14px;
  margin-bottom: 8px;
}

.reservation-info .user-info,
.reservation-info .time-info,
.reservation-info .create-time {
  font-size: 14px;
  color: #606266;
  margin-bottom: 6px;
}

.reservation-info .label {
  color: #909399;
}

.reservation-info .time-info {
  display: flex;
  gap: 12px;
}

.reservation-info .date {
  background: #f5f7fa;
  padding: 2px 8px;
  border-radius: 4px;
}

.reservation-info .time {
  color: #409eff;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  margin-top: 8px;
}

.status-badge.pending {
  background: #fdf6ec;
  color: #e6a23c;
}

.reservation-actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 12px;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  min-width: 300px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  font-size: 16px;
  color: #303133;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #909399;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #eee;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #606266;
}

.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  resize: vertical;
}

.form-group textarea:focus {
  outline: none;
  border-color: #409eff;
}

/* 按钮样式 */
.btn {
  padding: 8px 16px;
  border: 1px solid #dcdfe6;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.btn:hover {
  border-color: #c6e2ff;
  color: #409eff;
}

.btn-primary {
  background: #409eff;
  color: white;
  border-color: #409eff;
}

.btn-primary:hover {
  background: #66b1ff;
  border-color: #66b1ff;
  color: white;
}

.btn-success {
  background: #67c23a;
  color: white;
  border-color: #67c23a;
}

.btn-success:hover {
  background: #85ce61;
  border-color: #85ce61;
}

.btn-danger {
  background: #f56c6c;
  color: white;
  border-color: #f56c6c;
}

.btn-danger:hover {
  background: #f78989;
  border-color: #f78989;
}

.btn-small {
  padding: 6px 12px;
  font-size: 13px;
}
</style>
