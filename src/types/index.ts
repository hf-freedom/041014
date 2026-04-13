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

export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

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
}
