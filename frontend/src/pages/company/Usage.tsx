import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  RectangleStackIcon,
  UsersIcon,
  DocumentTextIcon,
  ArrowUpTrayIcon,
  CheckIcon,
  XMarkIcon as XIcon,
  ArrowUpCircleIcon,
} from '@heroicons/react/24/outline'
import { adminAPI } from '../../api/client'
import { useAuthStore } from '../../store/authStore'

export default function CompanyUsage() {
  const { user } = useAuthStore()
  const companyId = user?.company_info?.id
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (companyId) load()
  }, [companyId])

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.getCompanyUsage(companyId!)
      setData(res.data)
    } catch {} finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const usage = data?.usage
  const features = data?.features
  const plan = data?.plan

  const meters = [
    { key: 'brands', label: 'Brands', icon: RectangleStackIcon, gradient: 'from-indigo-500 to-purple-500', data: usage?.brands },
    { key: 'users', label: 'Team Members', icon: UsersIcon, gradient: 'from-emerald-500 to-teal-500', data: usage?.users },
    { key: 'posts', label: 'Posts Fetched', icon: DocumentTextIcon, gradient: 'from-amber-500 to-orange-500', data: usage?.posts_this_month },
    { key: 'exports', label: 'Exports', icon: ArrowUpTrayIcon, gradient: 'from-rose-500 to-pink-500', data: usage?.exports_this_month },
  ]

  const featureList = [
    { key: 'advanced_analytics', label: 'Advanced Analytics', desc: 'Detailed sentiment breakdowns, trends, and topic analysis' },
    { key: 'competitor_analysis', label: 'Competitor Analysis', desc: 'Compare brand performance against competitors' },
    { key: 'custom_alerts', label: 'Custom Alerts', desc: 'Set custom thresholds and notification rules' },
    { key: 'ai_insights', label: 'AI Insights', desc: 'AI-powered recommendations and summaries' },
    { key: 'api_access', label: 'API Access', desc: 'Programmatic access to your brand data' },
    { key: 'priority_support', label: 'Priority Support', desc: 'Dedicated support with faster response times' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Usage & Billing</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Monitor your resource usage and plan limits
          </p>
        </div>
        <Link to="/subscription" className="btn-primary flex items-center gap-2 self-start">
          <ArrowUpCircleIcon className="w-4 h-4" />
          Upgrade Plan
        </Link>
      </div>

      {/* Current Plan Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
              {plan?.display_name?.[0] || 'F'}
            </div>
            <div>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{plan?.display_name || 'Free'} Plan</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Current billing period resets monthly</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Active
          </div>
        </div>
      </motion.div>

      {/* Usage Meters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {meters.map((meter, i) => {
          const used = meter.data?.used || 0
          const limit = meter.data?.limit || 1
          const isUnlimited = limit === -1
          const pct = isUnlimited ? 0 : Math.min((used / limit) * 100, 100)
          const isNear = !isUnlimited && pct >= 80
          const isAt = !isUnlimited && pct >= 100

          return (
            <motion.div
              key={meter.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="card p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meter.gradient} flex items-center justify-center`}>
                  <meter.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{meter.label}</h4>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {isUnlimited ? 'Custom API — Unlimited' : (meter.key === 'posts' || meter.key === 'exports' ? 'Resets monthly' : 'Based on plan')}
                  </p>
                </div>
              </div>

              {/* Large number */}
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{used.toLocaleString()}</span>
                {isUnlimited ? (
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                    Unlimited
                  </span>
                ) : (
                  <>
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/ {limit.toLocaleString()}</span>
                    <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isAt ? 'bg-rose-500/10 text-rose-400' : isNear ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {pct.toFixed(0)}% used
                    </span>
                  </>
                )}
              </div>

              {/* Progress */}
              {!isUnlimited && (
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: i * 0.15 }}
                    className="h-full rounded-full transition-all"
                    style={{
                      background: isAt ? 'linear-gradient(90deg, #f43f5e, #fb923c)' :
                        isNear ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' :
                        `linear-gradient(90deg, var(--tw-gradient-stops))`,
                      '--tw-gradient-from': meter.gradient.includes('indigo') ? '#6366f1' : meter.gradient.includes('emerald') ? '#10b981' : meter.gradient.includes('amber') ? '#f59e0b' : '#f43f5e',
                      '--tw-gradient-to': meter.gradient.includes('purple') ? '#8b5cf6' : meter.gradient.includes('teal') ? '#14b8a6' : meter.gradient.includes('orange') ? '#f97316' : '#ec4899',
                    } as React.CSSProperties}
                  />
                </div>
              )}
              {isUnlimited && (
                <div className="h-2.5 rounded-full overflow-hidden bg-gradient-to-r from-emerald-500/20 to-teal-500/20" />
              )}

              {isAt && (
                <p className="text-xs mt-2 text-rose-400">
                  Limit reached. <Link to="/subscription" className="underline hover:text-rose-300">Upgrade</Link> to increase this limit.
                </p>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Features */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="card p-5">
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Plan Features</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {featureList.map((f) => {
            const enabled = features?.[f.key] || false
            return (
              <div key={f.key}
                className="flex items-start gap-3 p-3.5 rounded-xl transition-all"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', opacity: enabled ? 1 : 0.5 }}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  enabled ? 'bg-emerald-500/20' : 'bg-gray-500/20'
                }`}>
                  {enabled
                    ? <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                    : <XIcon className="w-3.5 h-3.5 text-gray-500" />}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>{f.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 pt-4 text-center" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <Link to="/subscription" className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">
            Compare all plans and upgrade
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
