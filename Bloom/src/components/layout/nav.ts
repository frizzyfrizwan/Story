import { Home, Compass, CalendarCheck, Bell, UtensilsCrossed, Stethoscope, HeartPulse, ListChecks, Settings, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Show in the mobile bottom bar. */
  primary?: boolean
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Today', icon: Home, primary: true },
  { to: '/journey', label: 'Journey', icon: Compass, primary: true },
  { to: '/track', label: 'Track', icon: CalendarCheck, primary: true },
  { to: '/meals', label: 'Meals', icon: UtensilsCrossed, primary: true },
  { to: '/reminders', label: 'Reminders', icon: Bell },
  { to: '/appointments', label: 'Appointments', icon: Stethoscope },
  { to: '/health', label: 'Health', icon: HeartPulse },
  { to: '/checklists', label: 'Checklists', icon: ListChecks },
  { to: '/settings', label: 'Settings', icon: Settings },
]
