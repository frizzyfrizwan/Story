import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartTokens } from './useChartTokens'
import { tooltipStyle } from './chartTheme'

export function SymptomChart({ data }: { data: { label: string; days: number }[] }) {
  const t = useChartTokens()
  const height = Math.max(120, data.length * 34)
  return (
    <div className="w-full" style={{ height }} role="img" aria-label="Most frequent symptoms over the last 30 days">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid stroke={t.grid} horizontal={false} />
          <XAxis type="number" tick={{ fill: t.text, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="label" width={130} tick={{ fill: t.text, fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle(t)} formatter={(v) => [`${v} days`, 'Logged']} cursor={{ fill: t.grid, opacity: 0.4 }} />
          <Bar
            dataKey="days"
            fill={t.primary}
            radius={[0, 4, 4, 0]}
            maxBarSize={18}
            isAnimationActive={false}
            label={{ position: 'right', fill: t.text, fontSize: 11 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
