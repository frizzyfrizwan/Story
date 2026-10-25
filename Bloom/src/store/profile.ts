import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile } from '@/types'

interface ProfileState {
  profile: Profile | null
  setProfile: (profile: Profile) => void
  updateProfile: (patch: Partial<Profile>) => void
  clear: () => void
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: null,
      setProfile: (profile) => set({ profile }),
      updateProfile: (patch) => set((s) => (s.profile ? { profile: { ...s.profile, ...patch } } : s)),
      clear: () => set({ profile: null }),
    }),
    { name: 'bloom:profile', version: 1 },
  ),
)

export const DEFAULT_PROFILE: Omit<Profile, 'dueDate' | 'dueDateSource' | 'onboardedAt'> = {
  name: '',
  multiples: false,
  diet: [],
  waterGoal: 8,
  units: 'metric',
  theme: 'system',
  notificationsEnabled: false,
}
