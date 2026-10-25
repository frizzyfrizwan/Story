import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useChartTokens } from './useChartTokens'
import { tooltipStyle } from './chartTheme'
import { kgToLb } from '@/lib/weight'
import type { Units } from '@/types'

export interface WeightPoint {
  week: number
  /** Actual gain since pre-pregnancy, kg (undefined when no entry). */
  gain?: number
  min: number
  max: number
}

export function WeightChart({ data, units }: { data: WeightPoint[]; units: Units }) {
  const t = useChartTokens()
  const conv = (v: number) => (units === 'metric' ? v : kgToLb(v))
  const unit = units === 'metric' ? 'kg' : 'lb'
  const rows = data.map((d) => ({
    ...d,
    band: [conv(d.min), conv(d.max)] as [number, number],
    gain: d.gain === undefined ? undefined : Number(conv(d.gain).toFixed(1)),
  }))
  return (
    <div className="h-64 w-full" role="img" aria-label={`Weight gain by week against the recommended range, in ${unit}`}>
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey="week" tick={{ fill: t.text, fontSize: 11 }} tickLine={false} axisLine={false} ticks={[4, 8, 12, 16, 20, 24, 28, 32, 36, 40]} />
          <YAxis tick={{ fill: t.text, fontSize: 11 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => `${v}`} />
          <Tooltip
            {...tooltipStyle(t)}
            formatter={(value, name) => {
              if (name === 'band') {
                const [a, b] = value as [number, number]
                return [`${a.toFixed(1)}–${b.toFixed(1)} ${unit}`, 'Recommended']
              }
              return [`${Number(value).toFixed(1)} ${unit}`, 'Your gain']
            }}
            labelFormatter={(l) => `Week ${l}`}
          />
          <Area type="monotone" dataKey="band" stroke="none" fill={t.primary} fillOpacity={0.12} isAnimationActive={false} connectNulls />
          <Line
            type="monotone"
            dataKey="gain"
            stroke={t.primary}
            strokeWidth={2}
            dot={{ r: 4, fill: t.primary, stroke: t.surface, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: t.primary, stroke: t.surface, strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
