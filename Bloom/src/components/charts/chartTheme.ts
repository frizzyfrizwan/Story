/** Chart tokens read from CSS variables so charts follow the active theme. */
export function chartTokens() {
  const css = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    primary: read('--viz-primary', '#df4a78'),
    primarySoft: read('--viz-primary-soft', '#f9d0dc'),
    secondary: read('--viz-secondary', '#4f8956'),
    grid: read('--viz-grid', '#ece2e6'),
    text: read('--viz-text', '#68585f'),
    surface: `rgb(${read('--surface-raised', '255 255 255')})`,
  }
}

export const tooltipStyle = (t: ReturnType<typeof chartTokens>) => ({
  contentStyle: {
    background: t.surface,
    border: `1px solid ${t.grid}`,
    borderRadius: 12,
    boxShadow: '0 8px 24px -12px rgb(20 10 15 / 0.25)',
    fontSize: 12,
    color: t.text,
  },
  labelStyle: { color: t.text, fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: t.text, padding: 0 },
  cursor: { stroke: t.grid, strokeWidth: 1 },
})
