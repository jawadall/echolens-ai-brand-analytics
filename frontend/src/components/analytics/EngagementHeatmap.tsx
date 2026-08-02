/**
 * EngagementHeatmap — Visual heatmap showing engagement by day/hour
 * Uses CSS Grid with animated cells
 */
import { motion } from 'framer-motion'
import { useMemo } from 'react'

interface EngagementHeatmapProps {
  posts: Array<{ posted_at: string; likes?: number; shares?: number; comments?: number; views?: number }>
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = ['12a', '2a', '4a', '6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p']

export default function EngagementHeatmap({ posts }: EngagementHeatmapProps) {
  const heatmapData = useMemo(() => {
    // Initialize 7x12 grid (7 days, 12 two-hour slots)
    const grid: number[][] = Array.from({ length: 7 }, () => Array(12).fill(0))
    const counts: number[][] = Array.from({ length: 7 }, () => Array(12).fill(0))

    posts.forEach((post) => {
      try {
        const date = new Date(post.posted_at)
        const day = date.getDay()
        const hourSlot = Math.floor(date.getHours() / 2)
        const engagement = (post.likes || 0) + (post.shares || 0) * 2 + (post.comments || 0) * 3
        grid[day][hourSlot] += engagement || 1
        counts[day][hourSlot]++
      } catch {}
    })

    // Normalize: average per cell
    let maxVal = 0
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 12; h++) {
        if (counts[d][h] > 0) grid[d][h] = grid[d][h] / counts[d][h]
        maxVal = Math.max(maxVal, grid[d][h])
      }
    }

    return { grid, maxVal, counts }
  }, [posts])

  if (posts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No post data for heatmap</p>
      </div>
    )
  }

  const getColor = (value: number, max: number) => {
    if (max === 0 || value === 0) return 'var(--bg-elevated)'
    const intensity = value / max
    if (intensity > 0.8) return '#10b981'
    if (intensity > 0.6) return '#34d399'
    if (intensity > 0.4) return '#5a71f2'
    if (intensity > 0.2) return '#818cf8'
    return '#5a71f233'
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Hour labels */}
          <div className="grid gap-0.5 ml-10" style={{ gridTemplateColumns: `repeat(12, 1fr)` }}>
            {HOURS.map((h) => (
              <div key={h} className="text-center text-[9px] pb-1" style={{ color: 'var(--text-muted)' }}>{h}</div>
            ))}
          </div>

          {/* Grid rows */}
          {DAYS.map((day, dayIdx) => (
            <div key={day} className="flex items-center gap-0.5 mb-0.5">
              <div className="w-10 text-right pr-2 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{day}</div>
              <div className="grid gap-0.5 flex-1" style={{ gridTemplateColumns: `repeat(12, 1fr)` }}>
                {heatmapData.grid[dayIdx].map((value, hourIdx) => (
                  <motion.div
                    key={`${dayIdx}-${hourIdx}`}
                    className="rounded-sm cursor-pointer relative group"
                    style={{
                      aspectRatio: '1.6',
                      backgroundColor: getColor(value, heatmapData.maxVal),
                      minHeight: '18px',
                    }}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (dayIdx * 12 + hourIdx) * 0.005 }}
                    whileHover={{ scale: 1.3, zIndex: 10 }}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-lg text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>
                      {day} {HOURS[hourIdx]}: {heatmapData.counts[dayIdx][hourIdx]} posts
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-3">
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Less</span>
        {['var(--bg-elevated)', '#5a71f233', '#818cf8', '#5a71f2', '#34d399', '#10b981'].map((color, i) => (
          <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
        ))}
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>More</span>
      </div>
    </div>
  )
}
