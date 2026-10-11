import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { NAV } from './nav'
import { usePregnancy } from '@/hooks/usePregnancy'
import { useProfileStore } from '@/store/profile'
import { formatGA } from '@/lib/pregnancy'
import { Toaster } from '@/components/ui/Toaster'

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-600 text-white shadow-soft">
        <svg viewBox="0 0 64 64" className="h-5 w-5" aria-hidden>
          <path d="M32 50c-9-6-18-13-18-23a10 10 0 0 1 18-6 10 10 0 0 1 18 6c0 10-9 17-18 23z" fill="currentColor" />
          <circle cx="32" cy="27" r="5" fill="#df4a78" />
        </svg>
      </span>
      <span className="font-display text-2xl font-semibold tracking-tight">Bloom</span>
    </div>
  )
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const preg = usePregnancy()
  const name = useProfileStore((s) => s.profile?.name)
  return (
    <nav className="flex h-full flex-col gap-1 p-4" aria-label="Main">
      <div className="px-2 pb-6 pt-2">
        <Logo />
        {preg && (
          <p className="mt-3 text-sm text-ink-secondary">
            {name ? `${name} · ` : ''}
            <span className="font-medium text-ink">{formatGA(preg.ga)}</span>
          </p>
        )}
      </div>
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              isActive ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' : 'text-ink-secondary hover:bg-surface-sunken hover:text-ink',
            )
          }
        >
          <item.icon className="h-5 w-5" aria-hidden />
          {item.label}
        </NavLink>
      ))}
      <p className="mt-auto px-3 pt-6 text-[11px] leading-relaxed text-ink-muted">
        Bloom offers general information, not medical advice. Always follow your own care provider.
      </p>
    </nav>
  )
}

export function Shell() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const primary = NAV.filter((n) => n.primary)
  const otherActive = !NAV.filter((n) => n.primary).some((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)))

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:block border-r border-line bg-surface-raised/60 sticky top-0 h-dvh">
        <SideNav />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface-raised shadow-lift animate-fade-up">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-ink-muted hover:bg-surface-sunken"
            >
              <X className="h-5 w-5" />
            </button>
            <SideNav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-dvh flex-col">
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/80 px-4 py-3 backdrop-blur">
          <Logo />
          <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-2 text-ink-secondary hover:bg-surface-sunken">
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10 max-w-6xl w-full mx-auto">
          <div key={location.pathname} className="animate-fade-up">
            <Outlet />
          </div>
        </main>

        <nav
          aria-label="Primary"
          className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-raised/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid grid-cols-5">
            {primary.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-rose-600' : 'text-ink-muted')
                }
              >
                <item.icon className="h-5 w-5" aria-hidden />
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', otherActive ? 'text-rose-600' : 'text-ink-muted')}
            >
              <Menu className="h-5 w-5" aria-hidden />
              More
            </button>
          </div>
        </nav>
      </div>
      <Toaster />
    </div>
  )
}
