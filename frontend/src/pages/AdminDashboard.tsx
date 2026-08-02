import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  UsersIcon, BellAlertIcon,
  CreditCardIcon, EnvelopeIcon,
  ShieldCheckIcon, PaperAirplaneIcon, TrashIcon, MagnifyingGlassIcon,
  CheckCircleIcon, XCircleIcon, ArrowPathIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'
import { adminAPI } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { DashboardSkeleton } from '../components/LoadingSkeleton'

type Tab = 'overview' | 'users' | 'smtp' | 'stripe' | 'notifications' | 'audit'

const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: ChartBarIcon },
  { id: 'users', label: 'Users', icon: UsersIcon },
  { id: 'notifications', label: 'Notifications', icon: BellAlertIcon },
  { id: 'smtp', label: 'Email / SMTP', icon: EnvelopeIcon },
  { id: 'stripe', label: 'Stripe', icon: CreditCardIcon },
  { id: 'audit', label: 'Audit Logs', icon: ShieldCheckIcon },
]

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const { user } = useAuthStore()

  if (user?.role !== 'admin' && !user?.is_staff) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <ShieldCheckIcon className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Admin privileges required.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Admin Dashboard</h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>System management & configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 pb-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === t.id
                ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                : ''
            }`}
            style={activeTab !== t.id ? { color: 'var(--text-secondary)' } : undefined}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'notifications' && <NotificationsTab />}
      {activeTab === 'smtp' && <SMTPTab />}
      {activeTab === 'stripe' && <StripeTab />}
      {activeTab === 'audit' && <AuditTab />}
    </div>
  )
}

/* ─── OVERVIEW TAB ──────────────────────────────────────────── */
function OverviewTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminAPI.getOverview().then(r => { setData(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <DashboardSkeleton />
  if (!data) return <p style={{ color: 'var(--text-muted)' }}>Failed to load dashboard.</p>

  const stats = [
    { label: 'Total Users', value: data.users.total, sub: `${data.users.new_30d} new (30d)`, color: 'from-primary-500 to-primary-600' },
    { label: 'Total Brands', value: data.brands.total, sub: `${data.brands.active} active`, color: 'from-accent-500 to-accent-600' },
    { label: 'Total Posts', value: data.posts.total.toLocaleString(), sub: `${data.posts.last_30d.toLocaleString()} (30d)`, color: 'from-amber-500 to-orange-600' },
    { label: 'Unresolved Alerts', value: data.alerts.unresolved, sub: `${data.alerts.total} total`, color: 'from-rose-500 to-rose-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="stat-card">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${s.color} opacity-10 rounded-bl-[60px]`} />
            <p className="text-sm relative z-10" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
            <p className="text-3xl font-bold mt-1 relative z-10" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
            <p className="text-xs mt-1 relative z-10" style={{ color: 'var(--text-muted)' }}>{s.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Sentiment & Subscriptions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Sentiment Distribution</h3>
          <div className="space-y-3">
            {(['positive', 'neutral', 'negative'] as const).map(s => {
              const count = data.sentiment.distribution[s] || 0
              const total = Object.values(data.sentiment.distribution as Record<string, number>).reduce((a: number, b: number) => a + b, 0)
              const pct = total > 0 ? (count / total) * 100 : 0
              const colors: Record<string, string> = { positive: 'bg-emerald-500', neutral: 'bg-amber-500', negative: 'bg-rose-500' }
              return (
                <div key={s}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize" style={{ color: 'var(--text-secondary)' }}>{s}</span>
                    <span className="font-medium">{count.toLocaleString()} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                    <div className={`h-full ${colors[s]} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-semibold mb-4">Subscriptions</h3>
          <div className="space-y-3">
            <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Active</span><span className="font-medium text-emerald-400">{data.subscriptions.active}</span></div>
            <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Cancelled</span><span className="font-medium text-rose-400">{data.subscriptions.cancelled}</span></div>
            <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Revenue</span><span className="font-medium text-primary-400">PKR {data.subscriptions.total_revenue.toLocaleString()}</span></div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-semibold mb-4">Platform Distribution</h3>
          <div className="space-y-2">
            {(data.platforms || []).slice(0, 5).map((p: any) => (
              <div key={p.platform} className="flex justify-between text-sm">
                <span className="capitalize" style={{ color: 'var(--text-secondary)' }}>{p.platform}</span>
                <span className="font-medium">{p.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── USERS TAB ─────────────────────────────────────────────── */
function UsersTab() {
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    adminAPI.getUsers(search).then(r => { setUsers(r.data.users); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [search])

  const doAction = async (id: number, action: string) => {
    try {
      await adminAPI.userAction(id, action)
      toast.success(`User ${action} successful`)
      load()
    } catch { toast.error('Action failed') }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search users by name or email..."
          className="input w-full pl-10" />
      </div>

      {loading ? (
        <div className="card p-8 text-center"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" /></div>
      ) : (
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)', color: 'var(--text-muted)' }} className="text-left">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Brands</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody style={{ borderColor: 'var(--border-primary)' }} className="divide-y">
              {users.map(u => (
                <tr key={u.id} className="transition-colors" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.full_name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      u.role === 'admin' ? 'bg-primary-500/20 text-primary-400'
                        : u.role === 'analyst' ? 'bg-accent-500/20 text-accent-400'
                        : 'bg-gray-500/10'
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 capitalize" style={{ color: 'var(--text-secondary)' }}>{u.subscription_plan}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{u.brands_count}</td>
                  <td className="px-4 py-3">
                    {u.is_active
                      ? <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircleIcon className="w-4 h-4" />Active</span>
                      : <span className="flex items-center gap-1 text-rose-400 text-xs"><XCircleIcon className="w-4 h-4" />Inactive</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {u.is_active ? (
                        <button onClick={() => doAction(u.id, 'deactivate')}
                          className="px-2 py-1 text-xs rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20">
                          Deactivate
                        </button>
                      ) : (
                        <button onClick={() => doAction(u.id, 'activate')}
                          className="px-2 py-1 text-xs rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                          Activate
                        </button>
                      )}
                      <select onChange={e => { if (e.target.value) { doAction(u.id, e.target.value); e.target.value = '' } }}
                        className="px-2 py-1 text-xs rounded-lg border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                        <option value="">Role</option>
                        <option value="make_admin">Admin</option>
                        <option value="make_analyst">Analyst</option>
                        <option value="make_viewer">Viewer</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  )
}

/* ─── NOTIFICATIONS TAB ─────────────────────────────────────── */
function NotificationsTab() {
  const [notifs, setNotifs] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, unread: 0 })
  const [showSend, setShowSend] = useState(false)
  const [form, setForm] = useState({ title: '', message: '', type: 'info', target: 'all' })
  const [selected, setSelected] = useState<number[]>([])

  const load = () => {
    adminAPI.getNotifications().then(r => {
      setNotifs(r.data.notifications)
      setStats({ total: r.data.total, unread: r.data.unread })
    })
  }

  useEffect(() => { load() }, [])

  const sendNotif = async () => {
    if (!form.title || !form.message) return toast.error('Title and message required')
    try {
      await adminAPI.sendNotification(form)
      toast.success('Notification sent!')
      setShowSend(false)
      setForm({ title: '', message: '', type: 'info', target: 'all' })
      load()
    } catch { toast.error('Failed to send') }
  }

  const deleteSelected = async () => {
    if (selected.length === 0) return
    try {
      await adminAPI.deleteNotifications(selected)
      toast.success(`Deleted ${selected.length} notifications`)
      setSelected([])
      load()
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span className="text-gray-400">Total: <strong className="text-white">{stats.total}</strong></span>
          <span className="text-gray-400">Unread: <strong className="text-amber-400">{stats.unread}</strong></span>
        </div>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <button onClick={deleteSelected}
              className="flex items-center gap-1 px-3 py-2 text-sm rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20">
              <TrashIcon className="w-4 h-4" /> Delete ({selected.length})
            </button>
          )}
          <button onClick={() => setShowSend(!showSend)}
            className="flex items-center gap-1 btn-primary text-sm">
            <PaperAirplaneIcon className="w-4 h-4" /> Broadcast
          </button>
        </div>
      </div>

      {/* Send form */}
      {showSend && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="card p-5 space-y-3">
          <h3 className="font-semibold">Send Notification</h3>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input" />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="input">
              <option value="info">Info</option><option value="success">Success</option>
              <option value="warning">Warning</option><option value="alert">Alert</option>
            </select>
          </div>
          <textarea placeholder="Message" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="input w-full h-20 resize-none" />
          <div className="flex gap-2">
            <button onClick={() => setShowSend(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={sendNotif} className="btn-primary text-sm">Send to All Users</button>
          </div>
        </motion.div>
      )}

      {/* Notifications list */}
      <div className="card overflow-hidden divide-y divide-dark-800/50">
        {notifs.length === 0 ? (
          <div className="py-12 text-center text-gray-500">No notifications</div>
        ) : notifs.map(n => (
          <div key={n.id} className="px-4 py-3 flex items-center gap-3 hover:bg-dark-800/30">
            <input type="checkbox" checked={selected.includes(n.id)}
              onChange={e => setSelected(e.target.checked ? [...selected, n.id] : selected.filter(i => i !== n.id))}
              className="w-4 h-4 rounded border-dark-600 bg-dark-800" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  n.type === 'alert' ? 'bg-rose-500/10 text-rose-400'
                    : n.type === 'warning' ? 'bg-amber-500/10 text-amber-400'
                    : n.type === 'success' ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-primary-500/10 text-primary-400'
                }`}>{n.type}</span>
                <span className="text-sm font-medium truncate">{n.title}</span>
                <span className="text-[10px] text-gray-600 ml-auto flex-shrink-0">{n.user_email}</span>
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">{n.message}</p>
            </div>
            {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── SETTINGS FORM HELPER ──────────────────────────────────── */
function SettingsForm({ title, icon: Icon, fields, loadFn, saveFn, testFn }: {
  title: string; icon: any
  fields: { key: string; label: string; type?: string; placeholder?: string }[]
  loadFn: () => Promise<any>
  saveFn: (data: any) => Promise<any>
  testFn?: () => Promise<any>
}) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadFn().then(r => { setForm(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await saveFn(form)
      toast.success(`${title} updated!`)
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const test = async () => {
    try {
      const r = await testFn!()
      toast.success(r.data.message || 'Test successful!')
    } catch (e: any) { toast.error(e.response?.data?.error || 'Test failed') }
  }

  if (loading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-12 bg-dark-800 rounded-xl" />)}</div>

  return (
    <div className="card p-6 space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-gray-500">Configure integration settings</p>
        </div>
      </div>

      <div className="space-y-4">
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-sm text-gray-400 mb-1.5">{f.label}</label>
            {f.type === 'toggle' ? (
              <button onClick={() => setForm({ ...form, [f.key]: form[f.key] === 'true' ? 'false' : 'true' })}
                className={`relative w-12 h-6 rounded-full transition-colors ${form[f.key] === 'true' ? 'bg-primary-500' : 'bg-dark-700'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${form[f.key] === 'true' ? 'left-6' : 'left-0.5'}`} />
              </button>
            ) : (
              <input type={f.type || 'text'} value={form[f.key] || ''} placeholder={f.placeholder}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                className="input w-full" />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={save} disabled={saving} className="btn-primary text-sm">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {testFn && (
          <button onClick={test} className="btn-secondary text-sm flex items-center gap-1">
            <ArrowPathIcon className="w-4 h-4" /> Test Connection
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── SMTP TAB ──────────────────────────────────────────────── */
function SMTPTab() {
  return <SettingsForm title="Email / SMTP Settings" icon={EnvelopeIcon}
    loadFn={adminAPI.getSMTP} saveFn={adminAPI.updateSMTP} testFn={() => adminAPI.testSMTP()}
    fields={[
      { key: 'smtp_enabled', label: 'Enable Email', type: 'toggle' },
      { key: 'smtp_host', label: 'SMTP Host', placeholder: 'smtp.gmail.com' },
      { key: 'smtp_port', label: 'SMTP Port', placeholder: '587' },
      { key: 'smtp_username', label: 'Username / Email', placeholder: 'your@email.com' },
      { key: 'smtp_password', label: 'Password', type: 'password' },
      { key: 'smtp_from_email', label: 'From Email', placeholder: 'noreply@echolens.com' },
      { key: 'smtp_from_name', label: 'From Name', placeholder: 'Echo Lens' },
      { key: 'smtp_use_tls', label: 'Use TLS', type: 'toggle' },
    ]}
  />
}


/* ─── STRIPE TAB ────────────────────────────────────────────── */
function StripeTab() {
  return <SettingsForm title="Stripe Payment Settings" icon={CreditCardIcon}
    loadFn={adminAPI.getStripe} saveFn={adminAPI.updateStripe}
    fields={[
      { key: 'stripe_enabled', label: 'Enable Stripe Payments', type: 'toggle' },
      { key: 'stripe_publishable_key', label: 'Publishable Key', placeholder: 'pk_test_...' },
      { key: 'stripe_secret_key', label: 'Secret Key', type: 'password', placeholder: 'sk_test_...' },
      { key: 'stripe_webhook_secret', label: 'Webhook Secret', type: 'password', placeholder: 'whsec_...' },
      { key: 'stripe_currency', label: 'Currency', placeholder: 'usd' },
    ]}
  />
}

/* ─── AUDIT LOG TAB ─────────────────────────────────────────── */
function AuditTab() {
  const [logs, setLogs] = useState<any[]>([])
  useEffect(() => { adminAPI.getAuditLogs().then(r => setLogs(r.data.logs)).catch(() => {}) }, [])

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-800"><h3 className="font-semibold">Audit Logs</h3></div>
      <div className="divide-y divide-dark-800/50 max-h-[500px] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="py-12 text-center text-gray-500">No audit logs</div>
        ) : logs.map(l => (
          <div key={l.id} className="px-5 py-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-dark-800 text-gray-400">{l.action}</span>
                <span className="font-medium">{l.description}</span>
              </div>
              <span className="text-xs text-gray-600">{new Date(l.created_at).toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">by {l.user} — target: {l.target}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
