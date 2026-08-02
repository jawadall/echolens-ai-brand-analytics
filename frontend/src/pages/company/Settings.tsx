import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  BuildingOffice2Icon,
  BellIcon,
  ExclamationTriangleIcon,
  EnvelopeIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline'
import { adminAPI } from '../../api/client'
import { useAuthStore } from '../../store/authStore'

const TABS = [
  { id: 'company', label: 'Business Info', icon: BuildingOffice2Icon },
  { id: 'notifications', label: 'Notifications', icon: BellIcon },
  { id: 'alerts', label: 'Alert Preferences', icon: ExclamationTriangleIcon },
  { id: 'smtp', label: 'Email / SMTP', icon: EnvelopeIcon },
  { id: 'api-keys', label: 'API Keys', icon: KeyIcon },
]

const PLATFORM_CONFIGS: Record<string, { label: string; fields: { key: string; label: string; type: string; placeholder: string }[] }> = {
  youtube: {
    label: 'YouTube Data API v3',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'AIzaSy...' },
    ],
  },
  reddit: {
    label: 'Reddit API',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'Application client ID' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: 'Application client secret' },
      { key: 'user_agent', label: 'User Agent', type: 'text', placeholder: 'AppName/1.0 by username' },
    ],
  },
  twitter: {
    label: 'Twitter / X API v2',
    fields: [
      { key: 'bearer_token', label: 'Bearer Token', type: 'password', placeholder: 'AAAA...' },
    ],
  },
  facebook: {
    label: 'Facebook Graph API',
    fields: [
      { key: 'access_token', label: 'Page Access Token', type: 'password', placeholder: 'EAA...' },
    ],
  },
  news: {
    label: 'NewsAPI.org',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: '32-character hex key' },
    ],
  },
  gemini: {
    label: 'Google Gemini AI',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'AIzaSy...' },
    ],
  },
}

export default function CompanySettings() {
  const { user } = useAuthStore()
  const companyId = user?.company_info?.id
  const [tab, setTab] = useState('company')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [company, setCompany] = useState({ name: '', industry: '', website: '' })
  const [notifications, setNotifications] = useState({ email_enabled: true, frequency: 'instant', alert_email: '' })
  const [alertPrefs, setAlertPrefs] = useState({ negative_threshold: -0.3, volume_spike_multiplier: 2.0, auto_resolve_hours: 48 })
  const [useCustomSmtp, setUseCustomSmtp] = useState(false)
  const [smtp, setSmtp] = useState({ host: '', port: 587, username: '', password: '', from_email: '', use_tls: true })

  // API Keys state
  const [useCustomApis, setUseCustomApis] = useState(false)
  const [platformKeys, setPlatformKeys] = useState<Record<string, { enabled: boolean; [key: string]: any }>>({})
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (companyId) loadSettings()
  }, [companyId])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.getCompanySettings(companyId!)
      const d = res.data
      setCompany({ name: d.company?.name || '', industry: d.company?.industry || '', website: d.company?.website || '' })
      setNotifications(d.notifications || { email_enabled: true, frequency: 'instant', alert_email: '' })
      setAlertPrefs(d.alert_preferences || { negative_threshold: -0.3, volume_spike_multiplier: 2.0, auto_resolve_hours: 48 })
      setUseCustomSmtp(d.smtp?.use_custom || false)
      setSmtp(d.smtp || { host: '', port: 587, username: '', password: '', from_email: '', use_tls: true })

      // Load API keys
      const apiKeysData = d.api_keys || {}
      setUseCustomApis(apiKeysData.use_custom_apis || false)
      const platforms: Record<string, any> = {}
      Object.keys(PLATFORM_CONFIGS).forEach(p => {
        platforms[p] = { enabled: false, ...(apiKeysData.platforms?.[p] || {}) }
      })
      setPlatformKeys(platforms)
    } catch {} finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminAPI.updateCompanySettings(companyId!, {
        name: company.name,
        industry: company.industry,
        website: company.website,
        notifications,
        alert_preferences: alertPrefs,
        smtp: { ...smtp, use_custom: useCustomSmtp },
        api_keys: {
          use_custom_apis: useCustomApis,
          platforms: platformKeys,
        },
      })
      toast.success('Settings saved successfully')
    } catch {} finally {
      setSaving(false)
    }
  }

  const updatePlatformKey = (platform: string, field: string, value: any) => {
    setPlatformKeys(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Business Settings</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Manage your business profile, notifications, and integrations</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary self-start">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'var(--bg-elevated)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              tab === t.id ? 'bg-indigo-500 text-white' : 'btn-ghost'
            }`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
        {tab === 'company' && (
          <div className="space-y-4 max-w-lg">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Business Information</h3>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Business Name</label>
              <input type="text" value={company.name} onChange={e => setCompany({ ...company, name: e.target.value })}
                className="input w-full" placeholder="Your Business Name" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Industry</label>
              <select value={company.industry} onChange={e => setCompany({ ...company, industry: e.target.value })} className="input w-full">
                <option value="">Select Industry</option>
                {['Technology', 'Marketing', 'E-Commerce', 'Finance', 'Healthcare', 'Education', 'Media', 'Retail', 'Other'].map(i => (
                  <option key={i} value={i.toLowerCase()}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Website</label>
              <input type="url" value={company.website} onChange={e => setCompany({ ...company, website: e.target.value })}
                className="input w-full" placeholder="https://example.com" />
            </div>
          </div>
        )}

        {tab === 'notifications' && (
          <div className="space-y-5 max-w-lg">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Notification Preferences</h3>
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Email Notifications</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Receive alert notifications via email</p>
              </div>
              <button onClick={() => setNotifications({ ...notifications, email_enabled: !notifications.email_enabled })}
                className={`relative w-11 h-6 rounded-full transition-colors ${notifications.email_enabled ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${notifications.email_enabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Notification Frequency</label>
              <select value={notifications.frequency} onChange={e => setNotifications({ ...notifications, frequency: e.target.value })} className="input w-full">
                <option value="instant">Instant</option>
                <option value="hourly">Hourly Digest</option>
                <option value="daily">Daily Digest</option>
                <option value="weekly">Weekly Summary</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Alert Email Address</label>
              <input type="email" value={notifications.alert_email} onChange={e => setNotifications({ ...notifications, alert_email: e.target.value })}
                className="input w-full" placeholder="alerts@yourcompany.com" />
            </div>
          </div>
        )}

        {tab === 'alerts' && (
          <div className="space-y-5 max-w-lg">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Alert Preferences</h3>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Negative Sentiment Threshold</label>
              <div className="flex items-center gap-3">
                <input type="range" min="-1" max="0" step="0.05" value={alertPrefs.negative_threshold}
                  onChange={e => setAlertPrefs({ ...alertPrefs, negative_threshold: parseFloat(e.target.value) })}
                  className="flex-1 accent-indigo-500" />
                <span className="text-sm font-mono font-medium w-12 text-right" style={{ color: 'var(--text-primary)' }}>
                  {alertPrefs.negative_threshold.toFixed(2)}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Volume Spike Multiplier</label>
              <div className="flex items-center gap-3">
                <input type="range" min="1.5" max="5" step="0.5" value={alertPrefs.volume_spike_multiplier}
                  onChange={e => setAlertPrefs({ ...alertPrefs, volume_spike_multiplier: parseFloat(e.target.value) })}
                  className="flex-1 accent-indigo-500" />
                <span className="text-sm font-mono font-medium w-12 text-right" style={{ color: 'var(--text-primary)' }}>
                  {alertPrefs.volume_spike_multiplier.toFixed(1)}x
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Auto-Resolve (Hours)</label>
              <select value={alertPrefs.auto_resolve_hours} onChange={e => setAlertPrefs({ ...alertPrefs, auto_resolve_hours: parseInt(e.target.value) })} className="input w-full">
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={72}>72 hours</option>
                <option value={168}>1 week</option>
                <option value={0}>Never (manual only)</option>
              </select>
            </div>
          </div>
        )}

        {tab === 'smtp' && (
          <div className="space-y-5 max-w-lg">
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Email / SMTP Configuration</h3>

            {/* Master toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Use Custom SMTP Server</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {useCustomSmtp ? 'Emails will be sent using your custom SMTP configuration' : 'Emails will be sent using the platform default SMTP'}
                </p>
              </div>
              <button onClick={() => setUseCustomSmtp(!useCustomSmtp)}
                className={`relative w-11 h-6 rounded-full transition-colors ${useCustomSmtp ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${useCustomSmtp ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {!useCustomSmtp && (
              <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)', color: 'var(--text-secondary)' }}>
                Emails are currently sent using the platform's default SMTP server configured by the system administrator.
              </div>
            )}

            {useCustomSmtp && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>SMTP Host</label>
                    <input type="text" value={smtp.host} onChange={e => setSmtp({ ...smtp, host: e.target.value })}
                      className="input w-full" placeholder="smtp.gmail.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Port</label>
                    <input type="number" value={smtp.port} onChange={e => setSmtp({ ...smtp, port: parseInt(e.target.value) || 587 })}
                      className="input w-full" placeholder="587" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Username</label>
                  <input type="text" value={smtp.username} onChange={e => setSmtp({ ...smtp, username: e.target.value })}
                    className="input w-full" placeholder="your-email@gmail.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password</label>
                  <input type="password" value={smtp.password} onChange={e => setSmtp({ ...smtp, password: e.target.value })}
                    className="input w-full" placeholder="App password or SMTP password" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>From Email</label>
                  <input type="email" value={smtp.from_email} onChange={e => setSmtp({ ...smtp, from_email: e.target.value })}
                    className="input w-full" placeholder="alerts@yourcompany.com" />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Use TLS</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Encrypt connections (recommended)</p>
                  </div>
                  <button onClick={() => setSmtp({ ...smtp, use_tls: !smtp.use_tls })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${smtp.use_tls ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${smtp.use_tls ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {tab === 'api-keys' && (
          <div className="space-y-5">
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Platform API Keys</h3>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Configure custom API keys for each platform. When enabled, data will be fetched using your own credentials.
              </p>
            </div>

            {/* Master toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: useCustomApis ? 'rgba(16,185,129,0.06)' : 'var(--bg-elevated)', border: `1px solid ${useCustomApis ? 'rgba(16,185,129,0.2)' : 'var(--border-primary)'}` }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Use Custom API Keys for Data Fetching</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {useCustomApis
                    ? 'Data fetching uses your own API keys and does NOT count against your plan quota'
                    : 'Data fetching uses platform credentials and counts against your plan post quota'}
                </p>
              </div>
              <button onClick={() => setUseCustomApis(!useCustomApis)}
                className={`relative w-11 h-6 rounded-full transition-colors ${useCustomApis ? 'bg-emerald-500' : 'bg-gray-600'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${useCustomApis ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {useCustomApis && (
              <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', color: 'var(--text-secondary)' }}>
                <strong className="text-emerald-400">Unlimited Fetching Enabled:</strong> When custom API keys are active, posts fetched through your own credentials will not count against your plan's monthly post quota.
              </div>
            )}

            {/* Per-platform sections */}
            <div className="space-y-3">
              {Object.entries(PLATFORM_CONFIGS).map(([platform, config]) => {
                const pk = platformKeys[platform] || { enabled: false }
                const isConfigured = pk.enabled && config.fields.some(f => pk[f.key]?.trim())
                return (
                  <div key={platform} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
                    {/* Platform header */}
                    <div
                      className="flex items-center justify-between px-4 py-3 cursor-pointer"
                      style={{ background: 'var(--bg-elevated)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-emerald-400' : pk.enabled ? 'bg-amber-400' : 'bg-gray-600'}`} />
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{config.label}</span>
                        {isConfigured && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">Configured</span>}
                      </div>
                      <button onClick={() => updatePlatformKey(platform, 'enabled', !pk.enabled)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${pk.enabled ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${pk.enabled ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>

                    {/* Fields */}
                    {pk.enabled && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="px-4 py-3 space-y-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
                        {config.fields.map(field => {
                          const fieldId = `${platform}_${field.key}`
                          const isSensitive = field.type === 'password'
                          const isVisible = visibleFields[fieldId] || !isSensitive
                          return (
                            <div key={field.key}>
                              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{field.label}</label>
                              <div className="relative">
                                <input
                                  type={isVisible ? 'text' : 'password'}
                                  value={pk[field.key] || ''}
                                  onChange={e => updatePlatformKey(platform, field.key, e.target.value)}
                                  className="input w-full text-sm font-mono pr-10"
                                  placeholder={field.placeholder}
                                />
                                {isSensitive && (
                                  <button
                                    type="button"
                                    onClick={() => setVisibleFields(prev => ({ ...prev, [fieldId]: !prev[fieldId] }))}
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
                            </div>
                          )
                        })}
                      </motion.div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
