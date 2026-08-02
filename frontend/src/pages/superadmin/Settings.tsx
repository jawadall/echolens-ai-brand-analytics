import { EnvelopeIcon, CreditCardIcon, EyeIcon, EyeSlashIcon, ClockIcon } from '@heroicons/react/24/outline'
import { adminAPI } from '../../api/client'
import toast from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import PlatformAPISettings from '../../components/PlatformAPISettings'

function SettingsForm({ title, icon: Icon, fields, loadFn, saveFn, testFn }: {
  title: string; icon: any
  fields: { key: string; label: string; type?: string; placeholder?: string }[]
  loadFn: () => Promise<any>; saveFn: (data: any) => Promise<any>; testFn?: () => Promise<any>
}) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({})

  useEffect(() => { loadFn().then(r => { setForm(r.data); setLoading(false) }).catch(() => setLoading(false)) }, [])

  const save = async () => {
    setSaving(true)
    try { await saveFn(form); toast.success(`${title} updated!`) }
    catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const test = async () => {
    try { const r = await testFn!(); toast.success(r.data.message || 'Test successful!') }
    catch (e: any) { toast.error(e.response?.data?.error || 'Test failed') }
  }

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl animate-shimmer" />)}</div>

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Configure integration settings</p>
        </div>
      </div>
      <div className="space-y-4">
        {fields.map(f => {
          const isSensitive = f.type === 'password'
          const isVisible = visibleFields[f.key] || false
          return (
            <div key={f.key}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
              {f.type === 'toggle' ? (
                <button onClick={() => setForm({ ...form, [f.key]: form[f.key] === 'true' ? 'false' : 'true' })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form[f.key] === 'true' ? 'bg-primary-500' : ''}`}
                  style={{ background: form[f.key] !== 'true' ? 'var(--bg-elevated)' : undefined, border: '1px solid var(--border-primary)' }}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${form[f.key] === 'true' ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              ) : (
                <div className="relative">
                  <input
                    type={isSensitive && !isVisible ? 'password' : 'text'}
                    value={form[f.key] || ''}
                    placeholder={f.placeholder}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className={`input w-full text-sm ${isSensitive ? 'font-mono pr-10' : ''}`}
                  />
                  {isSensitive && (
                    <button
                      type="button"
                      onClick={() => setVisibleFields(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/5 transition-colors"
                      title={isVisible ? 'Hide' : 'Show'}
                    >
                      {isVisible ? (
                        <EyeSlashIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      ) : (
                        <EyeIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={save} disabled={saving} className="btn-primary text-sm">{saving ? 'Saving...' : 'Save Settings'}</button>
        {testFn && (
          <button onClick={test} className="btn-secondary text-sm flex items-center gap-1">
            <ArrowPathIcon className="w-4 h-4" /> Test
          </button>
        )}
      </div>
    </div>
  )
}

export default function SystemSettings() {
  const [schedulingEnabled, setSchedulingEnabled] = useState(true)
  const [schedulingLoading, setSchedulingLoading] = useState(true)
  const [schedulingSaving, setSchedulingSaving] = useState(false)

  useEffect(() => {
    adminAPI.getSettings('scheduling').then(r => {
      const settings = r.data.settings || []
      const found = settings.find((s: any) => s.key === 'scheduling_enabled')
      if (found) setSchedulingEnabled(found.value === 'true')
      setSchedulingLoading(false)
    }).catch(() => setSchedulingLoading(false))
  }, [])

  const toggleScheduling = async () => {
    const newVal = !schedulingEnabled
    setSchedulingSaving(true)
    try {
      await adminAPI.updateSettings([
        { key: 'scheduling_enabled', value: newVal ? 'true' : 'false', category: 'scheduling', value_type: 'boolean' }
      ])
      setSchedulingEnabled(newVal)
      toast.success(newVal ? 'Task scheduling enabled' : 'Task scheduling disabled')
    } catch {
      toast.error('Failed to update scheduling')
    } finally { setSchedulingSaving(false) }
  }

  const schedules = [
    { name: 'Auto-Fetch Brand Data', interval: 'Every 5 minutes' },
    { name: 'Process Sentiment Analysis', interval: 'Every 30 minutes' },
    { name: 'Check Alert Thresholds', interval: 'Every 15 minutes' },
    { name: 'Update Analytics', interval: 'Hourly (at :15)' },
    { name: 'Generate Daily Summaries', interval: 'Daily at 00:05' },
    { name: 'Cleanup Old Data', interval: 'Weekly (Sunday 3 AM)' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>System Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Configure scheduling, data source APIs, email, and payment integrations</p>
      </div>

      {/* Task Scheduling */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <ClockIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Task Scheduling (Celery Beat)</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Control automatic background tasks across the platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${schedulingEnabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {schedulingLoading ? '...' : schedulingEnabled ? 'Active' : 'Disabled'}
            </span>
            <button onClick={toggleScheduling} disabled={schedulingLoading || schedulingSaving}
              className={`relative w-12 h-6 rounded-full transition-colors ${schedulingEnabled ? 'bg-emerald-500' : ''}`}
              style={{ background: !schedulingEnabled ? 'var(--bg-elevated)' : undefined, border: '1px solid var(--border-primary)' }}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${schedulingEnabled ? 'left-[26px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {schedules.map(s => (
            <div key={s.name} className="p-3 rounded-xl flex items-center gap-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${schedulingEnabled ? 'bg-emerald-400' : 'bg-gray-500'}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.interval}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform API Keys — Full Width */}
      <PlatformAPISettings />

      {/* Other Integrations */}
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Service Integrations</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SettingsForm title="Email / SMTP" icon={EnvelopeIcon}
            loadFn={adminAPI.getSMTP} saveFn={adminAPI.updateSMTP} testFn={() => adminAPI.testSMTP()}
            fields={[
              { key: 'smtp_enabled', label: 'Enable Email', type: 'toggle' },
              { key: 'smtp_host', label: 'SMTP Host', placeholder: 'smtp.gmail.com' },
              { key: 'smtp_port', label: 'SMTP Port', placeholder: '587' },
              { key: 'smtp_username', label: 'Username', placeholder: 'your@email.com' },
              { key: 'smtp_password', label: 'Password', type: 'password' },
              { key: 'smtp_from_email', label: 'From Email', placeholder: 'noreply@echolens.com' },
              { key: 'smtp_use_tls', label: 'Use TLS', type: 'toggle' },
            ]}
          />
          <SettingsForm title="Stripe Payments" icon={CreditCardIcon}
            loadFn={adminAPI.getStripe} saveFn={adminAPI.updateStripe}
            fields={[
              { key: 'stripe_enabled', label: 'Enable Payments', type: 'toggle' },
              { key: 'stripe_publishable_key', label: 'Publishable Key', placeholder: 'pk_test_...' },
              { key: 'stripe_secret_key', label: 'Secret Key', type: 'password', placeholder: 'sk_test_...' },
              { key: 'stripe_webhook_secret', label: 'Webhook Secret', type: 'password' },
              { key: 'stripe_currency', label: 'Currency', placeholder: 'pkr' },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
