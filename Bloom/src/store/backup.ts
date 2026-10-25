import { useProfileStore } from './profile'
import { useLogStore } from './logs'
import { useReminderStore } from './reminders'
import { useAppointmentStore } from './appointments'
import { useChecklistStore } from './checklists'
import { useMealStore } from './meals'

export const BACKUP_VERSION = 1

export interface Backup {
  app: 'bloom'
  version: number
  exportedAt: string
  profile: ReturnType<typeof useProfileStore.getState>['profile']
  logs: ReturnType<typeof useLogStore.getState>['logs']
  contractions: ReturnType<typeof useLogStore.getState>['contractions']
  reminders: ReturnType<typeof useReminderStore.getState>['reminders']
  appointments: ReturnType<typeof useAppointmentStore.getState>['appointments']
  checklists: { checked: ReturnType<typeof useChecklistStore.getState>['checked']; customItems: ReturnType<typeof useChecklistStore.getState>['customItems'] }
  meals: Pick<ReturnType<typeof useMealStore.getState>, 'seeds' | 'overrides' | 'groceryChecked' | 'favourites'>
}

export function createBackup(): Backup {
  const meals = useMealStore.getState()
  const checklists = useChecklistStore.getState()
  return {
    app: 'bloom',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: useProfileStore.getState().profile,
    logs: useLogStore.getState().logs,
    contractions: useLogStore.getState().contractions,
    reminders: useReminderStore.getState().reminders,
    appointments: useAppointmentStore.getState().appointments,
    checklists: { checked: checklists.checked, customItems: checklists.customItems },
    meals: { seeds: meals.seeds, overrides: meals.overrides, groceryChecked: meals.groceryChecked, favourites: meals.favourites },
  }
}

export function validateBackup(input: unknown): input is Backup {
  if (!input || typeof input !== 'object') return false
  const b = input as Record<string, unknown>
  return b.app === 'bloom' && typeof b.version === 'number' && typeof b.logs === 'object' && Array.isArray(b.reminders)
}

export function restoreBackup(b: Backup) {
  if (b.profile) useProfileStore.getState().setProfile(b.profile)
  useLogStore.getState().replaceAll(b.logs ?? {}, b.contractions ?? [])
  useReminderStore.getState().replaceAll(b.reminders ?? [])
  useAppointmentStore.getState().replaceAll(b.appointments ?? [])
  useChecklistStore.getState().replaceAll(b.checklists?.checked ?? {}, b.checklists?.customItems ?? {})
  useMealStore.getState().replaceAll(b.meals ?? { seeds: {}, overrides: {}, groceryChecked: {}, favourites: [] })
}

export function clearAllData() {
  useProfileStore.getState().clear()
  useLogStore.getState().clear()
  useReminderStore.getState().clear()
  useAppointmentStore.getState().clear()
  useChecklistStore.getState().clear()
  useMealStore.getState().clear()
}
