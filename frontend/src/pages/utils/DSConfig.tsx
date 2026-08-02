import { useState, useEffect } from 'react'
import { _dsAPI } from '../../api/client'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

interface Account {
  index: number
  token_preview: string
  status: string
  email: string
  username?: string
  plan?: string
  error?: string
  usage: {
    monthly_usage_usd: number
    monthly_limit_usd: number
  } | null
}

interface ConfigData {
  total_accounts: number
  active_accounts: number
  fallback_enabled: boolean
  accounts: Account[]
}

export default function DSConfig() {
  const [data, setData] = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [newToken, setNewToken] = useState('')
  const [adding, setAdding] = useState(false)
  const [removingIdx, setRemovingIdx] = useState<number | null>(null)
  const [togglingFB, setTogglingFB] = useState(false)

  const loadConfig = async () => {
    setLoading(true)
    try {
      const r = await _dsAPI.getConfig()
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

  const addToken = async () => {
    if (!newToken.trim()) return
    setAdding(true)
    try {
      const r = await _dsAPI.addToken(newToken.trim())
      toast.success(r.data.detail)
      setNewToken('')
      loadConfig()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to add token')
    } finally {
      setAdding(false)
    }
  }

  const removeToken = async (index: number) => {
    if (!window.confirm('Remove this account?')) return
    setRemovingIdx(index)
    try {
      const r = await _dsAPI.removeToken(index)
      toast.success(r.data.detail)
      loadConfig()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to remove')
    } finally {
      setRemovingIdx(null)
    }
  }

  const toggleFallback = async () => {
    if (!data) return
    setTogglingFB(true)
    try {
      const r = await _dsAPI.toggleFallback(!data.fallback_enabled)
      toast.success(r.data.detail)
      loadConfig()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to toggle')
    } finally {
      setTogglingFB(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#15b79e'
      case 'error': return '#f43f5e'
      case 'invalid': return '#f59e0b'
      default: return '#6b7280'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircleIcon className="w-5 h-5" style={{ color: '#15b79e' }} />
      case 'error': return <XCircleIcon className="w-5 h-5" style={{ color: '#f43f5e' }} />
      case 'invalid': return <ExclamationTriangleIcon className="w-5 h-5" style={{ color: '#f59e0b' }} />
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
            Data Pipeline Configuration
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Manage data source accounts and fallback settings
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
              Total Accounts
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {data.total_accounts}
            </div>
          </div>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Active Accounts
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#15b79e' }}>
              {data.active_accounts}
            </div>
          </div>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Fallback
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: data.fallback_enabled ? '#15b79e' : '#f59e0b',
              }}>
                {data.fallback_enabled ? 'Enabled' : 'Disabled'}
              </span>
              <button
                onClick={toggleFallback}
                disabled={togglingFB}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-primary)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  opacity: togglingFB ? 0.5 : 1,
                }}
              >
                {togglingFB ? '...' : (data.fallback_enabled ? 'Disable' : 'Enable')}
              </button>
            </div>
          </div>
        </div>

        {/* Add Token */}
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '0.75rem',
          }}>
            Add New Account
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={newToken}
              onChange={e => setNewToken(e.target.value)}
              placeholder="apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="input"
              style={{
                flex: 1,
                fontFamily: 'monospace',
                fontSize: '0.8rem',
              }}
              onKeyDown={e => e.key === 'Enter' && addToken()}
            />
            <button
              onClick={addToken}
              disabled={adding || !newToken.trim()}
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.8rem',
                opacity: adding || !newToken.trim() ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              <PlusIcon className="w-4 h-4" />
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
          <p style={{
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            marginTop: '0.5rem',
          }}>
            Token will be validated against the API before saving. Duplicates are automatically detected.
          </p>
        </div>

        {/* Accounts List */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-primary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              Configured Accounts ({data.accounts.length})
            </span>
            <button
              onClick={loadConfig}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.75rem',
                padding: '0.375rem 0.75rem',
              }}
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {data.accounts.length === 0 ? (
            <div style={{
              padding: '3rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
            }}>
              No accounts configured. Add a token above to get started.
            </div>
          ) : (
            <div>
              {data.accounts.map((acct, i) => {
                const usagePct = acct.usage
                  ? Math.min((acct.usage.monthly_usage_usd / (acct.usage.monthly_limit_usd || 5)) * 100, 100)
                  : 0

                return (
                  <div
                    key={i}
                    style={{
                      padding: '1rem 1.25rem',
                      borderBottom: i < data.accounts.length - 1 ? '1px solid var(--border-primary)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                    }}
                  >
                    {/* Status Icon */}
                    <div style={{ flexShrink: 0 }}>
                      {getStatusIcon(acct.status)}
                    </div>

                    {/* Account Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.25rem',
                      }}>
                        <span style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}>
                          {acct.email || `Account #${acct.index + 1}`}
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
                        {acct.plan && (
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '1rem',
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-primary)',
                          }}>
                            {acct.plan}
                          </span>
                        )}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                      }}>
                        <span style={{ fontFamily: 'monospace' }}>
                          {acct.token_preview}
                        </span>
                        {acct.username && <span>@{acct.username}</span>}
                        {acct.error && (
                          <span style={{ color: '#f43f5e' }}>
                            {acct.error}
                          </span>
                        )}
                      </div>

                      {/* Usage Bar */}
                      {acct.usage && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            marginBottom: '0.25rem',
                          }}>
                            <span>
                              ${(acct.usage.monthly_usage_usd || 0).toFixed(2)} used
                            </span>
                            <span>
                              ${(acct.usage.monthly_limit_usd || 5).toFixed(2)} limit
                            </span>
                          </div>
                          <div style={{
                            height: 6,
                            borderRadius: 3,
                            background: 'var(--bg-elevated)',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%',
                              borderRadius: 3,
                              width: `${usagePct}%`,
                              background: usagePct > 80 ? '#f43f5e' : usagePct > 50 ? '#f59e0b' : '#15b79e',
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeToken(acct.index)}
                      disabled={removingIdx === acct.index}
                      style={{
                        flexShrink: 0,
                        padding: '0.5rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-primary)',
                        background: 'transparent',
                        color: '#f43f5e',
                        cursor: 'pointer',
                        opacity: removingIdx === acct.index ? 0.5 : 1,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f43f5e15')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      title="Remove account"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Info Footer */}
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem 1.25rem',
          borderRadius: '0.75rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}>
          <strong style={{ color: 'var(--text-secondary)' }}>How it works:</strong> Tokens are rotated
          randomly across accounts when fetching data. If one account's credits are exhausted,
          the system automatically switches to the next available account. When
          <strong style={{ color: 'var(--text-secondary)' }}> fallback is enabled</strong>,
          legacy scrapers (PRAW, RSS, DuckDuckGo) will be used as a last resort if all
          tokens are exhausted.
        </div>
      </div>
    </div>
  )
}
