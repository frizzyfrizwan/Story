import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './ui/Button'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Bloom crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-dvh grid place-items-center p-6">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-secondary">Your data is saved on this device and is safe. Reloading usually fixes it.</p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-surface-sunken p-3 text-left text-xs text-ink-muted">{this.state.error.message}</pre>
          <Button className="mt-6" onClick={() => window.location.reload()}>
            Reload Bloom
          </Button>
        </div>
      </div>
    )
  }
}
