import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Shell } from '@/components/layout/Shell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useProfileStore } from '@/store/profile'
import { useTheme } from '@/hooks/useTheme'
import { useReminderScheduler } from '@/hooks/useReminderScheduler'

const Onboarding = lazy(() => import('@/pages/Onboarding'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Journey = lazy(() => import('@/pages/Journey'))
const Track = lazy(() => import('@/pages/Track'))
const Reminders = lazy(() => import('@/pages/Reminders'))
const Meals = lazy(() => import('@/pages/Meals'))
const Appointments = lazy(() => import('@/pages/Appointments'))
const Health = lazy(() => import('@/pages/Health'))
const Checklists = lazy(() => import('@/pages/Checklists'))
const Settings = lazy(() => import('@/pages/Settings'))

function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose-200 border-t-rose-600" />
      <span className="sr-only">Loading</span>
    </div>
  )
}

function RequireProfile({ children }: { children: React.ReactNode }) {
  const hasProfile = useProfileStore((s) => !!s.profile)
  const location = useLocation()
  if (!hasProfile) return <Navigate to="/welcome" replace state={{ from: location }} />
  return <>{children}</>
}

function GlobalEffects() {
  useTheme()
  useReminderScheduler()
  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <GlobalEffects />
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/welcome" element={<Onboarding />} />
            <Route
              element={
                <RequireProfile>
                  <Shell />
                </RequireProfile>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="journey" element={<Journey />} />
              <Route path="journey/:week" element={<Journey />} />
              <Route path="track" element={<Track />} />
              <Route path="track/:date" element={<Track />} />
              <Route path="reminders" element={<Reminders />} />
              <Route path="meals" element={<Meals />} />
              <Route path="appointments" element={<Appointments />} />
              <Route path="health" element={<Health />} />
              <Route path="checklists" element={<Checklists />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
