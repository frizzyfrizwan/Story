import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartTokens } from './useChartTokens'
import { tooltipStyle } from './chartTheme'

export function WaterChart({ data, goal }: { data: { label: string; glasses: number }[]; goal: number }) {
  const t = useChartTokens()
  return (
    <div className="h-40 w-full" role="img" aria-label="Glasses of water per day over the last week">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -28, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: t.text, fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: t.text, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip {...tooltipStyle(t)} formatter={(v) => [`${v} glasses`, 'Water']} cursor={{ fill: t.grid, opacity: 0.4 }} />
          <ReferenceLine y={goal} stroke={t.secondary} strokeDasharray="0" strokeWidth={1} />
          <Bar dataKey="glasses" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.glasses >= goal ? t.secondary : t.primary} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
