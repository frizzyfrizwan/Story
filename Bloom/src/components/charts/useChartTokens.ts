import { useEffect, useState } from 'react'
import { chartTokens } from './chartTheme'

/** Re-reads chart tokens whenever the theme attribute changes. */
export function useChartTokens() {
  const [tokens, setTokens] = useState(chartTokens)
  useEffect(() => {
    const obs = new MutationObserver(() => setTokens(chartTokens()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return tokens
}
