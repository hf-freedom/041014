<template>
  <div class="my-reservations">
    <div class="section-header">
      <h2>我的预定</h2>
    </div>

    <!-- 筛选标签 -->
    <div class="filter-tabs">
      <button 
        :class="['filter-tab', { active: currentFilter === 'all' }]"
        @click="currentFilter = 'all'"
      >
        全部
      </button>
      <button 
        :class="['filter-tab', { active: currentFilter === 'pending' }]"
        @click="currentFilter = 'pending'"
      >
        待审批
      </button>
      <button 
        :class="['filter-tab', { active: currentFilter === 'approved' }]"
        @click="currentFilter = 'approved'"
      >
        已通过
      </button>
      <button 
        :class="['filter-tab', { active: currentFilter === 'rejected' }]"
        @click="currentFilter = 'rejected'"
      >
        已驳回
      </button>
      <button 
        :class="['filter-tab', { active: currentFilter === 'cancelled' }]"
        @click="currentFilter = 'cancelled'"
      >
        已取消
      </button>
    </div>

    <div v-if="filteredReservations.length === 0" class="empty-state">
      <p>暂无预定记录</p>
    </div>

    <div v-else class="reservation-list">
      <div 
        v-for="reservation in filteredReservations" 
        :key="reservation.id" 
        :class="['reservation-card', reservation.status]"
      >
        <div class="reservation-info">
          <h3>{{ reservation.title }}</h3>
          <p class="room-name">{{ getRoomName(reservation.roomId) }}</p>
          <p class="time-info">
            <span class="date">{{ reservation.date }}</span>
            <span class="time">{{ reservation.startTime }} - {{ reservation.endTime }}</span>
          </p>
          <div class="status-row">
            <span :class="['status-badge', reservation.status]">
              {{ getStatusText(reservation.status) }}
            </span>
            <span v-if="isPast(reservation)" class="past-badge">已结束</span>
          </div>
          <p v-if="reservation.rejectReason" class="reject-reason">
            驳回原因：{{ reservation.rejectReason }}
          </p>
        </div>
        <div class="reservation-actions">
          <button 
            v-if="reservation.status === 'pending' || reservation.status === 'approved'"
            class="btn btn-small btn-danger" 
            @click="handleCancel(reservation)"
          >
            取消预定
          </button>
          <span v-else-if="reservation.status === 'cancelled'" class="action-text">
            已取消
          </span>
          <span v-else-if="reservation.status === 'rejected'" class="action-text">
            已驳回
          </span>
          <span v-else class="action-text">
            {{ reservation.status }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStore } from '../stores'
import { storeToRefs } from 'pinia'
import type { Reservation, ReservationStatus } from '../types'

const store = useStore()
const { currentUser, rooms } = storeToRefs(store)

const currentFilter = ref<ReservationStatus | 'all'>('all')

const myReservations = computed(() => {
  return store.getReservationsByUser(currentUser.value.id)
})

const filteredReservations = computed(() => {
  if (currentFilter.value === 'all') {
    return myReservations.value
  }
  return myReservations.value.filter(r => r.status === currentFilter.value)
})

const getRoomName = (roomId: string) => {
  return rooms.value.find(r => r.id === roomId)?.name || '未知会议室'
}

const getStatusText = (status: ReservationStatus) => {
  const statusMap: Record<ReservationStatus, string> = {
    pending: '待审批',
    approved: '已通过',
    rejected: '已驳回',
    cancelled: '已取消'
  }
  return statusMap[status]
}

const isPast = (reservation: Reservation) => {
  // 比较日期字符串，避免时区问题
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const nowTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`
  
  // 如果日期在今天之前，已结束
  if (reservation.date < todayStr) return true
  // 如果日期在今天之后，未结束
  if (reservation.date > todayStr) return false
  // 如果是今天，比较时间
  return reservation.endTime <= nowTime
}

// 是否可以取消：待审批、已通过且未结束
const canCancel = (reservation: Reservation) => {
  if (isPast(reservation)) return false
  return reservation.status === 'pending' || reservation.status === 'approved'
}

const handleCancel = (reservation: Reservation) => {
  const statusText = reservation.status === 'pending' ? '待审批' : '已通过'
  if (confirm(`确定要取消这个${statusText}的预定吗？\n\n会议：${reservation.title}\n时间：${reservation.date} ${reservation.startTime}-${reservation.endTime}`)) {
    store.cancelReservation(reservation.id)
    alert('预定已取消')
  }
}
</script>

<style scoped>
.my-reservations {
  padding: 20px;
}

.section-header {
  margin-bottom: 20px;
}

.section-header h2 {
  font-size: 20px;
  color: #303133;
}

/* 筛选标签 */
.filter-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-tab {
  padding: 8px 16px;
  border: 1px solid #dcdfe6;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.filter-tab:hover {
  border-color: #409eff;
  color: #409eff;
}

.filter-tab.active {
  background: #409eff;
  color: white;
  border-color: #409eff;
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
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.reservation-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border-left: 4px solid #409eff;
}

.reservation-card.pending {
  border-left-color: #e6a23c;
}

.reservation-card.approved {
  border-left-color: #67c23a;
}

.reservation-card.rejected {
  border-left-color: #f56c6c;
}

.reservation-card.cancelled {
  border-left-color: #909399;
  opacity: 0.8;
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

.reservation-info .time-info {
  display: flex;
  gap: 12px;
  font-size: 14px;
  color: #606266;
  margin-bottom: 12px;
}

.reservation-info .date {
  background: #f5f7fa;
  padding: 2px 8px;
  border-radius: 4px;
}

.status-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.pending {
  background: #fdf6ec;
  color: #e6a23c;
}

.status-badge.approved {
  background: #f0f9eb;
  color: #67c23a;
}

.status-badge.rejected {
  background: #fef0f0;
  color: #f56c6c;
}

.status-badge.cancelled {
  background: #f4f4f5;
  color: #909399;
}

.past-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background: #f4f4f5;
  color: #909399;
}

.reject-reason {
  font-size: 13px;
  color: #f56c6c;
  margin-top: 8px;
  padding: 8px;
  background: #fef0f0;
  border-radius: 4px;
}

.reservation-actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.action-text {
  color: #909399;
  font-size: 14px;
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
