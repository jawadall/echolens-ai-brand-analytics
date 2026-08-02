/**
 * PlatformComparison — Side-by-side bar chart comparing platform metrics
 */
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { motion } from 'framer-motion'

interface PlatformComparisonProps {
  platformBreakdown: Record<string, number>
  posts: Array<{ platform: string; likes?: number; shares?: number; comments?: number; views?: number; sentiment_score?: number | null; [key: string]: any }>
}

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#f43f5e',
  reddit: '#f97316',
  twitter: '#38bdf8',
  facebook: '#3b82f6',
  news: '#10b981',
}

export default function PlatformComparison({ platformBreakdown, posts }: PlatformComparisonProps) {
  // Compute metrics per platform
  const metrics = Object.entries(platformBreakdown).map(([platform, count]) => {
    const platformPosts = posts.filter(p => p.platform === platform)
    const totalEngagement = platformPosts.reduce((sum, p) => sum + (p.likes || 0) + (p.shares || 0) + (p.comments || 0), 0)
    const avgSentiment = platformPosts.length > 0
      ? platformPosts.reduce((sum, p) => sum + (p.sentiment_score || 0), 0) / platformPosts.length
      : 0

    return {
      platform: platform.charAt(0).toUpperCase() + platform.slice(1),
      posts: count,
      engagement: totalEngagement,
      avgSentiment: Math.round(avgSentiment * 100),
    }
  }).filter(m => m.posts > 0)

  if (metrics.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No platform data available</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={metrics} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
          <XAxis dataKey="platform" fontSize={11} stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)' }} />
          <YAxis fontSize={10} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-primary)',
              borderRadius: '12px',
              color: 'var(--text-primary)',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'var(--text-secondary)' }}
            itemStyle={{ color: 'var(--text-primary)' }}
          />
          <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '11px' }} />
          <Bar dataKey="posts" name="Posts" fill="#5a71f2" radius={[4, 4, 0, 0]} />
          <Bar dataKey="engagement" name="Engagement" fill="#15b79e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Platform cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-4">
        {metrics.map((m) => {
          const key = m.platform.toLowerCase()
          const color = PLATFORM_COLORS[key] || '#5a71f2'
          return (
            <div key={key} className="p-3 rounded-xl text-center" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
              <div className="w-2 h-2 rounded-full mx-auto mb-1.5" style={{ backgroundColor: color }} />
              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{m.platform}</p>
              <p className="text-lg font-bold mt-1" style={{ color }}>{m.posts}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>posts</p>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
