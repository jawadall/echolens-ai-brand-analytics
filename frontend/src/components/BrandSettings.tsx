import { useState } from 'react'
import toast from 'react-hot-toast'
import { brandsAPI } from '../api/client'
import { Brand } from '../types'

interface BrandSettingsProps {
  brand: Brand
  brandId: number
  fetchingLive: boolean
  onFetchLiveData: () => void
  onDeleteBrand: () => void
  onRefresh: () => void
}

export default function BrandSettings({ brand, brandId, fetchingLive, onFetchLiveData, onDeleteBrand, onRefresh }: BrandSettingsProps) {
  const [editForm, setEditForm] = useState({
    name: brand.name || '',
    description: brand.description || '',
    website: brand.website || '',
    industry: brand.industry || '',
    keywords: brand.keywords?.join(', ') || '',
  })
  const [fetchFreq, setFetchFreq] = useState(brand.fetch_frequency || 60)
  const [alertEnabled, setAlertEnabled] = useState(brand.alert_enabled !== false)
  const [alertThreshold, setAlertThreshold] = useState(Math.round((brand.alert_threshold || 0.3) * 100))
  const [alertEmail, setAlertEmail] = useState(brand.alert_email || '')
  const [saving, setSaving] = useState(false)

  const ALL_PLATFORMS = ['youtube', 'reddit', 'twitter', 'news', 'facebook']
  const [enabledPlatforms, setEnabledPlatforms] = useState<string[]>(brand.platforms || ALL_PLATFORMS)

  const togglePlatform = (platform: string) => {
    setEnabledPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  const platformLabels: Record<string, string> = {
    youtube: '▶ YouTube',
    reddit: '🔴 Reddit',
    twitter: '𝕏 Twitter/X',
    news: '📰 News',
    facebook: 'f Facebook',
  }

  const handleSaveBrand = async () => {
    setSaving(true)
    try {
      await brandsAPI.update(brandId, {
        name: editForm.name,
        description: editForm.description,
        website: editForm.website,
        industry: editForm.industry,
        keywords: editForm.keywords.split(',').map((k: string) => k.trim()).filter(Boolean),
        platforms: enabledPlatforms,
        fetch_frequency: fetchFreq,
        alert_enabled: alertEnabled,
        alert_threshold: alertThreshold / 100,
        alert_email: alertEmail,
      })
      toast.success('Brand settings saved!')
      onRefresh()
    } catch { toast.error('Failed to save settings') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Brand Information */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Brand Information</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Brand Name</label>
            <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="input w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Description</label>
            <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="input w-full text-sm" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Industry</label>
              <select value={editForm.industry} onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))} className="input w-full text-sm">
                <option value="">Select Industry</option>
                {['Technology', 'Healthcare', 'Finance', 'Retail', 'Food & Beverage', 'Entertainment', 'Education', 'Automotive', 'Fashion', 'Real Estate', 'Other'].map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Website</label>
              <input value={editForm.website} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} className="input w-full text-sm" placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Keywords <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(comma separated)</span></label>
            <input value={editForm.keywords} onChange={e => setEditForm(f => ({ ...f, keywords: e.target.value }))} className="input w-full text-sm" placeholder="brand name, product, #hashtag" />
          </div>
        </div>
      </div>

      {/* Platforms */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Platforms</h3>
        <p className="text-[10px] mb-4" style={{ color: 'var(--text-muted)' }}>Enable or disable data sources for this brand</p>
        <div className="space-y-2">
          {ALL_PLATFORMS.map(platform => {
            const enabled = enabledPlatforms.includes(platform)
            return (
              <div key={platform}
                className="flex items-center justify-between p-3 rounded-xl transition-colors"
                style={{
                  background: enabled ? 'rgba(99,102,241,0.06)' : 'var(--bg-elevated)',
                  border: `1px solid ${enabled ? 'rgba(99,102,241,0.2)' : 'var(--border-primary)'}`,
                }}>
                <span className="text-xs font-medium" style={{ color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {platformLabels[platform] || platform}
                </span>
                <button onClick={() => togglePlatform(platform)}
                  className="relative w-10 h-[22px] rounded-full transition-colors"
                  style={{ background: enabled ? 'var(--primary-500, #6366f1)' : '#4b5563' }}>
                  <span className="absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: enabled ? '22px' : '3px' }} />
                </button>
              </div>
            )
          })}
          {enabledPlatforms.length === 0 && (
            <p className="text-xs text-rose-400 mt-1">⚠ At least one platform should be enabled</p>
          )}
        </div>
      </div>

      {/* Data Fetching Settings */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Data Fetching</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Auto-Fetch Interval</label>
            <select value={fetchFreq} onChange={e => setFetchFreq(parseInt(e.target.value))} className="input w-full text-sm">
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every 1 hour</option>
              <option value={120}>Every 2 hours</option>
              <option value={360}>Every 6 hours</option>
              <option value={720}>Every 12 hours</option>
              <option value={1440}>Every 24 hours</option>
              <option value={0}>Manual only</option>
            </select>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
            <div className="flex-1">
              <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Last Fetched</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{brand.last_fetch ? new Date(brand.last_fetch).toLocaleString() : 'Never'}</p>
            </div>
            <button onClick={onFetchLiveData} disabled={fetchingLive} className="btn-secondary text-xs px-3 py-1.5">
              {fetchingLive ? 'Fetching...' : 'Fetch Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Alert Settings */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Alert Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Enable Alerts</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Get notified about sentiment spikes and anomalies</p>
            </div>
            <button onClick={() => setAlertEnabled(!alertEnabled)}
              className="relative w-10 h-[22px] rounded-full transition-colors"
              style={{ background: alertEnabled ? 'var(--primary-500, #6366f1)' : '#4b5563' }}>
              <span className="absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: alertEnabled ? '22px' : '3px' }} />
            </button>
          </div>
          {alertEnabled && (
            <>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Negative Sentiment Threshold: <span className="text-primary-400">{alertThreshold}%</span>
                </label>
                <input type="range" min={5} max={80} value={alertThreshold} onChange={e => setAlertThreshold(parseInt(e.target.value))}
                  className="w-full accent-primary-500" />
                <div className="flex justify-between text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  <span>5% (Sensitive)</span><span>80% (Relaxed)</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Alert Email</label>
                <input type="email" value={alertEmail} onChange={e => setAlertEmail(e.target.value)} className="input w-full text-sm" placeholder="alerts@company.com" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Save Button */}
      <button onClick={handleSaveBrand} disabled={saving} className="btn-primary w-full text-sm py-2.5">
        {saving ? 'Saving...' : 'Save All Settings'}
      </button>

      {/* Danger Zone */}
      <div className="card p-5" style={{ borderColor: 'rgba(244, 63, 94, 0.2)' }}>
        <h3 className="text-sm font-semibold mb-2 text-rose-400">Danger Zone</h3>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Permanently delete this brand and all associated data.</p>
        <button onClick={onDeleteBrand} className="btn-danger text-sm">Delete Brand</button>
      </div>
    </div>
  )
}
