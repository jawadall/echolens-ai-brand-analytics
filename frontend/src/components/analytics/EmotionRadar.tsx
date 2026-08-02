/**
 * EmotionRadar — Radar/Spider chart showing emotion distribution
 * Uses Recharts RadarChart with premium styling
 */
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'
import { motion } from 'framer-motion'

interface EmotionRadarProps {
  emotions: Record<string, number>  // e.g. { joy: 0.4, anger: 0.1, sadness: 0.15, surprise: 0.2, fear: 0.05, trust: 0.3 }
  height?: number
}

const EMOTION_ICONS: Record<string, string> = {
  joy: '😊',
  anger: '😠',
  sadness: '😢',
  surprise: '😲',
  fear: '😨',
  trust: '🤝',
  anticipation: '🤔',
  disgust: '🤮',
  love: '❤️',
  hope: '🌟',
}

export default function EmotionRadar({ emotions, height = 300 }: EmotionRadarProps) {
  if (!emotions || Object.keys(emotions).length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No emotion data available</p>
      </div>
    )
  }

  const data = Object.entries(emotions).map(([emotion, value]) => ({
    emotion: `${EMOTION_ICONS[emotion] || '•'} ${emotion.charAt(0).toUpperCase() + emotion.slice(1)}`,
    value: Math.round((value as number) * 100),
    raw: value,
  }))

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="var(--border-primary)" />
          <PolarAngleAxis dataKey="emotion" fontSize={11} stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} />
          <PolarRadiusAxis fontSize={9} stroke="var(--text-muted)" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: 'var(--text-muted)' }} />
          <Radar
            name="Emotion Score"
            dataKey="value"
            stroke="#5a71f2"
            fill="#5a71f2"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-primary)',
              borderRadius: '12px',
              color: 'var(--text-primary)',
              fontSize: '12px',
            }}
            formatter={(value: number) => [`${value}%`, 'Score']}
            itemStyle={{ color: 'var(--text-primary)' }}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Legend grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 px-2">
        {data.sort((a, b) => b.value - a.value).map((d) => (
          <div key={d.emotion} className="flex items-center gap-2 text-xs">
            <div className="w-8 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-primary)' }}>
              <div className="h-full rounded-full bg-primary-500" style={{ width: `${d.value}%` }} />
            </div>
            <span style={{ color: 'var(--text-secondary)' }}>{d.emotion}</span>
            <span className="font-medium ml-auto" style={{ color: 'var(--text-primary)' }}>{d.value}%</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
