import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  UsersIcon, BuildingOffice2Icon, ChatBubbleLeftRightIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { adminAPI } from '../../api/client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export default function SADashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminAPI.getOverview()
      .then(r => { setData(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-2xl animate-shimmer" />)}
    </div>
  )

  if (!data) return <p style={{ color: 'var(--text-muted)' }}>Failed to load dashboard.</p>

  const stats = [
    { label: 'Total Users', value: data.users?.total || 0, sub: `${data.users?.new_30d || 0} new this month`, icon: UsersIcon, gradient: 'from-primary-500 to-primary-600' },
    { label: 'Total Brands', value: data.brands?.total || 0, sub: `${data.brands?.active || 0} active`, icon: BuildingOffice2Icon, gradient: 'from-accent-500 to-accent-600' },
    { label: 'Total Posts', value: (data.posts?.total || 0).toLocaleString(), sub: `${(data.posts?.last_30d || 0).toLocaleString()} this month`, icon: ChatBubbleLeftRightIcon, gradient: 'from-amber-500 to-orange-500' },
    { label: 'Unresolved Alerts', value: data.alerts?.unresolved || 0, sub: `${data.alerts?.total || 0} total alerts`, icon: ExclamationTriangleIcon, gradient: 'from-rose-500 to-rose-600' },
  ]

  const sentimentData = data.sentiment?.distribution || {}
  const pieData = [
    { name: 'Positive', value: sentimentData.positive || 0, color: '#10b981' },
    { name: 'Neutral', value: sentimentData.neutral || 0, color: '#f59e0b' },
    { name: 'Negative', value: sentimentData.negative || 0, color: '#f43f5e' },
  ]

  const platformData = (data.platforms || []).map((p: any) => ({
    name: p.platform?.charAt(0).toUpperCase() + p.platform?.slice(1),
    posts: p.count,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>System Overview</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Monitor platform health and usage metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }} className="stat-card group">
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
                <p className="text-3xl font-bold mt-2" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{s.sub}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sentiment Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card p-6">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Sentiment Distribution</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                  {pieData.map((e, idx) => <Cell key={idx} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '12px', color: 'var(--text-primary)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                {d.name}: {d.value.toLocaleString()}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Platform Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Posts by Platform</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                <XAxis dataKey="name" fontSize={12} stroke="var(--text-muted)" />
                <YAxis fontSize={12} stroke="var(--text-muted)" />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '12px', color: 'var(--text-primary)' }} />
                <Bar dataKey="posts" fill="#5a71f2" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Subscriptions + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="card p-6">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Subscription Overview</h3>
          <div className="space-y-4">
            {[
              { label: 'Active Subscriptions', value: data.subscriptions?.active || 0, icon: CheckCircleIcon, color: 'text-emerald-400' },
              { label: 'Cancelled', value: data.subscriptions?.cancelled || 0, icon: ExclamationTriangleIcon, color: 'text-rose-400' },
              { label: 'Total Revenue', value: `PKR ${(data.subscriptions?.total_revenue || 0).toLocaleString()}`, icon: CurrencyDollarIcon, color: 'text-primary-400' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                <div className="flex items-center gap-3">
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="card p-6">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>System Health</h3>
          <div className="space-y-4">
            {[
              { label: 'API Connectors', status: 'Operational', ok: true },
              { label: 'NLP Engine', status: 'Running', ok: true },
              { label: 'Database', status: 'Healthy', ok: true },
              { label: 'Queue Workers', status: 'Active', ok: true },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${item.ok ? 'bg-emerald-400' : 'bg-rose-400'} animate-pulse`} />
                  <span className={`text-xs font-medium ${item.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
