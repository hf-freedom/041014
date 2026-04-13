import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, MeetingRoom, Reservation, ReservationStatus, ReservationQueue, RecurringConfig } from '../types'

const generateId = () => Math.random().toString(36).substr(2, 9)

const initialUsers: User[] = [
  { id: '1', name: '管理员', role: 'admin' },
  { id: '2', name: '张三', role: 'user' },
  { id: '3', name: '李四', role: 'user' },
  { id: '4', name: '王五', role: 'user' },
]

const initialRooms: MeetingRoom[] = [
  { id: '1', name: '会议室A', location: '1楼101', disabled: false, openTimeStart: '08:00', openTimeEnd: '18:00' },
  { id: '2', name: '会议室B', location: '1楼102', disabled: false, openTimeStart: '08:00', openTimeEnd: '18:00' },
  { id: '3', name: '会议室C', location: '2楼201', disabled: false, openTimeStart: '09:00', openTimeEnd: '17:00' },
  { id: '4', name: '会议室D', location: '2楼202', disabled: false, openTimeStart: '08:30', openTimeEnd: '18:30' },
  { id: '5', name: '会议室E', location: '3楼301', disabled: false, openTimeStart: '08:00', openTimeEnd: '20:00' },
]

export const useStore = defineStore('app', () => {
  const currentUser = ref<User>(initialUsers[1])
  const users = ref<User[]>(initialUsers)
  const rooms = ref<MeetingRoom[]>(initialRooms)
  const reservations = ref<Reservation[]>([])
  const reservationQueue = ref<ReservationQueue[]>([])

  const isAdmin = computed(() => currentUser.value.role === 'admin')
  const availableRooms = computed(() => rooms.value.filter(r => !r.disabled))

  // 获取所有待审批的预定（管理员用）
  const pendingReservations = computed(() => {
    return reservations.value
      .filter(r => r.status === 'pending')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  })

  // 获取候补中的排队记录
  const waitingQueue = computed(() => {
    return reservationQueue.value
      .filter(q => q.status === 'waiting')
      .sort((a, b) => a.position - b.position)
  })

  function setCurrentUser(userId: string) {
    const user = users.value.find(u => u.id === userId)
    if (user) {
      currentUser.value = user
    }
  }

  function addRoom(room: Omit<MeetingRoom, 'id'>) {
    const newRoom: MeetingRoom = {
      ...room,
      id: generateId(),
    }
    rooms.value.push(newRoom)
    return newRoom
  }

  function updateRoom(id: string, updates: Partial<MeetingRoom>) {
    const index = rooms.value.findIndex(r => r.id === id)
    if (index !== -1) {
      rooms.value[index] = { ...rooms.value[index], ...updates }
    }
  }

  function deleteRoom(id: string) {
    const index = rooms.value.findIndex(r => r.id === id)
    if (index !== -1) {
      rooms.value.splice(index, 1)
    }
  }

  // 申请预定（普通用户申请，管理员直接通过）
  function addReservation(reservation: Omit<Reservation, 'id' | 'createdAt' | 'status' | 'approvedAt' | 'approvedBy'>) {
    const isUserAdmin = currentUser.value.role === 'admin'
    const newReservation: Reservation = {
      ...reservation,
      id: generateId(),
      createdAt: new Date().toISOString(),
      // 管理员直接通过，普通用户待审批
      status: isUserAdmin ? 'approved' : 'pending',
      ...(isUserAdmin ? {
        approvedAt: new Date().toISOString(),
        approvedBy: currentUser.value.id
      } : {})
    }
    reservations.value.push(newReservation)
    return newReservation
  }

  // 审批预定（通过）
  function approveReservation(reservationId: string) {
    const index = reservations.value.findIndex(r => r.id === reservationId)
    if (index !== -1) {
      reservations.value[index] = {
        ...reservations.value[index],
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: currentUser.value.id
      }
    }
  }

  // 审批预定（驳回）
  function rejectReservation(reservationId: string, reason: string) {
    const index = reservations.value.findIndex(r => r.id === reservationId)
    if (index !== -1) {
      reservations.value[index] = {
        ...reservations.value[index],
        status: 'rejected',
        rejectReason: reason
      }
    }
  }

  // 取消预定
  function cancelReservation(id: string) {
    const index = reservations.value.findIndex(r => r.id === id)
    if (index !== -1) {
      const cancelledReservation = reservations.value[index]
      reservations.value[index] = {
        ...cancelledReservation,
        status: 'cancelled'
      }
      // 取消后检查是否有候补可以转正
      processQueueForTimeSlot(
        cancelledReservation.roomId,
        cancelledReservation.date,
        cancelledReservation.startTime,
        cancelledReservation.endTime
      )
    }
  }

  // 取消周期性预定中的某一次
  function cancelRecurringInstance(id: string) {
    cancelReservation(id)
  }

  // 取消整个周期性预定组
  function cancelRecurringGroup(groupId: string) {
    const groupReservations = reservations.value.filter(r => r.recurringGroupId === groupId)
    groupReservations.forEach(r => {
      if (r.status === 'pending' || r.status === 'approved') {
        cancelReservation(r.id)
      }
    })
  }

  // 生成周期性预定的日期列表
  function generateRecurringDates(startDate: string, config: RecurringConfig): string[] {
    const dates: string[] = []
    const start = new Date(startDate)
    const end = new Date(config.endDate)
    
    if (config.type === 'daily') {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + config.interval)) {
        dates.push(d.toISOString().split('T')[0])
      }
    } else if (config.type === 'weekly') {
      if (config.weekDays && config.weekDays.length > 0) {
        // 按每周的指定天数重复
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (config.weekDays.includes(d.getDay())) {
            dates.push(d.toISOString().split('T')[0])
          }
        }
      } else {
        // 按周间隔重复
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + config.interval * 7)) {
          dates.push(d.toISOString().split('T')[0])
        }
      }
    } else if (config.type === 'monthly') {
      for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + config.interval)) {
        dates.push(d.toISOString().split('T')[0])
      }
    } else if (config.type === 'custom') {
      // 自定义间隔（天数）
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + config.interval)) {
        dates.push(d.toISOString().split('T')[0])
      }
    }
    
    return dates
  }

  // 创建周期性预定
  function addRecurringReservation(
    baseReservation: Omit<Reservation, 'id' | 'createdAt' | 'status' | 'approvedAt' | 'approvedBy' | 'isRecurring' | 'recurringGroupId'>,
    config: RecurringConfig
  ) {
    const isUserAdmin = currentUser.value.role === 'admin'
    const recurringGroupId = generateId()
    const dates = generateRecurringDates(baseReservation.date, config)
    const createdReservations: Reservation[] = []
    
    for (const date of dates) {
      // 检查该日期是否已有冲突
      const hasConflict = checkTimeConflict(baseReservation.roomId, date, baseReservation.startTime, baseReservation.endTime)
      
      if (!hasConflict) {
        const newReservation: Reservation = {
          ...baseReservation,
          date,
          id: generateId(),
          createdAt: new Date().toISOString(),
          status: isUserAdmin ? 'approved' : 'pending',
          isRecurring: true,
          recurringGroupId,
          recurringConfig: config,
          ...(isUserAdmin ? {
            approvedAt: new Date().toISOString(),
            approvedBy: currentUser.value.id
          } : {})
        }
        reservations.value.push(newReservation)
        createdReservations.push(newReservation)
      }
    }
    
    return {
      groupId: recurringGroupId,
      reservations: createdReservations,
      totalPlanned: dates.length,
      actualCreated: createdReservations.length
    }
  }

  // 加入排队候补
  function joinQueue(queueItem: Omit<ReservationQueue, 'id' | 'createdAt' | 'position' | 'status'>) {
    // 获取当前该时段的排队人数
    const existingQueue = reservationQueue.value.filter(
      q => q.roomId === queueItem.roomId 
        && q.date === queueItem.date 
        && q.startTime === queueItem.startTime 
        && q.endTime === queueItem.endTime
        && q.status === 'waiting'
    )
    
    const newQueueItem: ReservationQueue = {
      ...queueItem,
      id: generateId(),
      createdAt: new Date().toISOString(),
      position: existingQueue.length + 1,
      status: 'waiting'
    }
    
    reservationQueue.value.push(newQueueItem)
    return newQueueItem
  }

  // 取消排队
  function cancelQueue(queueId: string) {
    const index = reservationQueue.value.findIndex(q => q.id === queueId)
    if (index !== -1) {
      const cancelledItem = reservationQueue.value[index]
      reservationQueue.value[index] = {
        ...cancelledItem,
        status: 'cancelled'
      }
      // 重新计算该时段的排队位置
      reorderQueue(
        cancelledItem.roomId,
        cancelledItem.date,
        cancelledItem.startTime,
        cancelledItem.endTime
      )
    }
  }

  // 重新计算排队位置
  function reorderQueue(roomId: string, date: string, startTime: string, endTime: string) {
    const queueForSlot = reservationQueue.value.filter(
      q => q.roomId === roomId 
        && q.date === date 
        && q.startTime === startTime 
        && q.endTime === endTime
        && q.status === 'waiting'
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    
    queueForSlot.forEach((q, index) => {
      const qIndex = reservationQueue.value.findIndex(item => item.id === q.id)
      if (qIndex !== -1) {
        reservationQueue.value[qIndex].position = index + 1
      }
    })
  }

  // 处理候补转正（当有人取消时调用）
  function processQueueForTimeSlot(roomId: string, date: string, startTime: string, endTime: string) {
    // 找到该时段的第一个候补
    const waitingQueue = reservationQueue.value.filter(
      q => q.roomId === roomId 
        && q.date === date 
        && q.startTime === startTime 
        && q.endTime === endTime
        && q.status === 'waiting'
    ).sort((a, b) => a.position - b.position)
    
    if (waitingQueue.length > 0) {
      const firstInQueue = waitingQueue[0]
      
      // 获取候补用户的角色
      const queueUser = users.value.find(u => u.id === firstInQueue.userId)
      const isQueueUserAdmin = queueUser?.role === 'admin'
      
      // 创建正式预定（根据候补用户的角色决定状态）
      const newReservation: Reservation = {
        id: generateId(),
        roomId: firstInQueue.roomId,
        userId: firstInQueue.userId,
        date: firstInQueue.date,
        startTime: firstInQueue.startTime,
        endTime: firstInQueue.endTime,
        title: firstInQueue.title,
        status: isQueueUserAdmin ? 'approved' : 'pending',
        createdAt: new Date().toISOString(),
        isFromQueue: true,
        queuePosition: firstInQueue.position,
        ...(isQueueUserAdmin ? {
          approvedAt: new Date().toISOString(),
          approvedBy: firstInQueue.userId
        } : {})
      }
      
      reservations.value.push(newReservation)
      
      // 更新候补记录状态
      const qIndex = reservationQueue.value.findIndex(q => q.id === firstInQueue.id)
      if (qIndex !== -1) {
        reservationQueue.value[qIndex] = {
          ...reservationQueue.value[qIndex],
          status: 'converted',
          convertedReservationId: newReservation.id
        }
      }
      
      // 重新排序剩余候补
      reorderQueue(roomId, date, startTime, endTime)
      
      return newReservation
    }
    return null
  }

  // 获取用户的排队记录
  function getQueueByUser(userId: string) {
    return reservationQueue.value
      .filter(q => q.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  // 获取指定会议室和日期的排队记录
  function getQueueByRoomAndDate(roomId: string, date: string) {
    return reservationQueue.value.filter(
      q => q.roomId === roomId && q.date === date && q.status === 'waiting'
    ).sort((a, b) => a.position - b.position)
  }

  // 删除预定（硬删除，保留用于兼容）
  function deleteReservation(id: string) {
    const index = reservations.value.findIndex(r => r.id === id)
    if (index !== -1) {
      reservations.value.splice(index, 1)
    }
  }

  // 获取指定会议室和日期的已批准预定
  function getApprovedReservationsByRoomAndDate(roomId: string, date: string) {
    return reservations.value.filter(
      r => r.roomId === roomId && r.date === date && r.status === 'approved'
    )
  }

  // 获取指定会议室和日期的所有有效预定（待审批和已批准）
  function getActiveReservationsByRoomAndDate(roomId: string, date: string) {
    return reservations.value.filter(
      r => r.roomId === roomId && r.date === date && (r.status === 'approved' || r.status === 'pending')
    )
  }

  function getReservationsByUser(userId: string) {
    return reservations.value
      .filter(r => r.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  // 检查时间冲突（只检查已批准和待审批的预定）
  function checkTimeConflict(roomId: string, date: string, startTime: string, endTime: string, excludeId?: string) {
    const roomReservations = reservations.value.filter(
      r => r.roomId === roomId 
        && r.date === date 
        && r.id !== excludeId
        && (r.status === 'approved' || r.status === 'pending')
    )
    
    for (const reservation of roomReservations) {
      const existingStart = reservation.startTime
      const existingEnd = reservation.endTime
      
      if (
        (startTime >= existingStart && startTime < existingEnd) ||
        (endTime > existingStart && endTime <= existingEnd) ||
        (startTime <= existingStart && endTime >= existingEnd)
      ) {
        return true
      }
    }
    return false
  }

  return {
    currentUser,
    users,
    rooms,
    reservations,
    reservationQueue,
    isAdmin,
    availableRooms,
    pendingReservations,
    waitingQueue,
    setCurrentUser,
    addRoom,
    updateRoom,
    deleteRoom,
    addReservation,
    approveReservation,
    rejectReservation,
    cancelReservation,
    cancelRecurringInstance,
    cancelRecurringGroup,
    addRecurringReservation,
    joinQueue,
    cancelQueue,
    getQueueByUser,
    getQueueByRoomAndDate,
    deleteReservation,
    getApprovedReservationsByRoomAndDate,
    getActiveReservationsByRoomAndDate,
    getReservationsByUser,
    checkTimeConflict,
  }
})
