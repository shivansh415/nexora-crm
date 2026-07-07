export * from './database.types'

// ─── UI / Domain types not tied to DB ─────────────────────────────────────────

export interface NavItem {
  label: string
  href: string
  icon: string
  badge?: number
  comingSoon?: boolean
}

export interface StatCard {
  label: string
  value: string | number
  delta?: string
  deltaType?: 'increase' | 'decrease' | 'neutral'
  icon: string
  href?: string
}

export interface BusinessHours {
  mon: { enabled: boolean; start: string; end: string }
  tue: { enabled: boolean; start: string; end: string }
  wed: { enabled: boolean; start: string; end: string }
  thu: { enabled: boolean; start: string; end: string }
  fri: { enabled: boolean; start: string; end: string }
  sat: { enabled: boolean; start: string; end: string }
  sun: { enabled: boolean; start: string; end: string }
}

export interface PipelineStage {
  id: string
  name: string
  status: string
  color: string
}

export interface ChartDataPoint {
  date: string
  inbound: number
  outbound: number
  ai: number
  agent: number
}

