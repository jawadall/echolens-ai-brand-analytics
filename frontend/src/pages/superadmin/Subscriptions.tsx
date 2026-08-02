/* SuperAdmin Subscription Management */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon, PencilIcon, TrashIcon, PlusIcon,
  XMarkIcon, CurrencyDollarIcon, UserGroupIcon,
  ChartBarIcon, ArrowPathIcon, XCircleIcon,
  ChevronDownIcon, BuildingOffice2Icon,
} from '@heroicons/react/24/outline'
import { adminAPI } from '../../api/client'

interface Plan {
  id: number; name: string; display_name: string; description: string
  price_monthly: string; price_yearly: string; currency: string
  max_brands: number; max_posts_per_month: number; max_exports_per_month: number
  data_retention_days: number; features: string[]
  has_api_access: boolean; has_advanced_analytics: boolean
  has_competitor_analysis: boolean; has_custom_alerts: boolean
  has_ai_insights: boolean; has_priority_support: boolean
  is_popular: boolean; is_active: boolean; sort_order: number
  active_subscribers: number; total_subscribers: number; monthly_revenue: number
}

interface BusinessSub {
  id: number
  company_name: string; industry: string; plan: string; status: string
  owner: { id: number; email: string; first_name: string; last_name: string } | null
  subscription: {
    id: number; plan_display: string; status: string; billing_cycle: string
    started_at: string; expires_at: string; cancelled_at: string | null
  } | null
  members: { id: number; email: string; first_name: string; last_name: string; role: string; is_active: boolean }[]
  members_count: number; brands_used: number; posts_this_month: number
  max_brands: number; max_users: number; created_at: string
}

const EMPTY_PLAN = {
  display_name: '', description: '', price_monthly: '0', price_yearly: '0',
  currency: 'PKR', max_brands: 1, max_posts_per_month: 1000,
  max_exports_per_month: 5, data_retention_days: 30, features: [] as string[],
  has_api_access: false, has_advanced_analytics: false,
  has_competitor_analysis: false, has_custom_alerts: false,
  has_ai_insights: false, has_priority_support: false,
  is_popular: false, is_active: true, sort_order: 0,
}

export default function Subscriptions() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [subs, setSubs] = useState<BusinessSub[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'plans' | 'subscribers'>('plans')
  const [editPlan, setEditPlan] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [featureInput, setFeatureInput] = useState('')
  const [expandedBiz, setExpandedBiz] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [p, s] = await Promise.all([
        adminAPI.getSubscriptionPlans(),
        adminAPI.getActiveSubscriptions(),
      ])
      setPlans(p.data)
      setSubs(s.data)
    } catch { toast.error('Failed to load subscription data') }
    finally { setLoading(false) }
  }

  const totalRevenue = plans.reduce((s, p) => s + p.monthly_revenue, 0)
  const totalActive = plans.reduce((s, p) => s + p.active_subscribers, 0)
  const totalAll = plans.reduce((s, p) => s + p.total_subscribers, 0)

  const openCreate = () => { setEditPlan({ ...EMPTY_PLAN }); setShowModal(true) }
  const openEdit = (p: Plan) => { setEditPlan({ ...p }); setShowModal(true) }

  const savePlan = async () => {
    setSaving(true)
    try {
      const data = { ...editPlan, name: editPlan.display_name?.toLowerCase().replace(/\s+/g, '_') }
      if (editPlan.id) {
        await adminAPI.updateSubscriptionPlan(editPlan.id, data)
        toast.success('Plan updated')
      } else {
        await adminAPI.createSubscriptionPlan(data)
        toast.success('Plan created')
      }
      setShowModal(false); fetchAll()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Save failed')
    } finally { setSaving(false) }
  }

  const deletePlan = async (id: number) => {
    if (!confirm('Delete this plan?')) return
    try {
      await adminAPI.deleteSubscriptionPlan(id)
      toast.success('Plan deleted'); fetchAll()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Cannot delete') }
  }

  const subAction = async (id: number, action: 'cancel' | 'reactivate') => {
    try {
      const res = await adminAPI.subscriptionAction(id, action)
      toast.success(res.data.message); fetchAll()
    } catch { toast.error('Action failed') }
  }

  const addFeature = () => {
    if (!featureInput.trim()) return
    setEditPlan({ ...editPlan, features: [...(editPlan.features || []), featureInput.trim()] })
    setFeatureInput('')
  }
  const removeFeature = (i: number) => {
    const f = [...editPlan.features]; f.splice(i, 1)
    setEditPlan({ ...editPlan, features: f })
  }

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
      {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl animate-shimmer" />)}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
            Subscription Management
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Manage plans, pricing, features, and monitor active subscriptions
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> Create Plan
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Plans', value: plans.length, icon: ChartBarIcon, color: 'text-primary-400', bg: 'from-primary-500/10 to-primary-500/5' },
          { label: 'Active Subscribers', value: totalActive, icon: UserGroupIcon, color: 'text-emerald-400', bg: 'from-emerald-500/10 to-emerald-500/5' },
          { label: 'Total Subscribers', value: totalAll, icon: UserGroupIcon, color: 'text-sky-400', bg: 'from-sky-500/10 to-sky-500/5' },
          { label: 'Monthly Revenue', value: `PKR ${totalRevenue.toLocaleString()}`, icon: CurrencyDollarIcon, color: 'text-amber-400', bg: 'from-amber-500/10 to-amber-500/5' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }} className={`card p-5 bg-gradient-to-br ${s.bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
        {(['plans', 'subscribers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2.5 px-5 rounded-lg text-sm font-semibold transition-all"
            style={tab === t
              ? { background: 'linear-gradient(135deg, #5a71f2, #7b97f8)', color: '#ffffff', boxShadow: '0 2px 8px rgba(90,113,242,0.35)' }
              : { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }
            }>
            {t === 'plans' ? '📋 Subscription Plans' : '👥 Active Subscribers'}
          </button>
        ))}
      </div>

      {/* Plans Tab */}
      {tab === 'plans' && (
        <div className="space-y-4">
          {plans.map((plan, i) => (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card p-5 hover:border-primary-500/30 transition-all"
              style={{ borderLeft: plan.is_active ? '3px solid var(--primary-color)' : '3px solid var(--text-muted)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{plan.display_name}</h3>
                    {plan.is_popular && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                        POPULAR
                      </span>
                    )}
                    {!plan.is_active && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25">
                        INACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{plan.description}</p>

                  {/* Pricing */}
                  <div className="flex items-baseline gap-3 mb-3">
                    <span className="text-xl font-bold text-primary-400">
                      {plan.currency} {parseFloat(plan.price_monthly).toLocaleString()}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/month</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      | {plan.currency} {parseFloat(plan.price_yearly).toLocaleString()}/year
                    </span>
                  </div>

                  {/* Limits */}
                  <div className="flex flex-wrap gap-3 mb-3">
                    {[
                      { l: 'Brands', v: plan.max_brands },
                      { l: 'Posts/mo', v: plan.max_posts_per_month.toLocaleString() },
                      { l: 'Exports/mo', v: plan.max_exports_per_month },
                      { l: 'Retention', v: `${plan.data_retention_days}d` },
                    ].map((lim, li) => (
                      <div key={li} className="text-xs px-2 py-1 rounded-lg"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{lim.l}:</span> <strong>{lim.v}</strong>
                      </div>
                    ))}
                  </div>

                  {/* Features */}
                  <div className="flex flex-wrap gap-1.5">
                    {plan.features.map((f, fi) => (
                      <span key={fi} className="text-[10px] px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20">
                        {f}
                      </span>
                    ))}
                    {plan.has_api_access && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">API Access</span>}
                    {plan.has_ai_insights && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">AI Insights</span>}
                    {plan.has_priority_support && <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">Priority Support</span>}
                  </div>
                </div>

                {/* Right side: stats + actions */}
                <div className="text-right flex-shrink-0 space-y-3">
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Active</p>
                    <p className="text-lg font-bold text-emerald-400">{plan.active_subscribers}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Revenue/mo</p>
                    <p className="text-sm font-bold text-amber-400">PKR {plan.monthly_revenue.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(plan)} className="p-2 rounded-lg hover:bg-primary-500/10 transition"
                      title="Edit Plan">
                      <PencilIcon className="w-4 h-4 text-primary-400" />
                    </button>
                    <button onClick={() => deletePlan(plan.id)} className="p-2 rounded-lg hover:bg-rose-500/10 transition"
                      title="Delete Plan">
                      <TrashIcon className="w-4 h-4 text-rose-400" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {plans.length === 0 && (
            <div className="card p-12 text-center">
              <CurrencyDollarIcon className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p style={{ color: 'var(--text-muted)' }}>No subscription plans yet. Create your first plan.</p>
            </div>
          )}
        </div>
      )}

      {/* Subscribers Tab — grouped by business */}
      {tab === 'subscribers' && (
        <div className="space-y-4">
          {subs.map((biz, i) => {
            const isExpanded = expandedBiz.has(biz.id)
            const toggleExpand = () => {
              const s = new Set(expandedBiz)
              isExpanded ? s.delete(biz.id) : s.add(biz.id)
              setExpandedBiz(s)
            }
            return (
              <motion.div key={biz.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }} className="card overflow-hidden"
                style={{ borderLeft: biz.status === 'active' ? '3px solid var(--primary-color)' : '3px solid #f43f5e' }}>

                {/* Business Header */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <BuildingOffice2Icon className="w-5 h-5 text-primary-400" />
                        <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{biz.company_name}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          biz.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>{biz.status.toUpperCase()}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20">
                          {biz.plan.toUpperCase()} PLAN
                        </span>
                      </div>
                      {biz.industry && <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{biz.industry}</p>}

                      {/* Stats row */}
                      <div className="flex flex-wrap gap-4 mt-2">
                        {[
                          { label: 'Members', value: `${biz.members_count} / ${biz.max_users}`, color: 'text-sky-400' },
                          { label: 'Brands', value: `${biz.brands_used} / ${biz.max_brands}`, color: 'text-violet-400' },
                          { label: 'Posts (30d)', value: biz.posts_this_month.toLocaleString(), color: 'text-amber-400' },
                          { label: 'Since', value: new Date(biz.created_at).toLocaleDateString(), color: 'text-emerald-400' },
                        ].map((st, si) => (
                          <div key={si} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{st.label}: </span>
                            <strong className={st.color}>{st.value}</strong>
                          </div>
                        ))}
                      </div>

                      {/* Owner */}
                      {biz.owner && (
                        <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                          Owner: <strong>{biz.owner.first_name} {biz.owner.last_name}</strong> ({biz.owner.email})
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2">
                      {biz.status === 'active' ? (
                        <button onClick={() => subAction(biz.id, 'cancel')}
                          className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition flex items-center gap-1">
                          <XCircleIcon className="w-3.5 h-3.5" /> Cancel Subscription
                        </button>
                      ) : (
                        <button onClick={() => subAction(biz.id, 'reactivate')}
                          className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition flex items-center gap-1">
                          <ArrowPathIcon className="w-3.5 h-3.5" /> Reactivate
                        </button>
                      )}
                      <button onClick={toggleExpand}
                        className="text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                        style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' }}>
                        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        {isExpanded ? 'Hide' : 'Show'} {biz.members_count} Member{biz.members_count !== 1 ? 's' : ''}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expandable Members */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} className="overflow-hidden"
                      style={{ borderTop: '1px solid var(--border-primary)' }}>
                      <div className="p-4" style={{ background: 'var(--bg-elevated)' }}>
                        <table className="w-full text-xs">
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                              {['Name', 'Email', 'Role', 'Status'].map(h => (
                                <th key={h} className="text-left px-3 py-2 font-semibold uppercase tracking-wider"
                                  style={{ color: 'var(--text-muted)' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {biz.members.map(m => (
                              <tr key={m.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                                  {m.first_name} {m.last_name}
                                </td>
                                <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{m.email}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    m.role === 'admin' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' :
                                    m.role === 'analyst' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                                    'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                  }`}>{m.role}</span>
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`w-2 h-2 rounded-full inline-block mr-1.5 ${m.is_active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                  <span style={{ color: 'var(--text-secondary)' }}>{m.is_active ? 'Active' : 'Inactive'}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}

          {subs.length === 0 && (
            <div className="card p-12 text-center">
              <BuildingOffice2Icon className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p style={{ color: 'var(--text-muted)' }}>No businesses found</p>
            </div>
          )}
        </div>
      )}

      {/* Edit/Create Modal */}
      <AnimatePresence>
        {showModal && editPlan && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()}
              className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {editPlan.id ? 'Edit Plan' : 'Create New Plan'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                  <XMarkIcon className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Display Name</label>
                  <input value={editPlan.display_name} onChange={e => setEditPlan({ ...editPlan, display_name: e.target.value })}
                    className="input w-full" placeholder="e.g. Professional" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Sort Order</label>
                  <input type="number" value={editPlan.sort_order} onChange={e => setEditPlan({ ...editPlan, sort_order: +e.target.value })}
                    className="input w-full" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Description</label>
                <textarea value={editPlan.description} onChange={e => setEditPlan({ ...editPlan, description: e.target.value })}
                  className="input w-full" rows={2} />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Monthly Price</label>
                  <input type="number" value={editPlan.price_monthly} onChange={e => setEditPlan({ ...editPlan, price_monthly: e.target.value })}
                    className="input w-full" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Yearly Price</label>
                  <input type="number" value={editPlan.price_yearly} onChange={e => setEditPlan({ ...editPlan, price_yearly: e.target.value })}
                    className="input w-full" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Currency</label>
                  <input value={editPlan.currency} onChange={e => setEditPlan({ ...editPlan, currency: e.target.value })}
                    className="input w-full" />
                </div>
              </div>

              {/* Limits */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { key: 'max_brands', label: 'Max Brands' },
                  { key: 'max_posts_per_month', label: 'Max Posts/Month' },
                  { key: 'max_exports_per_month', label: 'Max Exports/Month' },
                  { key: 'data_retention_days', label: 'Data Retention (Days)' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                    <input type="number" value={(editPlan as any)[f.key]}
                      onChange={e => setEditPlan({ ...editPlan, [f.key]: +e.target.value })}
                      className="input w-full" />
                  </div>
                ))}
              </div>

              {/* Feature Toggles */}
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-primary)' }}>Feature Toggles</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'has_advanced_analytics', label: 'Advanced Analytics' },
                    { key: 'has_ai_insights', label: 'AI Insights' },
                    { key: 'has_competitor_analysis', label: 'Competitor Analysis' },
                    { key: 'has_custom_alerts', label: 'Custom Alerts' },
                    { key: 'has_api_access', label: 'API Access' },
                    { key: 'has_priority_support', label: 'Priority Support' },
                    { key: 'is_popular', label: 'Popular Badge' },
                    { key: 'is_active', label: 'Active' },
                  ].map(f => (
                    <label key={f.key} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-white/[0.03] transition">
                      <input type="checkbox" checked={(editPlan as any)[f.key]}
                        onChange={e => setEditPlan({ ...editPlan, [f.key]: e.target.checked })}
                        className="w-4 h-4 rounded accent-primary-500" />
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Custom Features List */}
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-primary)' }}>
                  Plan Features (shown on pricing page)
                </label>
                <div className="flex gap-2 mb-2">
                  <input value={featureInput} onChange={e => setFeatureInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                    className="input flex-1" placeholder="e.g. PDF Report Export" />
                  <button onClick={addFeature} className="btn-secondary text-xs px-3">Add</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(editPlan.features || []).map((f: string, i: number) => (
                    <span key={i} className="text-xs flex items-center gap-1 px-2 py-1 rounded-full"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                      {f}
                      <button onClick={() => removeFeature(i)} className="hover:text-rose-400"><XMarkIcon className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Save */}
              <div className="flex gap-3 justify-end pt-2" style={{ borderTop: '1px solid var(--border-primary)' }}>
                <button onClick={() => setShowModal(false)} className="btn-secondary text-sm px-5">Cancel</button>
                <button onClick={savePlan} disabled={saving || !editPlan.display_name}
                  className="btn-primary text-sm px-5 flex items-center gap-2">
                  {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
                  {editPlan.id ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
