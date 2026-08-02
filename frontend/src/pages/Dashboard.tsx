import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  ArrowPathIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { analyticsAPI, brandsAPI, adminAPI, subscriptionsAPI } from '../api/client'
import { Brand, DashboardOverview } from '../types'
import ConnectorStatus from '../components/ConnectorStatus'
import UpgradeBanner from '../components/UpgradeBanner'
import { useAuthStore } from '../store/authStore'
import { usePermissions } from '../hooks/usePermissions'

// Sentiment color helper
const getSentimentColor = (score: number) => {
  if (score > 0.1) return 'text-emerald-400'
  if (score < -0.1) return 'text-rose-400'
  return 'text-amber-400'
}



export default function Dashboard() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [dashboard, setDashboard] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNewBrandModal, setShowNewBrandModal] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [platformStatus, setPlatformStatus] = useState<Record<string, boolean>>({})
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { canCreateBrand, isAdmin } = usePermissions()

  // Plan limits — always use live data
  const companyInfo = (user as any)?.company_info
  const maxBrands = companyInfo?.brands_limit || (user as any)?.max_brands || 1
  const currentBrands = brands.length  // Always use actual brand count from API
  const plan = companyInfo?.plan || (user as any)?.subscription_plan || 'free'

  useEffect(() => {
    fetchData()
    // Refresh company_info to keep plan/limit data current
    subscriptionsAPI.getCurrent().then((res: any) => {
      if (res.data?.company_info) {
        const { updateUser } = useAuthStore.getState()
        updateUser({ company_info: res.data.company_info } as any)
      }
    }).catch(() => {})
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [brandsRes, dashboardRes] = await Promise.all([
        brandsAPI.list(),
        analyticsAPI.getDashboard(),
      ])
      setBrands(brandsRes.data.results || brandsRes.data)
      setDashboard(dashboardRes.data)
      // Fetch platform status (non-blocking)
      adminAPI.getPlatformStatus().then(r => {
        // Map detailed status to simple boolean for dot rendering
        const statusBooleans: Record<string, boolean> = {}
        Object.entries(r.data).forEach(([key, val]: [string, any]) => {
          statusBooleans[key] = typeof val === 'object' ? val.online : val !== false
        })
        setPlatformStatus(statusBooleans)
      }).catch(() => {})
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFetchLiveData = async (brandId: number) => {
    try {
      toast.loading('Fetching live data from platforms...', { id: 'fetch' })
      await brandsAPI.fetchLiveData(brandId)
      toast.success('Live data fetched! Refreshing...', { id: 'fetch' })
      await fetchData()
    } catch (error) {
      toast.error('Failed to fetch live data', { id: 'fetch' })
    }
  }

  const handleDeleteBrand = async (brandId: number, brandName: string) => {
    if (!confirm(`Are you sure you want to delete "${brandName}"? This will also delete all associated posts and data.`)) {
      return
    }

    try {
      toast.loading('Deleting brand...', { id: 'delete' })
      await brandsAPI.delete(brandId)
      toast.success('Brand deleted successfully', { id: 'delete' })
      await fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete brand', { id: 'delete' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Monitor your brand's digital presence
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
              {currentBrands}/{maxBrands} brands
            </span>
          </p>
        </div>
        {/* Only admin/analyst can add brands, viewers cannot */}
        {canCreateBrand && (
          <button
            onClick={() => {
              if (currentBrands >= maxBrands) {
                setShowLimitModal(true)
                return
              }
              setShowNewBrandModal(true)
            }}
            className="btn-primary inline-flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Add Brand
            {currentBrands < maxBrands && (
              <span className="text-xs opacity-75">({maxBrands - currentBrands} left)</span>
            )}
          </button>
        )}
      </div>

      {/* Plan Limit Banner — only for admins when usage > 80% */}
      {isAdmin && currentBrands > maxBrands * 0.8 && (
        <UpgradeBanner type="brands" current={currentBrands} limit={maxBrands} plan={plan} />
      )}

      {/* Stats Grid */}
      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Total Brands</p>
              <p className="text-3xl font-bold mt-2" style={{ color: 'var(--text-primary)' }}>{dashboard.total_brands}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Active monitoring</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Total Posts</p>
              <p className="text-3xl font-bold mt-2" style={{ color: 'var(--text-primary)' }}>{dashboard.total_posts.toLocaleString()}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Analyzed this month</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Overall Sentiment</p>
              <p className={`text-3xl font-bold mt-2 ${getSentimentColor(dashboard.overall_sentiment)}`}>
                {dashboard.overall_sentiment > 0 ? '+' : ''}{(dashboard.overall_sentiment * 100).toFixed(1)}%
              </p>
              <div className="flex items-center gap-1 mt-1">
                {dashboard.overall_sentiment > 0 ? (
                  <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ArrowTrendingDownIcon className="w-4 h-4 text-rose-400" />
                )}
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>vs last period</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Active Alerts</p>
              <p className="text-3xl font-bold mt-2" style={{ color: 'var(--text-primary)' }}>{dashboard.total_alerts}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Require attention</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Connector Status */}
      <ConnectorStatus />

      {/* Brands Section */}
      <div>
        <h2 className="text-xl font-display font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Your Brands</h2>
        
        {brands.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-12 text-center"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-500/10 flex items-center justify-center">
              <SparklesIcon className="w-8 h-8 text-primary-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>No Brands Yet</h3>
            <p className="mb-6 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Start monitoring your brand's presence across social media. Add your first brand to get started.
            </p>
            <button
              onClick={() => setShowNewBrandModal(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              Add Your First Brand
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brands.map((brand, index) => (
              <motion.div
                key={brand.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="card card-hover p-6 cursor-pointer"
                onClick={() => navigate(`/brands/${brand.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {brand.logo ? (
                      <img
                        src={brand.logo}
                        alt={brand.name}
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-lg">
                        {brand.name[0]}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{brand.name}</h3>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{brand.industry || 'General'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      brand.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {brand.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteBrand(brand.id, brand.name)
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete brand"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sentiment Distribution */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span style={{ color: 'var(--text-muted)' }}>Sentiment</span>
                    <span className={getSentimentColor(brand.avg_sentiment)}>
                      {brand.avg_sentiment > 0 ? '+' : ''}{(brand.avg_sentiment * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--bg-elevated)' }}>
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${(brand.sentiment_distribution?.positive || 0) * 100}%` }}
                    />
                    <div
                      className="bg-amber-500 h-full transition-all"
                      style={{ width: `${(brand.sentiment_distribution?.neutral || 0) * 100}%` }}
                    />
                    <div
                      className="bg-rose-500 h-full transition-all"
                      style={{ width: `${(brand.sentiment_distribution?.negative || 0) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <ChatBubbleLeftRightIcon className="w-4 h-4 flex-shrink-0" />
                    <span>{brand.total_posts || brand.posts_count || 0} posts</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap overflow-hidden max-h-[26px]">
                    {brand.platforms?.slice(0, 5).map((platform) => {
                      const isActive = platformStatus[platform] !== false
                      return (
                        <span
                          key={platform}
                          className="px-1.5 py-0.5 rounded text-[11px] flex items-center gap-1 whitespace-nowrap"
                          style={{
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-muted)',
                            opacity: isActive ? 1 : 0.5,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: isActive ? '#22c55e' : '#6b7280' }} />
                          {platform}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Fetch Live Data Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleFetchLiveData(brand.id)
                  }}
                  className="mt-4 w-full btn-secondary text-sm flex items-center justify-center gap-2"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  {brand.total_posts === 0 ? 'Fetch Live Data' : 'Refresh Data'}
                </button>
              </motion.div>
            ))}

            {/* Add Brand Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: brands.length * 0.1 }}
              className="card border-2 border-dashed border-dark-700 hover:border-primary-500/50 p-6 cursor-pointer flex flex-col items-center justify-center min-h-[200px] transition-colors"
              onClick={() => canCreateBrand && setShowNewBrandModal(true)}
            >
              <div className="w-12 h-12 rounded-xl bg-dark-800 flex items-center justify-center mb-3">
                <PlusIcon className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-400 font-medium">Add New Brand</p>
            </motion.div>
          </div>
        )}
      </div>

      {/* New Brand Modal */}
      {showNewBrandModal && (
        <NewBrandModal
          onClose={() => setShowNewBrandModal(false)}
          onSuccess={() => {
            setShowNewBrandModal(false)
            fetchData()
          }}
        />
      )}

      {/* Brand Limit Reached Modal */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLimitModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative card p-6 w-full max-w-md text-center"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <SparklesIcon className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-xl font-display font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Brand Limit Reached
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Your <span className="font-semibold text-indigo-400">{plan.charAt(0).toUpperCase() + plan.slice(1)}</span> plan allows a maximum of{' '}
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{maxBrands} brand{maxBrands !== 1 ? 's' : ''}</span>.
              You are currently using all {currentBrands} slots.
            </p>
            <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
              Upgrade your plan to monitor more brands and unlock additional features.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLimitModal(false)} className="btn-secondary flex-1">
                Close
              </button>
              <button onClick={() => { setShowLimitModal(false); navigate('/subscription') }} className="btn-primary flex-1">
                Upgrade Plan
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

// New Brand Modal Component
function NewBrandModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    website: '',
    industry: '',
    keywords: '',
    platforms: ['youtube', 'reddit', 'twitter', 'news', 'facebook'],
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name) {
      toast.error('Brand name is required')
      return
    }
    
    setLoading(true)
    
    try {
      await brandsAPI.create({
        ...formData,
        keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
      })
      toast.success('Brand created successfully!')
      onSuccess()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create brand')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative card p-6 w-full max-w-lg"
      >
        <h2 className="text-xl font-display font-bold text-white mb-6">Add New Brand</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Brand Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full"
              placeholder="e.g., Nayatel"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input w-full h-20 resize-none"
              placeholder="Brief description of your brand"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="input w-full"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Industry
              </label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="input w-full"
                placeholder="e.g., Telecom"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Keywords (comma-separated)
            </label>
            <input
              type="text"
              value={formData.keywords}
              onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
              className="input w-full"
              placeholder="keyword1, keyword2, keyword3"
            />
            <p className="text-xs text-gray-500 mt-1">
              Keywords used to search for mentions of your brand
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Platforms
            </label>
            <div className="flex gap-3">
              {['youtube', 'reddit', 'twitter', 'news', 'facebook'].map((platform) => (
                <label key={platform} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.platforms.includes(platform)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, platforms: [...formData.platforms, platform] })
                      } else {
                        setFormData({
                          ...formData,
                          platforms: formData.platforms.filter((p) => p !== platform),
                        })
                      }
                    }}
                    className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-400 capitalize">{platform}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creating...' : 'Create Brand'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

