import { useState, useEffect } from 'react'
import { _asAPI } from '../../api/client'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

interface KeyAccount {
  index: number
  key_preview: string
  status: string
  detail: string
  quota?: Record<string, string>
}

interface PlatformData {
  label: string
  total_keys: number
  active_keys: number
  accounts: KeyAccount[]
}

type ConfigData = Record<string, PlatformData>

const PLATFORM_META: Record<string, { icon: string; color: string; placeholder: string }> = {
  youtube: {
    icon: '▶',
    color: '#ff0000',
    placeholder: 'AIzaSy...',
  },
  gemini: {
    icon: '✦',
    color: '#8b5cf6',
    placeholder: 'AIzaSy...',
  },
}

export default function ASConfig() {
  const [data, setData] = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [newKeys, setNewKeys] = useState<Record<string, string>>({ youtube: '', gemini: '' })
  const [adding, setAdding] = useState<string | null>(null)
  const [removingKey, setRemovingKey] = useState<string | null>(null)

  const loadConfig = async () => {
    setLoading(true)
    try {
      const r = await _asAPI.getConfig()
      setData(r.data)
    } catch (e: any) {
      if (e.response?.status === 403) {
        toast.error('Access denied')
      } else {
        toast.error('Failed to load configuration')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadConfig() }, [])

  const addKey = async (platform: string) => {
    const key = newKeys[platform]?.trim()
    if (!key) return
    setAdding(platform)
    try {
      const r = await _asAPI.addKey(platform, key)
      toast.success(r.data.detail)
      setNewKeys(prev => ({ ...prev, [platform]: '' }))
      loadConfig()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to add key')
    } finally {
      setAdding(null)
    }
  }

  const removeKey = async (platform: string, index: number) => {
    if (!window.confirm('Remove this API key?')) return
    const id = `${platform}-${index}`
    setRemovingKey(id)
    try {
      const r = await _asAPI.removeKey(platform, index)
      toast.success(r.data.detail)
      loadConfig()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to remove')
    } finally {
      setRemovingKey(null)
    }
  }

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'active': return '#15b79e'
      case 'exhausted': return '#f59e0b'
      case 'error': return '#f43f5e'
      default: return '#6b7280'
    }
  }

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'active': return <CheckCircleIcon className="w-5 h-5" style={{ color: '#15b79e' }} />
      case 'exhausted': return <ExclamationTriangleIcon className="w-5 h-5" style={{ color: '#f59e0b' }} />
      case 'error': return <XCircleIcon className="w-5 h-5" style={{ color: '#f43f5e' }} />
      default: return <ArrowPathIcon className="w-5 h-5 animate-spin" style={{ color: '#6b7280' }} />
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div className="animate-spin" style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid var(--border-primary)',
          borderTopColor: 'var(--primary-500)',
        }} />
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
      }}>
        Unable to load configuration. Ensure you have admin access.
      </div>
    )
  }

  const totalKeys = Object.values(data).reduce((s, p) => s + p.total_keys, 0)
  const activeKeys = Object.values(data).reduce((s, p) => s + p.active_keys, 0)

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      padding: '2rem',
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.25rem',
          }}>
            API Key Management
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Manage YouTube & Gemini API keys with automatic rotation
          </p>
        </div>

        {/* Stats Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Total Keys
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {totalKeys}
            </div>
          </div>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Active Keys
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#15b79e' }}>
              {activeKeys}
            </div>
          </div>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Auto-Rotation
            </div>
            <div style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: totalKeys > 1 ? '#15b79e' : '#f59e0b',
            }}>
              {totalKeys > 1 ? 'Active' : 'Add more keys'}
            </div>
          </div>
        </div>

        {/* Platform Sections */}
        {Object.entries(data).map(([platform, pdata]) => {
          const meta = PLATFORM_META[platform] || { icon: '🔑', color: '#6b7280', placeholder: 'API key...' }

          return (
            <div key={platform} className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>

              {/* Platform Header */}
              <div style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{
                    fontSize: '1.25rem',
                    width: 36, height: 36,
                    borderRadius: '0.5rem',
                    background: `${meta.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {meta.icon}
                  </span>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {pdata.label}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {pdata.active_keys}/{pdata.total_keys} keys active
                    </div>
                  </div>
                </div>
                <button
                  onClick={loadConfig}
                  className="btn-secondary"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    fontSize: '0.75rem', padding: '0.375rem 0.75rem',
                  }}
                >
                  <ArrowPathIcon className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>

              {/* Add Key */}
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-primary)' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={newKeys[platform] || ''}
                    onChange={e => setNewKeys(prev => ({ ...prev, [platform]: e.target.value }))}
                    placeholder={meta.placeholder}
                    className="input"
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}
                    onKeyDown={e => e.key === 'Enter' && addKey(platform)}
                  />
                  <button
                    onClick={() => addKey(platform)}
                    disabled={adding === platform || !(newKeys[platform]?.trim())}
                    className="btn-primary"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.375rem',
                      fontSize: '0.8rem',
                      opacity: adding === platform || !(newKeys[platform]?.trim()) ? 0.5 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <PlusIcon className="w-4 h-4" />
                    {adding === platform ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>

              {/* Keys List */}
              {pdata.accounts.length === 0 ? (
                <div style={{
                  padding: '2.5rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.875rem',
                }}>
                  No API keys configured. Add one above.
                </div>
              ) : (
                <div>
                  {pdata.accounts.map((acct, i) => {
                    const removeId = `${platform}-${acct.index}`
                    return (
                      <div
                        key={i}
                        style={{
                          padding: '0.85rem 1.25rem',
                          borderBottom: i < pdata.accounts.length - 1 ? '1px solid var(--border-primary)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                        }}
                      >
                        {/* Status Icon */}
                        <div style={{ flexShrink: 0 }}>
                          {getStatusIcon(acct.status)}
                        </div>

                        {/* Key Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.15rem',
                          }}>
                            <span style={{
                              fontFamily: 'monospace',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}>
                              {acct.key_preview}
                            </span>
                            <span style={{
                              fontSize: '0.65rem',
                              padding: '0.125rem 0.5rem',
                              borderRadius: '1rem',
                              background: `${getStatusColor(acct.status)}20`,
                              color: getStatusColor(acct.status),
                              fontWeight: 600,
                              textTransform: 'uppercase',
                            }}>
                              {acct.status}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {acct.detail}
                            {acct.quota && (
                              <span style={{ marginLeft: '0.75rem' }}>
                                Quota: {Object.values(acct.quota).join(' | ')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => removeKey(platform, acct.index)}
                          disabled={removingKey === removeId}
                          style={{
                            flexShrink: 0,
                            padding: '0.5rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border-primary)',
                            background: 'transparent',
                            color: '#f43f5e',
                            cursor: 'pointer',
                            opacity: removingKey === removeId ? 0.5 : 1,
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f43f5e15')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          title="Remove key"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Info Footer */}
        <div style={{
          marginTop: '1rem',
          padding: '1rem 1.25rem',
          borderRadius: '0.75rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}>
          <strong style={{ color: 'var(--text-secondary)' }}>How it works:</strong> Keys are
          tested in order. If one account's quota is exhausted, the system automatically
          switches to the next available key. Exhausted keys are re-checked after 10 minutes.
          For best reliability during demos, add at least <strong style={{ color: 'var(--text-secondary)' }}>2 keys per service</strong>.
        </div>
      </div>
    </div>
  )
}
