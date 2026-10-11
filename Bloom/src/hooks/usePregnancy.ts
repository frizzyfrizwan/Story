import { useMemo } from 'react'
import { useProfileStore } from '@/store/profile'
import { gestationalAge, type GestationalAge } from '@/lib/pregnancy'
import { useToday } from './useToday'

export function usePregnancy(): { ga: GestationalAge; dueDate: string; today: string } | null {
  const profile = useProfileStore((s) => s.profile)
  const today = useToday()
  return useMemo(() => {
    if (!profile) return null
    return { ga: gestationalAge(profile.dueDate, today), dueDate: profile.dueDate, today }
  }, [profile, today])
}
