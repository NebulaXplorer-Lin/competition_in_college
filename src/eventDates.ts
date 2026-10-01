export const dateLabels = {
  registration_start: '报名开始',
  registration_deadline: '报名截止',
  event_start: '活动开始',
  event_end: '活动结束',
  last_verified: '最近核实',
} as const

export type Dates = Record<keyof typeof dateLabels, string>
type ScheduledEvent = Dates & { status: 'open' | 'closed' | 'ended' }

export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function validateDates(dates: Dates) {
  const errors: string[] = []
  for (const key of Object.keys(dateLabels) as (keyof Dates)[]) {
    const value = dates[key]
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || localDate(new Date(`${value}T00:00:00`)) !== value)) errors.push(`${dateLabels[key]}必须是有效日期（YYYY-MM-DD）`)
  }
  if (dates.registration_start && dates.registration_deadline && dates.registration_start > dates.registration_deadline) errors.push('报名截止不能早于报名开始')
  if (dates.event_start && dates.event_end && dates.event_start > dates.event_end) errors.push('活动结束不能早于活动开始')
  return errors
}

export function effectiveStatus(event: ScheduledEvent, today = localDate(new Date())) {
  if (event.status === 'ended' || (event.event_end && event.event_end < today)) return 'ended'
  if (event.status === 'closed' || (event.registration_deadline && event.registration_deadline < today)) return 'closed'
  if (event.registration_start && event.registration_start > today) return 'upcoming'
  if (!event.registration_start && !event.registration_deadline) return 'unknown'
  return 'open'
}
