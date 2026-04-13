export interface User {
  id: string
  name: string
  role: 'admin' | 'user'
}

export interface MeetingRoom {
  id: string
  name: string
  location: string
  disabled: boolean
  openTimeStart: string
  openTimeEnd: string
}

export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'waiting'

export type RecurringType = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface RecurringPattern {
  type: RecurringType
  interval?: number
  weekdays?: number[]
  endDate: string
}

export interface RecurringReservation {
  id: string
  pattern: RecurringPattern
  userId: string
  roomId: string
  startTime: string
  endTime: string
  title: string
  startDate: string
  createdAt: string
}

export interface WaitlistEntry {
  id: string
  roomId: string
  userId: string
  date: string
  startTime: string
  endTime: string
  title: string
  position: number
  createdAt: string
}

export interface Reservation {
  id: string
  roomId: string
  userId: string
  date: string
  startTime: string
  endTime: string
  title: string
  status: ReservationStatus
  createdAt: string
  approvedAt?: string
  approvedBy?: string
  rejectReason?: string
  recurringId?: string
  isRecurringException?: boolean
}
