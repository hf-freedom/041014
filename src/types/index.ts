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

// 周期性预定类型
export type RecurringType = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface RecurringConfig {
  type: RecurringType
  interval: number // 间隔天数/周数/月数
  endDate: string // 结束日期
  weekDays?: number[] // 每周的哪几天 (0-6, 0=周日)
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
  // 周期性预定相关
  isRecurring?: boolean
  recurringGroupId?: string // 周期性预定组ID
  recurringConfig?: RecurringConfig
  // 排队候补相关
  isFromQueue?: boolean // 是否从候补转为正式预定
  queuePosition?: number // 候补位置
}

// 排队候补记录
export interface ReservationQueue {
  id: string
  roomId: string
  userId: string
  date: string
  startTime: string
  endTime: string
  title: string
  createdAt: string
  position: number // 排队位置
  status: 'waiting' | 'converted' | 'cancelled' // waiting=候补中, converted=已转正, cancelled=已取消
  convertedReservationId?: string // 转正后的预定ID
}
