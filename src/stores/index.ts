import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, MeetingRoom, Reservation, ReservationStatus } from '../types'

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

  return {
    currentUser,
    users,
    rooms,
    reservations,
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
    cancelReservation,
    deleteReservation,
    getApprovedReservationsByRoomAndDate,
    getActiveReservationsByRoomAndDate,
    getReservationsByUser,
    checkTimeConflict,
  }
})
