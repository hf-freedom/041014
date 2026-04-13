<template>
  <div class="calendar-view">
    <div class="section-header">
      <h2>会议室预定</h2>
      <p class="subtitle" v-if="!isAdmin">普通用户预定需等待管理员审批</p>
      <p class="subtitle admin" v-else>管理员预定自动通过，无需审批</p>
    </div>

    <div class="controls">
      <div class="control-group">
        <label>选择会议室：</label>
        <select v-model="selectedRoomId">
          <option v-for="room in availableRooms" :key="room.id" :value="room.id">
            {{ room.name }} ({{ room.location }})
          </option>
        </select>
      </div>
      <div class="control-group">
        <label>选择日期：</label>
        <input type="date" v-model="selectedDate" :min="minDate" />
      </div>
    </div>

    <div v-if="currentRoom" class="calendar-container">
      <div class="room-info-bar">
        <span class="room-name">{{ currentRoom.name }}</span>
        <span class="room-time">开放时间：{{ currentRoom.openTimeStart }} - {{ currentRoom.openTimeEnd }}</span>
      </div>

      <div class="time-grid">
        <div class="time-labels">
          <div v-for="hour in hours" :key="hour" class="time-label">
            {{ hour.toString().padStart(2, '0') }}:00
          </div>
        </div>
        <div class="time-slots">
          <div
            v-for="slot in timeSlots"
            :key="slot.time"
            :class="['time-slot', { 
              disabled: slot.disabled, 
              reserved: slot.reservation?.status === 'approved',
              pending: slot.reservation?.status === 'pending',
              'my-reservation': slot.reservation?.userId === currentUser.id
            }]"
            @click="handleSlotClick(slot)"
          >
            <span v-if="slot.reservation" class="reservation-info">
              <span class="reservation-title">{{ slot.reservation.title }}</span>
              <span class="reservation-user">{{ getUserName(slot.reservation.userId) }}</span>
              <span v-if="slot.reservation.status === 'pending'" class="reservation-status">待审批</span>
            </span>
            <span v-else-if="!slot.disabled" class="slot-time">{{ slot.time }}</span>
          </div>
        </div>
      </div>

      <div class="legend">
        <div class="legend-item">
          <span class="legend-color available"></span>
          <span>可预定</span>
        </div>
        <div class="legend-item">
          <span class="legend-color reserved"></span>
          <span>已被预定</span>
        </div>
        <div class="legend-item">
          <span class="legend-color pending"></span>
          <span>审批中</span>
        </div>
        <div class="legend-item">
          <span class="legend-color my-reservation"></span>
          <span>我的预定</span>
        </div>
        <div class="legend-item">
          <span class="legend-color disabled"></span>
          <span>非开放时间</span>
        </div>
      </div>
    </div>

    <!-- 预定弹窗 -->
    <div v-if="showReserveModal" class="modal-overlay" @click.self="closeReserveModal">
      <div class="modal">
        <div class="modal-header">
          <h3>预定会议室</h3>
          <button class="modal-close" @click="closeReserveModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>会议主题</label>
            <input v-model="reserveForm.title" type="text" placeholder="请输入会议主题" />
          </div>
          <div class="form-group">
            <label>开始时间</label>
            <select v-model="reserveForm.startTime">
              <option v-for="time in availableStartTimes" :key="time" :value="time">
                {{ time }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>结束时间</label>
            <select v-model="reserveForm.endTime">
              <option v-for="time in availableEndTimes" :key="time" :value="time">
                {{ time }}
              </option>
            </select>
          </div>

          <!-- 周期性预定选项 -->
          <div class="form-group recurring-section">
            <label class="checkbox-label">
              <input type="checkbox" v-model="reserveForm.isRecurring" />
              <span>周期性预定</span>
            </label>
          </div>

          <div v-if="reserveForm.isRecurring" class="recurring-options">
            <div class="form-group">
              <label>重复类型</label>
              <select v-model="reserveForm.recurringType">
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
                <option value="custom">自定义间隔</option>
              </select>
            </div>

            <div v-if="reserveForm.recurringType === 'weekly'" class="form-group">
              <label>选择星期</label>
              <div class="weekday-selector">
                <label v-for="day in weekdays" :key="day.value" class="weekday-checkbox">
                  <input 
                    type="checkbox" 
                    :value="day.value"
                    :checked="reserveForm.weekdays.includes(day.value)"
                    @change="toggleWeekday(day.value)"
                  />
                  <span>{{ day.label }}</span>
                </label>
              </div>
            </div>

            <div v-if="reserveForm.recurringType === 'custom'" class="form-group">
              <label>间隔天数</label>
              <input type="number" v-model.number="reserveForm.customInterval" min="1" max="30" />
            </div>

            <div class="form-group">
              <label>重复结束日期</label>
              <input type="date" v-model="reserveForm.recurringEndDate" :min="selectedDate" />
            </div>
          </div>

          <!-- 冲突提示和候补选项 -->
          <div v-if="hasConflict" class="conflict-warning">
            <span class="warning-icon">⚠️</span>
            <span>该时间段已被预定，您可以选择加入候补队列</span>
          </div>

          <p class="form-tip" v-if="!isAdmin">
            <span class="tip-icon">ℹ️</span>
            提交后需等待管理员审批
          </p>
          <p class="form-tip admin" v-else>
            <span class="tip-icon">✓</span>
            管理员预定自动通过
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="closeReserveModal">取消</button>
          <button v-if="hasConflict" class="btn btn-warning" @click="confirmJoinWaitlist">加入候补队列</button>
          <button v-else class="btn btn-primary" @click="confirmReserve">确认预定</button>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="showDetailModal" class="modal-overlay" @click.self="closeDetailModal">
      <div class="modal" style="min-width: 350px">
        <div class="modal-header">
          <h3>预定详情</h3>
          <button class="modal-close" @click="closeDetailModal">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-item">
            <span class="detail-label">会议主题：</span>
            <span>{{ selectedReservation?.title }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">预定人：</span>
            <span>{{ getUserName(selectedReservation?.userId || '') }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">时间：</span>
            <span>{{ selectedReservation?.startTime }} - {{ selectedReservation?.endTime }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">状态：</span>
            <span :class="['status-text', selectedReservation?.status]">
              {{ getStatusText(selectedReservation?.status) }}
            </span>
          </div>
          
          <!-- 加入候补输入框 -->
          <div v-if="showWaitlistInput && !isInWaitlist" class="waitlist-input-section">
            <div class="form-group">
              <label>会议主题</label>
              <input v-model="waitlistForm.title" type="text" placeholder="请输入会议主题" />
            </div>
          </div>
          
          <div v-if="!isOwnReservation && !isInWaitlist && !showWaitlistInput" class="waitlist-hint">
            <span class="hint-icon">💡</span>
            <span>该时段已被预定，您可以加入候补队列</span>
          </div>
          <div v-if="isInWaitlist" class="waitlist-hint success">
            <span class="hint-icon">✓</span>
            <span>您已在该时段的候补队列中</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="closeDetailModal">关闭</button>
          <button 
            v-if="selectedReservation && (selectedReservation.status === 'approved' || selectedReservation.status === 'pending') && !isOwnReservation && !isInWaitlist && !showWaitlistInput"
            class="btn btn-warning" 
            @click="showWaitlistInput = true"
          >
            加入候补队列
          </button>
          <button 
            v-if="showWaitlistInput"
            class="btn" 
            @click="cancelWaitlistInput"
          >
            取消
          </button>
          <button 
            v-if="showWaitlistInput"
            class="btn btn-warning" 
            @click="confirmJoinWaitlist"
          >
            确认加入
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useStore } from '../stores'
import { storeToRefs } from 'pinia'
import type { Reservation, ReservationStatus, RecurringType } from '../types'

const store = useStore()
const { availableRooms, currentUser, isAdmin, users } = storeToRefs(store)

const selectedRoomId = ref('')
const selectedDate = ref(formatDate(new Date()))
const showReserveModal = ref(false)
const showDetailModal = ref(false)
const selectedReservation = ref<Reservation | null>(null)
const clickStartTime = ref('')
const showWaitlistInput = ref(false)

const waitlistForm = ref({
  title: ''
})

const weekdays = [
  { value: 0, label: '日' },
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
]

const reserveForm = ref({
  title: '',
  startTime: '',
  endTime: '',
  isRecurring: false,
  recurringType: 'weekly' as RecurringType,
  weekdays: [1, 2, 3, 4, 5] as number[],
  customInterval: 1,
  recurringEndDate: '',
})

const minDate = formatDate(new Date())

// 检查是否有时间冲突
const hasConflict = computed(() => {
  if (!reserveForm.value.startTime || !reserveForm.value.endTime) return false
  return store.checkTimeConflict(selectedRoomId.value, selectedDate.value, reserveForm.value.startTime, reserveForm.value.endTime)
})

// 检查详情中的预定是否是当前用户自己的
const isOwnReservation = computed(() => {
  if (!selectedReservation.value) return true
  return selectedReservation.value.userId === currentUser.value.id
})

// 检查当前用户是否已在该时段的候补队列中
const isInWaitlist = computed(() => {
  if (!selectedReservation.value) return false
  return store.isUserInWaitlist(
    currentUser.value.id,
    selectedReservation.value.roomId,
    selectedReservation.value.date,
    selectedReservation.value.startTime,
    selectedReservation.value.endTime
  )
})

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

watch(availableRooms, (rooms) => {
  if (rooms.length > 0 && !selectedRoomId.value) {
    selectedRoomId.value = rooms[0].id
  }
}, { immediate: true })

const currentRoom = computed(() => {
  return availableRooms.value.find(r => r.id === selectedRoomId.value)
})

const hours = computed(() => {
  if (!currentRoom.value) return []
  const start = parseInt(currentRoom.value.openTimeStart.split(':')[0])
  const end = parseInt(currentRoom.value.openTimeEnd.split(':')[0])
  return Array.from({ length: end - start }, (_, i) => start + i)
})

const timeSlots = computed(() => {
  if (!currentRoom.value) return []
  
  const slots: { time: string; disabled: boolean; reservation: Reservation | null }[] = []
  const [startHour, startMin] = currentRoom.value.openTimeStart.split(':').map(Number)
  const [endHour, endMin] = currentRoom.value.openTimeEnd.split(':').map(Number)
  
  // 获取已批准的预定和待审批的预定
  const reservations = store.getActiveReservationsByRoomAndDate(selectedRoomId.value, selectedDate.value)
  
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === endHour - 1 && m >= endMin) break
      if (h === startHour && m < startMin) continue
      
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
      
      const reservation = reservations.find(r => {
        return time >= r.startTime && time < r.endTime
      })
      
      slots.push({
        time,
        disabled: false,
        reservation: reservation || null,
      })
    }
  }
  
  return slots
})

const availableStartTimes = computed(() => {
  if (!currentRoom.value) return []
  const times: string[] = []
  const [startHour] = currentRoom.value.openTimeStart.split(':').map(Number)
  const [endHour, endMin] = currentRoom.value.openTimeEnd.split(':').map(Number)
  
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === endHour - 1 && m >= endMin - 30) break
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
      if (!store.checkTimeConflict(selectedRoomId.value, selectedDate.value, time, time)) {
        times.push(time)
      }
    }
  }
  return times
})

const availableEndTimes = computed(() => {
  if (!currentRoom.value || !reserveForm.value.startTime) return []
  const times: string[] = []
  const [startH, startM] = reserveForm.value.startTime.split(':').map(Number)
  const [endHour, endMin] = currentRoom.value.openTimeEnd.split(':').map(Number)
  
  for (let h = startH; h <= endHour; h++) {
    const startMForHour = h === startH ? startM + 30 : 0
    for (let m = startMForHour; m < 60; m += 30) {
      if (h === endHour && m > endMin) break
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
      times.push(time)
    }
  }
  return times
})

const getUserName = (userId: string) => {
  return users.value.find(u => u.id === userId)?.name || '未知用户'
}

const getStatusText = (status?: ReservationStatus) => {
  const statusMap: Record<ReservationStatus, string> = {
    pending: '待审批',
    approved: '已通过',
    rejected: '已驳回',
    cancelled: '已取消'
  }
  return status ? statusMap[status] : ''
}

const toggleWeekday = (dayValue: number) => {
  const index = reserveForm.value.weekdays.indexOf(dayValue)
  if (index > -1) {
    reserveForm.value.weekdays.splice(index, 1)
  } else {
    reserveForm.value.weekdays.push(dayValue)
  }
}

const handleSlotClick = (slot: { time: string; disabled: boolean; reservation: Reservation | null }) => {
  if (slot.disabled) return
  
  if (slot.reservation) {
    selectedReservation.value = slot.reservation
    showDetailModal.value = true
  } else {
    clickStartTime.value = slot.time
    // 计算一个月后的默认结束日期
    const defaultEndDate = new Date()
    defaultEndDate.setMonth(defaultEndDate.getMonth() + 1)
    
    reserveForm.value = {
      title: '',
      startTime: slot.time,
      endTime: '',
      isRecurring: false,
      recurringType: 'weekly',
      weekdays: [1, 2, 3, 4, 5],
      customInterval: 1,
      recurringEndDate: formatDate(defaultEndDate),
    }
    showReserveModal.value = true
  }
}

const closeReserveModal = () => {
  showReserveModal.value = false
  reserveForm.value = { 
    title: '', 
    startTime: '', 
    endTime: '',
    isRecurring: false,
    recurringType: 'weekly',
    weekdays: [1, 2, 3, 4, 5],
    customInterval: 1,
    recurringEndDate: '',
  }
}

const confirmReserve = () => {
  if (!reserveForm.value.title.trim()) {
    alert('请输入会议主题')
    return
  }
  if (!reserveForm.value.startTime || !reserveForm.value.endTime) {
    alert('请选择时间')
    return
  }
  if (reserveForm.value.endTime <= reserveForm.value.startTime) {
    alert('结束时间必须晚于开始时间')
    return
  }
  
  // 周期性预定
  if (reserveForm.value.isRecurring) {
    if (!reserveForm.value.recurringEndDate) {
      alert('请选择重复结束日期')
      return
    }
    if (reserveForm.value.recurringType === 'weekly' && reserveForm.value.weekdays.length === 0) {
      alert('请至少选择一个星期')
      return
    }
    
    const pattern = {
      type: reserveForm.value.recurringType,
      weekdays: reserveForm.value.weekdays,
      interval: reserveForm.value.customInterval,
      endDate: reserveForm.value.recurringEndDate
    }
    
    const baseReservation = {
      roomId: selectedRoomId.value,
      userId: currentUser.value.id,
      startTime: reserveForm.value.startTime,
      endTime: reserveForm.value.endTime,
      title: reserveForm.value.title,
    }
    
    const created = store.addRecurringReservation(baseReservation, pattern, selectedDate.value)
    
    closeReserveModal()
    
    if (isAdmin.value) {
      alert(`周期性预定成功！共生成 ${created.length} 个预定，管理员预定已自动通过。`)
    } else {
      alert(`周期性预定申请已提交，共生成 ${created.length} 个预定，请等待管理员审批。`)
    }
  } else {
    // 普通预定
    if (store.checkTimeConflict(selectedRoomId.value, selectedDate.value, reserveForm.value.startTime, reserveForm.value.endTime)) {
      alert('该时间段已被预定')
      return
    }
    
    store.addReservation({
      roomId: selectedRoomId.value,
      userId: currentUser.value.id,
      date: selectedDate.value,
      startTime: reserveForm.value.startTime,
      endTime: reserveForm.value.endTime,
      title: reserveForm.value.title,
    })
    
    closeReserveModal()
    
    if (isAdmin.value) {
      alert('预定成功！管理员预定已自动通过。')
    } else {
      alert('预定申请已提交，请等待管理员审批。')
    }
  }
}

// 加入候补队列
const confirmJoinWaitlist = () => {
  if (!reserveForm.value.title.trim()) {
    alert('请输入会议主题')
    return
  }
  if (!reserveForm.value.startTime || !reserveForm.value.endTime) {
    alert('请选择时间')
    return
  }
  
  // 检查是否已在队列中
  if (store.isUserInWaitlist(currentUser.value.id, selectedRoomId.value, selectedDate.value, reserveForm.value.startTime, reserveForm.value.endTime)) {
    alert('您已在该时段的候补队列中')
    return
  }
  
  const queue = store.getWaitlistBySlot(selectedRoomId.value, selectedDate.value, reserveForm.value.startTime, reserveForm.value.endTime)
  
  store.addToWaitlist({
    roomId: selectedRoomId.value,
    userId: currentUser.value.id,
    date: selectedDate.value,
    startTime: reserveForm.value.startTime,
    endTime: reserveForm.value.endTime,
    title: reserveForm.value.title,
  })
  
  closeReserveModal()
  
  alert(`已加入候补队列！当前排位：第 ${queue.length + 1} 位\n有人取消预定后将自动为您分配。`)
}

// 关闭详情弹窗
const closeDetailModal = () => {
  showDetailModal.value = false
  showWaitlistInput.value = false
  waitlistForm.value.title = ''
}

// 取消候补输入
const cancelWaitlistInput = () => {
  showWaitlistInput.value = false
  waitlistForm.value.title = ''
}

// 确认加入候补队列
const confirmJoinWaitlist = () => {
  if (!selectedReservation.value) return
  
  if (!waitlistForm.value.title.trim()) {
    alert('请输入会议主题')
    return
  }
  
  const queue = store.getWaitlistBySlot(
    selectedReservation.value.roomId,
    selectedReservation.value.date,
    selectedReservation.value.startTime,
    selectedReservation.value.endTime
  )
  
  store.addToWaitlist({
    roomId: selectedReservation.value.roomId,
    userId: currentUser.value.id,
    date: selectedReservation.value.date,
    startTime: selectedReservation.value.startTime,
    endTime: selectedReservation.value.endTime,
    title: waitlistForm.value.title.trim(),
  })
  
  closeDetailModal()
  
  alert(`已加入候补队列！当前排位：第 ${queue.length + 1} 位\n有人取消预定后将自动为您分配。\n\n您可以在"我的预定→候补中"查看。`)
}</script>

<style scoped>
.calendar-view {
  padding: 20px;
}

.section-header {
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 20px;
  color: #303133;
  margin-bottom: 4px;
}

.subtitle {
  font-size: 13px;
  color: #e6a23c;
}

.subtitle.admin {
  color: #67c23a;
}

.controls {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.control-group label {
  font-weight: 500;
  color: #606266;
}

.control-group select,
.control-group input {
  min-width: 200px;
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
}

.control-group select:focus,
.control-group input:focus {
  outline: none;
  border-color: #409eff;
}

.calendar-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.room-info-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f5f7fa;
  border-bottom: 1px solid #eee;
}

.room-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.room-time {
  font-size: 14px;
  color: #909399;
}

.time-grid {
  display: flex;
  min-height: 400px;
}

.time-labels {
  width: 80px;
  background: #fafafa;
  border-right: 1px solid #eee;
}

.time-label {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #606266;
  border-bottom: 1px solid #f0f0f0;
}

.time-slots {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.time-slot {
  height: 60px;
  border-bottom: 1px solid #f0f0f0;
  border-right: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.time-slot:hover:not(.disabled):not(.reserved):not(.pending) {
  background: #ecf5ff;
}

.time-slot.disabled {
  background: #f5f7fa;
  cursor: not-allowed;
}

.time-slot.reserved {
  background: #fef0f0;
  cursor: pointer;
}

.time-slot.pending {
  background: #fdf6ec;
  cursor: pointer;
}

.time-slot.my-reservation {
  border: 2px solid #409eff;
}

.slot-time {
  font-size: 13px;
  color: #606266;
}

.reservation-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px;
}

.reservation-title {
  font-size: 12px;
  font-weight: 500;
  color: #303133;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.reservation-user {
  font-size: 11px;
  color: #606266;
}

.reservation-status {
  font-size: 10px;
  color: #e6a23c;
  background: #fff;
  padding: 2px 6px;
  border-radius: 4px;
}

.legend {
  display: flex;
  gap: 24px;
  padding: 16px 20px;
  background: #fafafa;
  border-top: 1px solid #eee;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}

.legend-color {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.legend-color.available {
  background: white;
}

.legend-color.reserved {
  background: #fef0f0;
}

.legend-color.pending {
  background: #fdf6ec;
}

.legend-color.my-reservation {
  background: white;
  border: 2px solid #409eff;
}

.legend-color.disabled {
  background: #f5f7fa;
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
  min-width: 400px;
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

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #409eff;
}

.form-tip {
  margin-top: 12px;
  padding: 10px 12px;
  background: #fdf6ec;
  border-radius: 4px;
  font-size: 13px;
  color: #e6a23c;
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-tip.admin {
  background: #f0f9eb;
  color: #67c23a;
}

.tip-icon {
  font-size: 14px;
}

.detail-item {
  display: flex;
  margin-bottom: 12px;
  font-size: 14px;
}

.detail-label {
  color: #909399;
  width: 80px;
  flex-shrink: 0;
}

.status-text {
  font-weight: 500;
}

.status-text.pending {
  color: #e6a23c;
}

.status-text.approved {
  color: #67c23a;
}

.status-text.rejected {
  color: #f56c6c;
}

.status-text.cancelled {
  color: #909399;
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

.btn-warning {
  background: #e6a23c;
  color: white;
  border-color: #e6a23c;
}

.btn-warning:hover {
  background: #ebb563;
  border-color: #ebb563;
  color: white;
}

/* 周期性预定样式 */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 500;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  min-width: auto;
}

.recurring-section {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.recurring-options {
  padding: 16px;
  background: #ecf5ff;
  border-radius: 4px;
  margin-bottom: 16px;
}

.weekday-selector {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.weekday-checkbox {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.weekday-checkbox input[type="checkbox"] {
  width: auto;
  min-width: auto;
}

/* 冲突警告样式 */
.conflict-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #fef0f0;
  border-radius: 4px;
  color: #f56c6c;
  font-size: 14px;
  margin-bottom: 16px;
}

.warning-icon {
  font-size: 16px;
}

/* 候补提示样式 */
.waitlist-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #ecf5ff;
  border-radius: 4px;
  color: #409eff;
  font-size: 14px;
  margin-top: 16px;
}

.waitlist-hint.success {
  background: #f0f9eb;
  color: #67c23a;
}

.hint-icon {
  font-size: 16px;
}

.waitlist-input-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.waitlist-input-section .form-group {
  margin-bottom: 0;
}
</style>
