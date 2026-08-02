import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline'
import { adminAPI } from '../api/client'

interface PlatformConfig {
  id: string
  name: string
  icon: string
  color: string
  gradient: string
  description: string
  fields: { key: string; label: string; placeholder: string; sensitive?: boolean }[]
  enabledKey: string
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: 'youtube',
    name: 'YouTube Data API',
    icon: 'YT',
    color: 'text-red-400',
    gradient: 'from-red-500/15 to-red-500/5 border-red-500/20',
    description: 'YouTube Data API v3 for fetching video comments, channel data, and search results.',
    fields: [
      { key: 'youtube_api_key', label: 'API Key', placeholder: 'AIzaSy...', sensitive: true },
    ],
    enabledKey: 'youtube_enabled',
  },
  {
    id: 'reddit',
    name: 'Reddit API',
    icon: 'R',
    color: 'text-orange-400',
    gradient: 'from-orange-500/15 to-orange-500/5 border-orange-500/20',
    description: 'Reddit OAuth2 API for monitoring subreddits, posts, and comment sentiment.',
    fields: [
      { key: 'reddit_client_id', label: 'Client ID', placeholder: 'your_client_id' },
      { key: 'reddit_client_secret', label: 'Client Secret', placeholder: 'your_client_secret', sensitive: true },
      { key: 'reddit_user_agent', label: 'User Agent', placeholder: 'EchoLens/1.0' },
    ],
    enabledKey: 'reddit_enabled',
  },
  {
    id: 'twitter',
    name: 'Twitter / X API',
    icon: 'X',
    color: 'text-sky-400',
    gradient: 'from-sky-500/15 to-sky-500/5 border-sky-500/20',
    description: 'Twitter API v2 for tracking tweets, mentions, hashtags, and engagement metrics.',
    fields: [
      { key: 'twitter_bearer_token', label: 'Bearer Token', placeholder: 'AAAA...', sensitive: true },
    ],
    enabledKey: 'twitter_enabled',
  },
  {
    id: 'facebook',
    name: 'Facebook Graph API',
    icon: 'f',
    color: 'text-blue-400',
    gradient: 'from-blue-500/15 to-blue-500/5 border-blue-500/20',
    description: 'Facebook Graph API for monitoring page posts, comments, and reactions.',
    fields: [
      { key: 'facebook_access_token', label: 'Access Token', placeholder: 'EAA...', sensitive: true },
    ],
    enabledKey: 'facebook_enabled',
  },
  {
    id: 'news',
    name: 'News API',
    icon: 'N',
    color: 'text-emerald-400',
    gradient: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20',
    description: 'NewsAPI.org for fetching news articles, headlines, and media coverage.',
    fields: [
      { key: 'news_api_key', label: 'API Key', placeholder: 'your_news_api_key', sensitive: true },
    ],
    enabledKey: 'news_enabled',
  },
  {
    id: 'gemini',
    name: 'Google Gemini AI',
    icon: 'G',
    color: 'text-purple-400',
    gradient: 'from-purple-500/15 to-purple-500/5 border-purple-500/20',
    description: 'Google Gemini API for AI-powered sentiment analysis, summarization, and insights generation.',
    fields: [
      { key: 'gemini_api_key', label: 'API Key', placeholder: 'AIzaSy...', sensitive: true },
    ],
    enabledKey: 'gemini_enabled',
  },
]

export default function PlatformAPISettings() {
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingPlatform, setTestingPlatform] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'failed'>>({})
  const [connectionInfo, setConnectionInfo] = useState<Record<string, any>>({})
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const [apiRes, statusRes] = await Promise.all([
        adminAPI.getPlatformAPIs(),
        adminAPI.getPlatformStatus().catch(() => ({ data: {} })),
      ])
      setForm(apiRes.data)

      // Load stored connection statuses
      const statuses: Record<string, any> = {}
      Object.entries(statusRes.data).forEach(([key, val]: [string, any]) => {
        if (typeof val === 'object') {
          statuses[key] = val
          // Set initial test result from stored status
          if (val.connection_status === 'online') {
            setTestResults(prev => ({ ...prev, [key]: 'success' }))
          } else if (val.connection_status === 'offline') {
            setTestResults(prev => ({ ...prev, [key]: 'failed' }))
          }
        }
      })
      setConnectionInfo(statuses)
    } catch {
      const defaults: Record<string, string> = {}
      PLATFORMS.forEach(p => {
        p.fields.forEach(f => { defaults[f.key] = '' })
        defaults[p.enabledKey] = 'true'
      })
      setForm(defaults)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminAPI.updatePlatformAPIs(form)
      toast.success('Platform API keys saved successfully!')
    } catch {
      toast.error('Failed to save API keys')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (platformId: string) => {
    // Get the primary key field for this platform
    const platform = PLATFORMS.find(p => p.id === platformId)
    const primaryField = platform?.fields[0]
    const keyValue = primaryField ? (form[primaryField.key] || '') : ''

    // Allow masked keys — backend resolves real key from DB
    if (!keyValue || keyValue.length < 5) {
      toast.error('Please save an API key before testing')
      setTestResults(prev => ({ ...prev, [platformId]: 'failed' }))
      return
    }

    setTestingPlatform(platformId)
    try {
      const res = await adminAPI.testPlatformAPI(platformId, keyValue)
      if (res.data.status === 'success') {
        setTestResults(prev => ({ ...prev, [platformId]: 'success' }))
        setConnectionInfo(prev => ({
          ...prev,
          [platformId]: {
            ...prev[platformId],
            connection_status: 'online',
            last_tested: new Date().toISOString(),
            last_message: res.data.message,
            latency_ms: res.data.latency_ms || 0,
          }
        }))
        toast.success(res.data.message)
      } else {
        setTestResults(prev => ({ ...prev, [platformId]: 'failed' }))
        setConnectionInfo(prev => ({
          ...prev,
          [platformId]: {
            ...prev[platformId],
            connection_status: 'offline',
            last_tested: new Date().toISOString(),
            last_message: res.data.message || 'Connection failed',
          }
        }))
        toast.error(res.data.message || 'Connection test failed')
      }
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [platformId]: 'failed' }))
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Connection test failed'
      setConnectionInfo(prev => ({
        ...prev,
        [platformId]: {
          ...prev[platformId],
          connection_status: 'offline',
          last_tested: new Date().toISOString(),
          last_message: msg,
        }
      }))
      toast.error(msg)
    } finally {
      setTestingPlatform(null)
    }
  }

  const togglePlatform = (enabledKey: string) => {
    setForm(prev => ({ ...prev, [enabledKey]: prev[enabledKey] === 'true' ? 'false' : 'true' }))
  }

  const formatLastTested = (iso: string) => {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      const now = new Date()
      const diffMs = now.getTime() - d.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours}h ago`
      return d.toLocaleDateString()
    } catch { return '' }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-6 h-40 animate-shimmer" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
          <KeyIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Platform API Keys</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Configure global data source API keys. These are used for all companies unless they provide their own keys.
          </p>
        </div>
      </div>

      {/* Platform Cards */}
      <div className="space-y-4">
        {PLATFORMS.map((platform, idx) => {
          const isEnabled = form[platform.enabledKey] === 'true'
          const testResult = testResults[platform.id]
          const isTesting = testingPlatform === platform.id
          const connInfo = connectionInfo[platform.id]
          const lastTested = connInfo?.last_tested ? formatLastTested(connInfo.last_tested) : ''

          return (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`card overflow-hidden transition-all ${!isEnabled ? 'opacity-60' : ''}`}
            >
              {/* Platform Header */}
              <div className="flex items-center justify-between p-5 pb-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${platform.gradient} border flex items-center justify-center`}>
                    <span className={`text-sm font-bold ${platform.color}`}>{platform.icon}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{platform.name}</h3>
                      {testResult === 'success' && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircleIcon className="w-3 h-3" /> Connected
                        </span>
                      )}
                      {testResult === 'failed' && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircleIcon className="w-3 h-3" /> Failed
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{platform.description}</p>
                  </div>
                </div>

                {/* Enable/Disable Toggle */}
                <button
                  onClick={() => togglePlatform(platform.enabledKey)}
                  className="relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0"
                  style={{ background: isEnabled ? 'var(--primary-500, #6366f1)' : '#4b5563' }}
                >
                  <span
                    className="absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: isEnabled ? '22px' : '3px' }}
                  />
                </button>
              </div>

              {/* Fields */}
              {isEnabled && (
                <div className="p-5 pt-4 space-y-3">
                  <div className={`grid gap-3 ${platform.fields.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                    {platform.fields.map(field => {
                      const fieldId = `${platform.id}_${field.key}`
                      const isVisible = visibleFields[fieldId] || !field.sensitive
                      return (
                        <div key={field.key}>
                          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                            {field.label}
                          </label>
                          <div className="relative">
                            <input
                              type={isVisible ? 'text' : 'password'}
                              value={form[field.key] || ''}
                              onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                              placeholder={field.placeholder}
                              className="input w-full text-sm font-mono pr-10"
                              style={{ letterSpacing: '0.5px' }}
                            />
                            {field.sensitive && (
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
                  </div>

                  {/* Test Button + Last Tested */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleTest(platform.id)}
                      disabled={isTesting}
                      className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
                    >
                      {isTesting ? (
                        <><ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> Testing...</>
                      ) : (
                        <><ArrowPathIcon className="w-3.5 h-3.5" /> Test Connection</>
                      )}
                    </button>
                    {testResult === 'success' && (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <CheckCircleIcon className="w-3.5 h-3.5" /> API key verified
                        {connInfo?.latency_ms ? ` (${connInfo.latency_ms}ms)` : ''}
                      </span>
                    )}
                    {testResult === 'failed' && connInfo?.last_message && (
                      <span className="text-[11px] text-rose-400 truncate max-w-[200px]" title={connInfo.last_message}>
                        {connInfo.last_message}
                      </span>
                    )}
                    {lastTested && (
                      <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>
                        Last tested: {lastTested}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Save All */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full text-sm py-2.5"
        >
          {saving ? 'Saving All API Keys...' : 'Save All API Keys'}
        </button>
      </motion.div>
    </div>
  )
}
