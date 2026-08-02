import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  UsersIcon,
  RectangleStackIcon,
  DocumentTextIcon,
  ArrowTrendingUpIcon,
  Cog6ToothIcon,
  ChartPieIcon,
  BuildingOffice2Icon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import { adminAPI, authAPI } from '../../api/client'
import { useAuthStore } from '../../store/authStore'

export default function CompanyOverview() {
  const { user, setAuth, accessToken, refreshToken: rToken } = useAuthStore()
  const companyId = user?.company_info?.id
  const [usage, setUsage] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Create business form state
  const [bizName, setBizName] = useState('')
  const [bizIndustry, setBizIndustry] = useState('')
  const [bizWebsite, setBizWebsite] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (companyId) {
      loadData()
    } else {
      setLoading(false)
    }
  }, [companyId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [usageRes, membersRes] = await Promise.all([
        adminAPI.getCompanyUsage(companyId!),
        adminAPI.getCompanyUsers(companyId!),
      ])
      setUsage(usageRes.data)
      setMembers(membersRes.data.users || [])
    } catch {
      // errors handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBusiness = async () => {
    if (!bizName.trim()) {
      toast.error('Business name is required')
      return
    }
    setCreating(true)
    try {
      await adminAPI.createCompany({
        name: bizName.trim(),
        industry: bizIndustry.trim(),
        website: bizWebsite.trim(),
        plan: 'free',
        owner_id: user?.id,
      })
      toast.success(`"${bizName}" created successfully!`)

      // Refresh user profile to pick up the new company_info
      try {
        const profileRes = await authAPI.getProfile()
        setAuth(profileRes.data, accessToken || '', rToken || '')
      } catch {}

      // Reload the page to reflect the new business
      window.location.reload()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create business')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  // ── No business yet — show onboarding ────────────────────────
  if (!companyId) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8 max-w-lg w-full text-center"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mb-5">
            <BuildingOffice2Icon className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-display font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Create Your Business
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Set up your business to start managing brands, invite team members, and unlock powerful analytics.
          </p>

          <div className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Business Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={bizName}
                onChange={e => setBizName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="input w-full"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Industry
              </label>
              <select value={bizIndustry} onChange={e => setBizIndustry(e.target.value)} className="input w-full">
                <option value="">Select Industry</option>
                {['Technology', 'Marketing', 'E-Commerce', 'Finance', 'Healthcare', 'Education', 'Media', 'Retail', 'Other'].map(i => (
                  <option key={i} value={i.toLowerCase()}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Website
              </label>
              <input
                type="url"
                value={bizWebsite}
                onChange={e => setBizWebsite(e.target.value)}
                placeholder="https://example.com"
                className="input w-full"
              />
            </div>
          </div>

          <button
            onClick={handleCreateBusiness}
            disabled={creating || !bizName.trim()}
            className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
          >
            {creating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <PlusIcon className="w-4 h-4" />
                Create Business
              </>
            )}
          </button>
        </motion.div>
      </div>
    )
  }

  const usageData = usage?.usage
  const plan = usage?.plan
  const features = usage?.features

  const statCards = [
    { label: 'Brands', used: usageData?.brands?.used || 0, limit: usageData?.brands?.limit || 1, icon: RectangleStackIcon, color: 'from-indigo-500 to-purple-500' },
    { label: 'Team Members', used: usageData?.users?.used || 0, limit: usageData?.users?.limit || 2, icon: UsersIcon, color: 'from-emerald-500 to-teal-500' },
    { label: 'Posts This Month', used: usageData?.posts_this_month?.used || 0, limit: usageData?.posts_this_month?.limit || 500, icon: DocumentTextIcon, color: 'from-amber-500 to-orange-500' },
    { label: 'Exports This Month', used: usageData?.exports_this_month?.used || 0, limit: usageData?.exports_this_month?.limit || 2, icon: ArrowTrendingUpIcon, color: 'from-rose-500 to-pink-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          Business Overview
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Welcome back! Here's your business current status on the{' '}
          <span className="font-semibold text-indigo-400">{plan?.display_name || 'Free'}</span> plan.
        </p>
      </div>

      {/* Usage Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const pct = Math.min((card.used / card.limit) * 100, 100)
          const isNearLimit = pct >= 80
          const isAtLimit = pct >= 100
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="card p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  isAtLimit ? 'bg-rose-500/10 text-rose-400' : isNearLimit ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                }`}>
                  {pct.toFixed(0)}%
                </span>
              </div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {card.used} <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>/ {card.limit}</span>
              </p>
              {/* Progress bar */}
              <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{
                    background: isAtLimit
                      ? 'linear-gradient(90deg, #f43f5e, #fb923c)'
                      : isNearLimit
                        ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                        : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                  }}
                />
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Quick Links + Recent Members */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Links */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label: 'Manage Team Members', href: '/company/members', icon: UsersIcon, desc: 'Invite, edit roles, or remove members' },
              { label: 'View Usage & Billing', href: '/company/usage', icon: ChartPieIcon, desc: 'Monitor resource usage and plan limits' },
              { label: 'Company Settings', href: '/company/settings', icon: Cog6ToothIcon, desc: 'Notifications, SMTP, alert preferences' },
            ].map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.01]"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <link.icon className="w-4.5 h-4.5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{link.label}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{link.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Recent Members */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Team Members</h3>
            <Link to="/company/members" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">View All</Link>
          </div>
          <div className="space-y-2">
            {members.slice(0, 5).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    {m.full_name?.[0]?.toUpperCase() || m.email?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {m.full_name || m.email}
                      {m.is_owner && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Owner</span>}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{m.email}</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  m.role === 'admin' ? 'bg-indigo-500/10 text-indigo-400' :
                  m.role === 'analyst' ? 'bg-emerald-500/10 text-emerald-400' :
                  'bg-gray-500/10 text-gray-400'
                }`}>{m.role}</span>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-center py-6 text-xs" style={{ color: 'var(--text-muted)' }}>No team members yet</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Features */}
      {features && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="card p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Plan Features</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(features).map(([key, enabled]) => (
              <div key={key}
                className="flex items-center gap-2 p-2.5 rounded-lg text-xs"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${enabled ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                <span className="capitalize" style={{ color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {key.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
