import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { connectorsAPI } from '../api/client'

interface ConnectorInfo {
  available: boolean
  type: string
  note: string
  quota?: {
    used: number
    limit: number
    remaining: number
  } | null
}

const PLATFORM_META: Record<string, { label: string; icon: string; color: string }> = {
  youtube: { label: 'YouTube', icon: '▶', color: 'text-red-400' },
  reddit: { label: 'Reddit', icon: '◉', color: 'text-orange-400' },
  twitter: { label: 'Twitter/X', icon: '𝕏', color: 'text-sky-400' },
  news: { label: 'News', icon: '📰', color: 'text-emerald-400' },
  facebook: { label: 'Facebook', icon: 'f', color: 'text-blue-400' },
}

export default function ConnectorStatus() {
  const [connectors, setConnectors] = useState<Record<string, ConnectorInfo> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await connectorsAPI.getStatus()
        setConnectors(res.data)
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchStatus()
  }, [])

  if (loading || !connectors) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
        Data Connectors
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {Object.entries(connectors).map(([key, info]) => {
          const meta = PLATFORM_META[key] || { label: key, icon: '?', color: 'text-gray-400' }
          return (
            <div
              key={key}
              className="flex items-center gap-3 p-3 rounded-xl transition-all"
              style={{
                background: info.available ? 'var(--bg-elevated)' : 'var(--bg-secondary)',
                border: `1px solid ${info.available ? 'var(--border-primary)' : 'var(--border-primary)'}`,
                opacity: info.available ? 1 : 0.6,
              }}
            >
              <span className={`text-lg font-bold ${meta.color}`}>{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{meta.label}</div>
                <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{info.type}</div>
              </div>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${info.available ? 'bg-emerald-400' : 'bg-gray-500'}`} />
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
