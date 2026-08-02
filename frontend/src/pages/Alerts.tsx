import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTrendingDownIcon,
  PlusIcon,
  XMarkIcon,
  FunnelIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { alertsAPI, brandsAPI } from '../api/client'
import { Alert, Brand } from '../types'
import { usePermissions } from '../hooks/usePermissions'

const severityColors: Record<string, string> = {
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
}

const alertTypeIcons: Record<string, any> = {
  negative_spike: ArrowTrendingDownIcon,
  trending: ExclamationTriangleIcon,
  influencer: ExclamationTriangleIcon,
  crisis: XCircleIcon,
}

const alertTypeLabels: Record<string, string> = {
  negative_spike: 'Negative Sentiment Spike',
  crisis: 'Crisis Detection',
  trending: 'Trending Keywords',
}

interface AlertRule {
  id: number  // brand ID
  brandName: string
  alertType: string
  threshold: number
  alertEmail: string
  notifyInApp: boolean
  notifyEmail: boolean
}

export default function Alerts() {
  const { isViewer } = usePermissions()
  const isReadOnly = isViewer

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('all')
  const [showCreateRule, setShowCreateRule] = useState(false)
  const [brands, setBrands] = useState<Brand[]>([])
  const [rules, setRules] = useState<AlertRule[]>([])
  const [savingRule, setSavingRule] = useState(false)

  // Create rule form state
  const [ruleForm, setRuleForm] = useState({
    brandId: 0,
    alertType: 'negative_spike',
    threshold: 30,
    alertEmail: '',
    notifyInApp: true,
    notifyEmail: true,
  })

  useEffect(() => {
    fetchAlerts()
    fetchBrands()
  }, [filter])

  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const params = filter === 'resolved' 
        ? { is_resolved: true } 
        : filter === 'unresolved' 
          ? { is_resolved: false } 
          : {}
      const response = await alertsAPI.list(params)
      setAlerts(response.data.results || response.data)
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  const fetchBrands = async () => {
    try {
      const res = await brandsAPI.list()
      const allBrands: Brand[] = res.data.results || res.data
      setBrands(allBrands)

      // Build rules from brands with alerts enabled
      const activeRules: AlertRule[] = allBrands
        .filter((b: any) => b.alert_enabled)
        .map((b: any) => ({
          id: b.id,
          brandName: b.name,
          alertType: 'negative_spike',
          threshold: Math.round((b.alert_threshold || 0.3) * 100),
          alertEmail: b.alert_email || '',
          notifyInApp: true,
          notifyEmail: !!(b.alert_email),
        }))
      setRules(activeRules)
    } catch {}
  }

  const handleAcknowledge = async (alertId: number) => {
    try {
      await alertsAPI.acknowledge(alertId)
      toast.success('Alert acknowledged')
      fetchAlerts()
    } catch {}
  }

  const handleResolve = async (alertId: number) => {
    try {
      await alertsAPI.resolve(alertId)
      toast.success('Alert resolved')
      fetchAlerts()
    } catch {}
  }

  const handleBulkResolve = async () => {
    const unresolvedAlerts = alerts.filter(a => !a.is_resolved)
    if (unresolvedAlerts.length === 0) return
    if (!window.confirm(`Resolve all ${unresolvedAlerts.length} unresolved alerts?`)) return
    try {
      toast.loading('Resolving all alerts...', { id: 'bulk' })
      await Promise.all(unresolvedAlerts.map(a => alertsAPI.resolve(a.id)))
      toast.success(`${unresolvedAlerts.length} alerts resolved`, { id: 'bulk' })
      fetchAlerts()
    } catch {
      toast.error('Some alerts could not be resolved', { id: 'bulk' })
    }
  }

  const handleCreateRule = async () => {
    if (!ruleForm.brandId) {
      toast.error('Please select a brand')
      return
    }
    // Check if this brand already has a rule
    if (rules.some(r => r.id === ruleForm.brandId)) {
      toast.error('This brand already has an alert rule. Delete it first to create a new one.')
      return
    }
    setSavingRule(true)
    try {
      // Update brand's alert settings via the API
      await brandsAPI.update(ruleForm.brandId, {
        alert_enabled: true,
        alert_threshold: ruleForm.threshold / 100,
        alert_email: ruleForm.notifyEmail ? ruleForm.alertEmail : '',
      })
      toast.success('Alert rule created and synced with brand')
      setShowCreateRule(false)
      setRuleForm({ brandId: 0, alertType: 'negative_spike', threshold: 30, alertEmail: '', notifyInApp: true, notifyEmail: true })
      fetchBrands()  // Refresh rules
    } catch {
      toast.error('Failed to create rule')
    } finally {
      setSavingRule(false)
    }
  }

  const handleDeleteRule = async (brandId: number) => {
    try {
      // Disable alerts for this brand
      await brandsAPI.update(brandId, {
        alert_enabled: false,
      })
      toast.success('Alert rule removed')
      fetchBrands()  // Refresh rules
    } catch {
      toast.error('Failed to delete rule')
    }
  }

  const unresolvedCount = alerts.filter(a => !a.is_resolved).length
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.is_resolved).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Alerts</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {unresolvedCount > 0 
              ? `${unresolvedCount} unresolved alert${unresolvedCount > 1 ? 's' : ''} require attention`
              : 'All alerts have been resolved'}
          </p>
        </div>

        {!isReadOnly && (
          <div className="flex gap-2">
            {unresolvedCount > 0 && (
              <button onClick={handleBulkResolve} className="btn-secondary text-sm flex items-center gap-1.5">
                <CheckCircleIcon className="w-4 h-4" />
                Resolve All
              </button>
            )}
            <button onClick={() => setShowCreateRule(true)} className="btn-primary text-sm flex items-center gap-1.5">
              <PlusIcon className="w-4 h-4" />
              Alert Rule
            </button>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Alerts', value: alerts.length, color: 'text-primary-400', bg: 'bg-primary-500/10' },
          { label: 'Unresolved', value: unresolvedCount, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Critical', value: criticalCount, color: 'text-rose-400', bg: 'bg-rose-500/10' },
          { label: 'Active Rules', value: rules.length, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map((stat) => (
          <div key={stat.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
              <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{stat.label}</span>
          </div>
        ))}
      </div>



      {/* Alerts List */}
      {(
        <>
          {/* Filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            {(['all', 'unresolved', 'resolved'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f ? 'bg-primary-500 text-white' : ''}`}
                style={filter !== f ? { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' } : {}}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="card p-12 text-center">
              <CheckCircleIcon className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No Alerts</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {filter !== 'all' ? `No ${filter} alerts found` : 'Your brands are performing well!'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const Icon = alertTypeIcons[alert.alert_type] || ExclamationTriangleIcon
                return (
                  <motion.div key={alert.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`card p-4 transition-all ${alert.is_resolved ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${severityColors[alert.severity]?.split(' ')[0] || 'bg-gray-500/20'}`}>
                        <Icon className={`w-4.5 h-4.5 ${severityColors[alert.severity]?.split(' ')[1] || 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{alert.title}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${severityColors[alert.severity] || ''}`}>
                            {alert.severity}
                          </span>
                          {alert.is_resolved && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Resolved</span>}
                        </div>
                        <p className="text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>{alert.description}</p>
                        <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          <span>{alert.brand_name}</span>
                          <span>{new Date(alert.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      {!alert.is_resolved && !isReadOnly && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          {!alert.is_acknowledged && (
                            <button onClick={() => handleAcknowledge(alert.id)} className="btn-secondary text-xs py-1.5 px-3">Acknowledge</button>
                          )}
                          <button onClick={() => handleResolve(alert.id)} className="btn-primary text-xs py-1.5 px-3">Resolve</button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Active Rules */}
      {rules.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            Active Alert Rules
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">{rules.length}</span>
          </h3>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    {['Brand', 'Type', 'Threshold', 'Notifications', 'Alert Email', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rules.map(rule => (
                    <tr key={rule.id} style={{ borderBottom: '1px solid var(--border-primary)' }} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{rule.brandName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400">{alertTypeLabels[rule.alertType] || rule.alertType}</span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{rule.threshold}%</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {rule.notifyInApp && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">In-App</span>}
                          {rule.notifyEmail && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Email</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{rule.alertEmail || '—'}</td>
                      <td className="px-4 py-3">
                        {!isReadOnly && (
                          <button onClick={() => handleDeleteRule(rule.id)} className="p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors" title="Delete rule">
                            <TrashIcon className="w-3.5 h-3.5 text-rose-400" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create Alert Rule Modal */}
      <AnimatePresence>
        {showCreateRule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateRule(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card p-6 w-full max-w-md mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Create Alert Rule</h3>
                <button onClick={() => setShowCreateRule(false)} className="p-1 rounded-lg hover:bg-gray-500/10">
                  <XMarkIcon className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Brand *</label>
                  <select value={ruleForm.brandId} onChange={e => setRuleForm(f => ({ ...f, brandId: parseInt(e.target.value) }))} className="input w-full text-sm">
                    <option value={0}>Select a brand</option>
                    {brands.filter(b => !rules.some(r => r.id === b.id)).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Alert Type</label>
                  <div className="input w-full text-sm flex items-center gap-2" style={{ cursor: 'default' }}>
                    <ArrowTrendingDownIcon className="w-4 h-4 text-rose-400" />
                    <span style={{ color: 'var(--text-primary)' }}>Negative Sentiment Spike</span>
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Triggered when negative sentiment exceeds your threshold</p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Negative Sentiment Threshold: <span className="text-primary-400">{ruleForm.threshold}%</span>
                  </label>
                  <input type="range" min={5} max={80} value={ruleForm.threshold} onChange={e => setRuleForm(f => ({ ...f, threshold: parseInt(e.target.value) }))} className="w-full accent-primary-500" />
                  <div className="flex justify-between text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    <span>5% (Sensitive)</span><span>80% (Relaxed)</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Notifications</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                      <input type="checkbox" checked={ruleForm.notifyInApp} onChange={e => setRuleForm(f => ({ ...f, notifyInApp: e.target.checked }))} className="accent-primary-500" /> In-app notification
                    </label>
                    <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                      <input type="checkbox" checked={ruleForm.notifyEmail} onChange={e => setRuleForm(f => ({ ...f, notifyEmail: e.target.checked }))} className="accent-primary-500" /> Email notification
                    </label>
                  </div>
                </div>
                {ruleForm.notifyEmail && (
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Alert Email</label>
                    <input type="email" value={ruleForm.alertEmail} onChange={e => setRuleForm(f => ({ ...f, alertEmail: e.target.value }))} className="input w-full text-sm" placeholder="alerts@company.com" />
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Leave blank to notify all business members</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={handleCreateRule} disabled={savingRule} className="btn-primary flex-1">
                  {savingRule ? 'Saving...' : 'Create Rule'}
                </button>
                <button onClick={() => setShowCreateRule(false)} className="btn-secondary px-4">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
