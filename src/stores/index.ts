import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, MeetingRoom, Reservation, ReservationStatus, RecurringPattern, WaitlistEntry } from '../types'

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
  const waitlist = ref<WaitlistEntry[]>([])

  const isAdmin = computed(() => currentUser.value.role === 'admin')
  const availableRooms = computed(() => rooms.value.filter(r => !r.disabled))

  // 获取所有待审批的预定（管理员用）
  const pendingReservations = computed(() => {
    return reservations.value
      .filter(r => r.status === 'pending')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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
      reservations.value[index] = {
        ...reservations.value[index],
        status: 'cancelled'
      }
    }
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

  // ==================== 周期性预定相关功能 ====================
  
  // 生成周期性预定的日期列表
  function generateRecurringDates(startDate: string, pattern: RecurringPattern): string[] {
    const dates: string[] = []
    const start = new Date(startDate)
    const end = new Date(pattern.endDate)
    
    let current = new Date(start)
    
    while (current <= end) {
      const currentDateStr = formatDate(current)
      
      let shouldInclude = false
      
      switch (pattern.type) {
        case 'daily':
          shouldInclude = true
          break
        case 'weekly':
          const weekday = current.getDay()
          shouldInclude = pattern.weekdays ? pattern.weekdays.includes(weekday) : false
          break
        case 'monthly':
          shouldInclude = current.getDate() === start.getDate()
          break
        case 'custom':
          const interval = pattern.interval || 1
          const dayDiff = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
          shouldInclude = dayDiff % interval === 0
          break
      }
      
      if (shouldInclude) {
        dates.push(currentDateStr)
      }
      
      // 前进一天
      current.setDate(current.getDate() + 1)
    }
    
    return dates
  }

  function formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  // 添加周期性预定
  function addRecurringReservation(
    baseReservation: Omit<Reservation, 'id' | 'createdAt' | 'status' | 'approvedAt' | 'approvedBy' | 'date' | 'recurringId'>,
    pattern: RecurringPattern,
    startDate: string
  ): Reservation[] {
    const recurringId = generateId()
    const isUserAdmin = currentUser.value.role === 'admin'
    
    const dates = generateRecurringDates(startDate, pattern)
    const createdReservations: Reservation[] = []
    
    for (const date of dates) {
      // 跳过有冲突的日期
      if (!checkTimeConflict(baseReservation.roomId, date, baseReservation.startTime, baseReservation.endTime)) {
        const newReservation: Reservation = {
          ...baseReservation,
          date,
          id: generateId(),
          createdAt: new Date().toISOString(),
          status: isUserAdmin ? 'approved' : 'pending',
          recurringId,
          ...(isUserAdmin ? {
            approvedAt: new Date().toISOString(),
            approvedBy: currentUser.value.id
          } : {})
        }
        reservations.value.push(newReservation)
        createdReservations.push(newReservation)
      }
    }
    
    return createdReservations
  }

  // 取消单个周期性预定（标记为例外）
  function cancelSingleRecurringReservation(reservationId: string) {
    const index = reservations.value.findIndex(r => r.id === reservationId)
    if (index !== -1) {
      reservations.value[index] = {
        ...reservations.value[index],
        status: 'cancelled',
        isRecurringException: true
      }
    }
  }

  // 取消整个周期性预定系列
  function cancelAllRecurringReservations(recurringId: string) {
    reservations.value.forEach((r, index) => {
      if (r.recurringId === recurringId && r.status !== 'cancelled') {
        reservations.value[index] = {
          ...reservations.value[index],
          status: 'cancelled'
        }
      }
    })
  }

  // 获取某个周期性预定的所有系列
  function getReservationsByRecurringId(recurringId: string): Reservation[] {
    return reservations.value.filter(r => r.recurringId === recurringId)
  }

  // ==================== 候补排队相关功能 ====================
  
  // 加入候补队列
  function addToWaitlist(entry: Omit<WaitlistEntry, 'id' | 'position' | 'createdAt'>): WaitlistEntry {
    // 计算当前队列位置
    const existingInQueue = waitlist.value.filter(
      w => w.roomId === entry.roomId 
        && w.date === entry.date 
        && w.startTime === entry.startTime 
        && w.endTime === entry.endTime
    ).length
    
    const newEntry: WaitlistEntry = {
      ...entry,
      id: generateId(),
      position: existingInQueue + 1,
      createdAt: new Date().toISOString()
    }
    
    waitlist.value.push(newEntry)
    return newEntry
  }

  // 取消候补
  function cancelWaitlistEntry(waitlistId: string) {
    const index = waitlist.value.findIndex(w => w.id === waitlistId)
    if (index !== -1) {
      const removed = waitlist.value[index]
      waitlist.value.splice(index, 1)
      
      // 更新候补队列位置
      waitlist.value.forEach(w => {
        if (w.roomId === removed.roomId 
            && w.date === removed.date 
            && w.startTime === removed.startTime 
            && w.endTime === removed.endTime
            && w.position > removed.position) {
          w.position--
        }
      })
    }
  }

  // 获取用户的候补列表
  function getWaitlistByUser(userId: string): WaitlistEntry[] {
    return waitlist.value
      .filter(w => w.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  // 获取某个时段的候补队列
  function getWaitlistBySlot(roomId: string, date: string, startTime: string, endTime: string): WaitlistEntry[] {
    return waitlist.value
      .filter(w => w.roomId === roomId && w.date === date && w.startTime === startTime && w.endTime === endTime)
      .sort((a, b) => a.position - b.position)
  }

  // 取消预定后自动分配给候补队列的第一个人
  function processWaitlistAfterCancellation(roomId: string, date: string, startTime: string, endTime: string) {
    const queue = getWaitlistBySlot(roomId, date, startTime, endTime)
    
    if (queue.length > 0) {
      const firstInLine = queue[0]
      
      // 将候补转为正式预定（自动通过）
      const newReservation: Reservation = {
        id: generateId(),
        roomId: firstInLine.roomId,
        userId: firstInLine.userId,
        date: firstInLine.date,
        startTime: firstInLine.startTime,
        endTime: firstInLine.endTime,
        title: firstInLine.title,
        status: 'approved',
        createdAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        approvedBy: 'system'
      }
      
      reservations.value.push(newReservation)
      
      // 从候补队列中移除并更新位置
      cancelWaitlistEntry(firstInLine.id)
      
      return newReservation
    }
    
    return null
  }

  // 重写取消预定函数，增加候补自动分配逻辑
  function cancelReservationWithWaitlist(id: string) {
    const reservation = reservations.value.find(r => r.id === id)
    if (reservation) {
      // 先取消预定
      const index = reservations.value.findIndex(r => r.id === id)
      if (index !== -1) {
        reservations.value[index] = {
          ...reservations.value[index],
          status: 'cancelled'
        }
      }
      
      // 处理候补分配
      processWaitlistAfterCancellation(
        reservation.roomId,
        reservation.date,
        reservation.startTime,
        reservation.endTime
      )
    }
  }

  // 检查某个用户是否已经在候补队列中
  function isUserInWaitlist(userId: string, roomId: string, date: string, startTime: string, endTime: string): boolean {
    return waitlist.value.some(
      w => w.userId === userId 
        && w.roomId === roomId 
        && w.date === date 
        && w.startTime === startTime 
        && w.endTime === endTime
    )
  }

  return {
    currentUser,
    users,
    rooms,
    reservations,
    waitlist,
    isAdmin,
    availableRooms,
    pendingReservations,
    setCurrentUser,
    addRoom,
    updateRoom,
    deleteRoom,
    addReservation,
    approveReservation,
    rejectReservation,
    cancelReservation: cancelReservationWithWaitlist,
    deleteReservation,
    getApprovedReservationsByRoomAndDate,
    getActiveReservationsByRoomAndDate,
    getReservationsByUser,
    checkTimeConflict,
    // 周期性预定
    addRecurringReservation,
    cancelSingleRecurringReservation,
    cancelAllRecurringReservations,
    getReservationsByRecurringId,
    generateRecurringDates,
    // 候补排队
    addToWaitlist,
    cancelWaitlistEntry,
    getWaitlistByUser,
    getWaitlistBySlot,
    isUserInWaitlist,
  }
})
