import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ExclamationTriangleIcon,
  ArrowUpCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

interface UpgradeBannerProps {
  type: 'brands' | 'users'
  current: number
  limit: number
  plan: string
}

export default function UpgradeBanner({ type, current, limit, plan }: UpgradeBannerProps) {
  const navigate = useNavigate()
  const percentage = Math.min((current / limit) * 100, 100)
  const isAtLimit = current >= limit
  const isNearLimit = current >= limit * 0.8

  if (!isNearLimit) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: isAtLimit
          ? 'linear-gradient(135deg, rgba(244,63,94,0.12), rgba(251,146,60,0.08))'
          : 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.06))',
        border: `1px solid ${isAtLimit ? 'rgba(244,63,94,0.25)' : 'rgba(251,191,36,0.2)'}`,
      }}
    >
      <div className="px-4 py-3.5 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: isAtLimit ? 'rgba(244,63,94,0.15)' : 'rgba(251,191,36,0.15)',
          }}
        >
          {isAtLimit ? (
            <ExclamationTriangleIcon className="w-5 h-5 text-rose-400" />
          ) : (
            <ArrowUpCircleIcon className="w-5 h-5 text-amber-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {isAtLimit
              ? `${type === 'brands' ? 'Brand' : 'User'} limit reached`
              : `Approaching ${type} limit`}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {current}/{limit} {type} used on your <strong>{plan.charAt(0).toUpperCase() + plan.slice(1)}</strong> plan.
            {isAtLimit
              ? ` Upgrade to add more ${type}.`
              : ` You're using ${percentage.toFixed(0)}% of your allowance.`}
          </p>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{
                background: isAtLimit
                  ? 'linear-gradient(90deg, #f43f5e, #fb923c)'
                  : 'linear-gradient(90deg, #fbbf24, #f59e0b)',
              }}
            />
          </div>
        </div>

        <button
          onClick={() => navigate('/subscription')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-white flex-shrink-0 transition-all hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
          }}
        >
          <SparklesIcon className="w-3.5 h-3.5" />
          Upgrade
        </button>
      </div>
    </motion.div>
  )
}
