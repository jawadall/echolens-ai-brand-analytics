import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  ArrowLeftIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  DocumentArrowDownIcon,
  SparklesIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  HeartIcon,
  ShareIcon,
  EyeIcon,
  TrashIcon,
  ChartBarIcon,
  PresentationChartBarIcon,
  Cog6ToothIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline'
import { analyticsAPI, brandsAPI, exportsAPI, nlpAPI } from '../api/client'
import { Brand, BrandOverview, Post, TrendData, AISummary } from '../types'
import PlatformBadge from '../components/PlatformBadge'
import { SentimentGauge, EmotionRadar, WordCloud, PlatformComparison } from '../components/analytics'
import FormattedText, { FormattedParagraph, FormattedRecommendation } from '../components/analytics/FormattedText'
import BrandSettings from '../components/BrandSettings'
import { usePermissions } from '../hooks/usePermissions'

const SENTIMENT_COLORS = {
  positive: '#10b981',
  neutral: '#f59e0b',
  negative: '#f43f5e',
}

type Tab = 'overview' | 'posts' | 'analytics' | 'insights' | 'settings'

const EMOTION_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  joy: { bg: 'rgba(250,204,21,0.15)', text: '#facc15' },
  anger: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
  sadness: { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa' },
  fear: { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa' },
  surprise: { bg: 'rgba(251,146,60,0.15)', text: '#fb923c' },
  neutral: { bg: 'rgba(148,163,184,0.1)', text: '#94a3b8' },
}

export default function BrandDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const brandId = parseInt(id || '0')
  const { isViewer, canEditBrand, canAccessSettings } = usePermissions()
  const canEdit = canEditBrand

  const [brand, setBrand] = useState<Brand | null>(null)
  const [overview, setOverview] = useState<BrandOverview | null>(null)
  const [trends, setTrends] = useState<TrendData | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [summary, setSummary] = useState<AISummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(30)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [platformFilter, setPlatformFilter] = useState('all')
  const [fetchingLive, setFetchingLive] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [postsPage, setPostsPage] = useState(1)
  const [postsPerPage, setPostsPerPage] = useState(10)
  const [totalPostsCount, setTotalPostsCount] = useState(0)
  const [postsLoading, setPostsLoading] = useState(false)

  useEffect(() => {
    if (brandId) fetchData()
  }, [brandId, timeRange])

  // Fetch posts whenever page, perPage, or platform filter changes
  useEffect(() => {
    if (brandId) fetchPosts()
  }, [brandId, postsPage, postsPerPage, platformFilter])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [brandRes, overviewRes, trendsRes, summariesRes] = await Promise.all([
        brandsAPI.get(brandId),
        analyticsAPI.getBrandOverview(brandId, timeRange),
        analyticsAPI.getTrends(brandId, timeRange),
        analyticsAPI.getSummaries(brandId),
      ])
      setBrand(brandRes.data)
      setOverview(overviewRes.data)
      setTrends(trendsRes.data)
      const summaries = summariesRes.data.results || summariesRes.data
      if (summaries.length > 0) setSummary(summaries[0])
    } catch (error) {
      console.error('Failed to fetch brand data:', error)
      toast.error('Failed to load brand data')
    } finally {
      setLoading(false)
    }
  }

  // Fetch posts with server-side pagination
  const fetchPosts = async () => {
    setPostsLoading(true)
    try {
      const res = await brandsAPI.getPosts(brandId, {
        page: postsPage,
        platform: platformFilter !== 'all' ? platformFilter : undefined,
        page_size: postsPerPage,
      })
      // DRF pagination: { count, next, previous, results }
      const data = res.data
      if (data.results) {
        setPosts(data.results)
        setTotalPostsCount(data.count || 0)
      } else if (Array.isArray(data)) {
        setPosts(data)
        setTotalPostsCount(data.length)
      } else if (data.posts) {
        setPosts(data.posts)
        setTotalPostsCount(data.total || data.posts.length)
      }
    } catch {
      // handled
    } finally {
      setPostsLoading(false)
    }
  }

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true)
    try {
      const response = await nlpAPI.generateSummary(brandId, timeRange)
      toast.success('Summary generated!')
      // Map API response keys to AISummary type
      const data = response.data.summary || response.data
      setSummary({
        id: response.data.id || 0,
        summary_type: 'custom',
        start_date: response.data.period?.start || '',
        end_date: response.data.period?.end || '',
        summary_text: data.summary || data.summary_text || '',
        key_insights: data.key_insights || [],
        what_users_like: data.what_users_like || '',
        what_users_dislike: data.what_users_dislike || '',
        platform_analysis: data.platform_analysis || '',
        recommendations: data.recommendations || [],
        metrics_snapshot: data.metrics_snapshot || {},
        created_at: new Date().toISOString(),
      } as AISummary)
    } catch { toast.error('Failed to generate summary') }
    finally { setGeneratingSummary(false) }
  }

  const handleExportPDF = async () => {
    try {
      toast.loading('Generating PDF...', { id: 'pdf' })
      const response = await exportsAPI.exportPDF(brandId, timeRange)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url; link.download = `${brand?.name}_report.pdf`
      document.body.appendChild(link); link.click(); link.remove()
      toast.success('PDF downloaded!', { id: 'pdf' })
    } catch { toast.error('Failed to export PDF', { id: 'pdf' }) }
  }

  const handleExportCSV = async () => {
    try {
      toast.loading('Generating CSV...', { id: 'csv' })
      const response = await exportsAPI.exportPosts(brandId, { format: 'csv', days: timeRange })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url; link.download = `${brand?.name}_posts.csv`
      document.body.appendChild(link); link.click(); link.remove()
      toast.success('CSV downloaded!', { id: 'csv' })
    } catch { toast.error('Failed to export CSV', { id: 'csv' }) }
  }

  const handleFetchLiveData = async () => {
    setFetchingLive(true)
    try {
      toast.loading('Fetching live data...', { id: 'live' })
      await brandsAPI.fetchLiveData(brandId)
      toast.success('Live data fetched!', { id: 'live' })
      await fetchData()
    } catch { toast.error('Failed to fetch live data', { id: 'live' }) }
    finally { setFetchingLive(false) }
  }

  const handleDeleteBrand = async () => {
    if (!brand) return
    if (!confirm(`Delete "${brand.name}"? All data will be lost.`)) return
    try {
      toast.loading('Deleting...', { id: 'delete' })
      await brandsAPI.delete(brandId)
      toast.success('Brand deleted', { id: 'delete' })
      navigate('/dashboard')
    } catch (error: any) { toast.error(error.response?.data?.error || 'Failed', { id: 'delete' }) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
    </div>
  )

  if (!brand || !overview) return (
    <div className="text-center py-12"><p style={{ color: 'var(--text-muted)' }}>Brand not found</p></div>
  )

  const trendChartData = trends?.labels.map((label, i) => ({
    date: new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    total: trends.datasets.total[i],
    positive: trends.datasets.positive[i],
    neutral: trends.datasets.neutral[i],
    negative: trends.datasets.negative[i],
    sentiment: trends.datasets.sentiment_score[i],
  })) || []

  const sentimentPieData = [
    { name: 'Positive', value: overview.sentiment.positive, color: SENTIMENT_COLORS.positive },
    { name: 'Neutral', value: overview.sentiment.neutral, color: SENTIMENT_COLORS.neutral },
    { name: 'Negative', value: overview.sentiment.negative, color: SENTIMENT_COLORS.negative },
  ]

  const platformBreakdown = overview.all_time_platform_breakdown || overview.platform_breakdown || {}

  // Aggregate emotion data from posts
  const aggregatedEmotions = (() => {
    const emotionTotals: Record<string, number> = {}
    let count = 0
    posts.forEach(p => {
      if (p.emotions && typeof p.emotions === 'object') {
        Object.entries(p.emotions).forEach(([key, val]) => {
          emotionTotals[key] = (emotionTotals[key] || 0) + (val as number)
        })
        count++
      }
    })
    if (count === 0) return { joy: 0.3, trust: 0.25, anticipation: 0.2, surprise: 0.15, sadness: 0.05, anger: 0.03, fear: 0.02 }
    const result: Record<string, number> = {}
    Object.entries(emotionTotals).forEach(([key, val]) => {
      result[key] = val / count
    })
    return result
  })()

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    { id: 'posts', label: 'Posts', icon: ChatBubbleLeftRightIcon },
    { id: 'analytics', label: 'Analytics', icon: PresentationChartBarIcon },
    { id: 'insights', label: 'AI Insights', icon: SparklesIcon },
    ...(canAccessSettings ? [{ id: 'settings' as Tab, label: 'Settings', icon: Cog6ToothIcon }] : []),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg btn-ghost">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            {brand.logo ? (
              <img src={brand.logo} alt={brand.name} className="w-12 h-12 rounded-xl object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ background: 'var(--gradient-primary)' }}>
                {brand.name[0]}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>{brand.name}</h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{brand.industry || 'Brand Monitoring'}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select value={timeRange} onChange={(e) => setTimeRange(parseInt(e.target.value))} className="input py-2 text-sm">
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          {/* Export buttons — hidden for viewers */}
          {canEdit && (
            <>
              <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-1.5 text-sm py-2 px-4">
                <DocumentArrowDownIcon className="w-4 h-4" /> CSV
              </button>
              <button onClick={handleExportPDF} className="btn-primary flex items-center gap-1.5 text-sm py-2 px-4">
                <DocumentArrowDownIcon className="w-4 h-4" /> PDF
              </button>
            </>
          )}
          {/* Fetch & Delete — hidden for viewers */}
          {canEdit && (
            <>
              <button onClick={handleFetchLiveData} disabled={fetchingLive} className="btn-secondary flex items-center gap-1.5 text-sm py-2 px-4">
                <ArrowPathIcon className={`w-4 h-4 ${fetchingLive ? 'animate-spin' : ''}`} />
                {fetchingLive ? 'Fetching...' : 'Refresh'}
              </button>
              <button onClick={handleDeleteBrand} className="p-2 rounded-lg hover:bg-rose-500/10 transition-colors" style={{ color: 'var(--text-muted)' }} title="Delete brand">
                <TrashIcon className="w-4 h-4 hover:text-rose-400" />
              </button>
            </>
          )}
          {isViewer && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 font-medium">Read-only</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`tab-btn flex items-center gap-2 whitespace-nowrap ${activeTab === t.id ? 'active' : ''}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total Posts', value: (overview.total_all_time || overview.total_posts).toLocaleString(), sub: `${overview.total_posts} in period` },
              { label: 'Avg Sentiment', value: `${overview.sentiment.average_score > 0 ? '+' : ''}${(overview.sentiment.average_score * 100).toFixed(1)}%`, color: overview.sentiment.average_score > 0 ? 'text-emerald-400' : overview.sentiment.average_score < 0 ? 'text-rose-400' : 'text-amber-400' },
              { label: 'Likes', value: overview.engagement.total_likes.toLocaleString(), icon: HeartIcon },
              { label: 'Shares', value: overview.engagement.total_shares.toLocaleString(), icon: ShareIcon },
              { label: 'Views', value: (overview.engagement.total_views || 0).toLocaleString(), icon: EyeIcon },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="stat-card">
                <div className="relative z-10">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                  <p className={`text-xl font-bold mt-1 ${s.color || ''}`} style={s.color ? {} : { color: 'var(--text-primary)' }}>{s.value}</p>
                  {s.sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.sub}</p>}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Platform Distribution */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Platform Distribution</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { key: 'youtube', label: 'YouTube', icon: 'YT', color: 'text-red-400', bg: 'from-red-500/15 to-red-500/5 border-red-500/20' },
                { key: 'reddit', label: 'Reddit', icon: 'R', color: 'text-orange-400', bg: 'from-orange-500/15 to-orange-500/5 border-orange-500/20' },
                { key: 'twitter', label: 'Twitter/X', icon: 'X', color: 'text-sky-400', bg: 'from-sky-500/15 to-sky-500/5 border-sky-500/20' },
                { key: 'news', label: 'News', icon: 'N', color: 'text-emerald-400', bg: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20' },
                { key: 'facebook', label: 'Facebook', icon: 'f', color: 'text-blue-400', bg: 'from-blue-500/15 to-blue-500/5 border-blue-500/20' },
              ].map(p => {
                const count = platformBreakdown[p.key] || 0
                const total = Object.values(platformBreakdown).reduce((a: number, b: any) => a + (b as number), 0) || 1
                return (
                  <div key={p.key} className={`p-3 rounded-xl bg-gradient-to-br ${p.bg} border text-center transition-all hover:scale-[1.03]`}>
                    <div className={`text-lg font-bold ${p.color}`}>{p.icon}</div>
                    <div className="text-xs font-medium mt-1" style={{ color: 'var(--text-primary)' }}>{p.label}</div>
                    <div className={`text-lg font-bold ${p.color} mt-0.5`}>{count}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{((count / (total as number)) * 100).toFixed(0)}%</div>
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Sentiment Trend</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendChartData}>
                    <defs>
                      <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorNeg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tick={{ fill: 'var(--text-muted)' }} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tick={{ fill: 'var(--text-muted)' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '12px', color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-secondary)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                    <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '11px' }} />
                    <Area type="monotone" dataKey="positive" stroke="#10b981" fillOpacity={1} fill="url(#colorPos)" name="Positive" />
                    <Area type="monotone" dataKey="negative" stroke="#f43f5e" fillOpacity={1} fill="url(#colorNeg)" name="Negative" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card p-5">
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Sentiment Split</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sentimentPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                      {sentimentPieData.map((e, idx) => <Cell key={idx} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '12px', color: 'var(--text-primary)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {sentimentPieData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} /> {d.name}: {d.value}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Topics */}
          {overview.trending_topics.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="card p-5">
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Trending Topics</h3>
              <div className="flex flex-wrap gap-2">
                {overview.trending_topics.map((topic, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                    {topic.topic} <span style={{ color: 'var(--text-muted)' }}>({topic.count})</span>
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Posts Tab */}
      {activeTab === 'posts' && (() => {
        const totalPages = Math.max(1, Math.ceil(totalPostsCount / postsPerPage))
        const safePage = Math.min(postsPage, totalPages)
        const startIdx = (safePage - 1) * postsPerPage + 1
        const endIdx = Math.min(safePage * postsPerPage, totalPostsCount)

        return (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {['all', 'youtube', 'reddit', 'twitter', 'news', 'facebook'].map(p => (
                <button key={p} onClick={() => { setPlatformFilter(p); setPostsPage(1) }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    platformFilter === p ? 'bg-primary-500 text-white' : ''
                  }`}
                  style={platformFilter !== p ? { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' } : {}}>
                  {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Per page:</span>
              <select value={postsPerPage} onChange={e => { setPostsPerPage(parseInt(e.target.value)); setPostsPage(1) }}
                className="input py-1 px-2 text-xs" style={{ minWidth: '60px' }}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {totalPostsCount > 0 && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Showing {startIdx}–{endIdx} of {totalPostsCount.toLocaleString()} posts
            </p>
          )}

          {postsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : (
          <div className="space-y-3">
            {posts.map((post, i) => (
              <motion.div key={post.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <PlatformBadge platform={post.platform} />
                      <span className={`badge text-[10px] ${post.sentiment === 'positive' ? 'badge-positive' : post.sentiment === 'negative' ? 'badge-negative' : 'badge-neutral'}`}>
                        {post.sentiment || 'unprocessed'}
                      </span>
                      {post.emotions && Object.keys(post.emotions).length > 0 && (() => {
                        const topEmotion = Object.entries(post.emotions).sort((a, b) => b[1] - a[1])[0]
                        if (!topEmotion || topEmotion[1] <= 0) return null
                        const colors = EMOTION_BADGE_COLORS[topEmotion[0]] || EMOTION_BADGE_COLORS.neutral
                        return (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.text}33` }}>
                            {topEmotion[0]}
                          </span>
                        )
                      })()}
                      {post.author_verified && <span className="text-primary-400 text-[10px] inline-flex items-center gap-0.5">Verified</span>}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{post.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>@{post.author_username}</span>
                      <span className="flex items-center gap-1"><HeartIcon className="w-3 h-3" /> {post.likes}</span>
                      <span className="flex items-center gap-1"><ShareIcon className="w-3 h-3" /> {post.shares}</span>
                      <span className="flex items-center gap-1"><ChatBubbleLeftRightIcon className="w-3 h-3" /> {post.comments}</span>
                    </div>
                  </div>
                  {post.url && (
                    <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300 text-xs whitespace-nowrap font-medium">
                      View 
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
            {posts.length === 0 && (
              <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>No posts found for this filter</p>
            )}
          </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button onClick={() => setPostsPage(Math.max(1, safePage - 1))} disabled={safePage <= 1}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Previous</button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let page: number
                  if (totalPages <= 7) { page = i + 1 }
                  else if (safePage <= 4) { page = i + 1 }
                  else if (safePage >= totalPages - 3) { page = totalPages - 6 + i }
                  else { page = safePage - 3 + i }
                  return (
                    <button key={page} onClick={() => setPostsPage(page)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                        page === safePage ? 'bg-primary-500 text-white' : 'btn-ghost'
                      }`}>{page}</button>
                  )
                })}
              </div>
              <button onClick={() => setPostsPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
        )
      })()}

      {/* Analytics Dashboard Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Sentiment Gauge + Emotion Radar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <ChartBarIcon className="w-4 h-4 text-primary-400" /> Sentiment Gauge
              </h4>
              <div className="flex justify-center">
                <SentimentGauge score={overview.sentiment.average_score || 0} label={`Based on ${overview.total_all_time || overview.total_posts} posts`} />
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-5">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <SparklesIcon className="w-4 h-4 text-primary-400" /> Emotion Analysis
              </h4>
              <EmotionRadar emotions={aggregatedEmotions} height={260} />
            </motion.div>
          </div>

          {/* Sentiment Over Time */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-5">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <ChartBarIcon className="w-4 h-4 text-primary-400" /> Sentiment Over Time
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendChartData}>
                  <defs>
                    <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tick={{ fill: 'var(--text-muted)' }} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} domain={[-1, 1]} tick={{ fill: 'var(--text-muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '12px', color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-secondary)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                  <Area type="monotone" dataKey="sentiment" stroke="#6366f1" fill="url(#sentGrad)" name="Sentiment Score" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Post Volume + Top Authors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Post Volume by Day */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card p-5">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <EyeIcon className="w-4 h-4 text-primary-400" /> Post Volume by Day
              </h4>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tick={{ fill: 'var(--text-muted)' }} />
                    <YAxis stroke="var(--text-muted)" fontSize={10} tick={{ fill: 'var(--text-muted)' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '12px', color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-secondary)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                    <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} name="Total Posts" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Top Authors */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card p-5">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <HeartIcon className="w-4 h-4 text-primary-400" /> Top Authors
              </h4>
              <div className="h-56">
                {(() => {
                  const authorCounts: Record<string, number> = {}
                  posts.forEach(p => { authorCounts[p.author_username || 'unknown'] = (authorCounts[p.author_username || 'unknown'] || 0) + 1 })
                  const topAuthors = Object.entries(authorCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name: name.length > 12 ? name.slice(0, 12) + '…' : name, posts: count }))
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topAuthors} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                        <XAxis type="number" stroke="var(--text-muted)" fontSize={10} tick={{ fill: 'var(--text-muted)' }} />
                        <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={10} width={90} tick={{ fill: 'var(--text-secondary)' }} />
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '12px', color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-secondary)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                        <Bar dataKey="posts" fill="#10b981" radius={[0, 4, 4, 0]} name="Posts" />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                })()}
              </div>
            </motion.div>
          </div>

          {/* Engagement Radar + Sentiment vs Engagement */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Engagement by Platform Radar */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="card p-5">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <ShareIcon className="w-4 h-4 text-primary-400" /> Engagement by Platform
              </h4>
              <div className="h-64">
                {(() => {
                  const platEngagement: Record<string, { likes: number; shares: number; comments: number; count: number }> = {}
                  posts.forEach(p => {
                    if (!platEngagement[p.platform]) platEngagement[p.platform] = { likes: 0, shares: 0, comments: 0, count: 0 }
                    platEngagement[p.platform].likes += p.likes || 0
                    platEngagement[p.platform].shares += p.shares || 0
                    platEngagement[p.platform].comments += p.comments || 0
                    platEngagement[p.platform].count += 1
                  })
                  const barData = Object.entries(platEngagement).map(([platform, d]) => ({
                    platform: platform.charAt(0).toUpperCase() + platform.slice(1),
                    Likes: d.count > 0 ? Math.round(d.likes / d.count) : 0,
                    Shares: d.count > 0 ? Math.round(d.shares / d.count) : 0,
                    Comments: d.count > 0 ? Math.round(d.comments / d.count) : 0,
                  }))
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} layout="vertical" barGap={2} barSize={10}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                        <XAxis type="number" stroke="var(--text-muted)" fontSize={10} tick={{ fill: 'var(--text-muted)' }} />
                        <YAxis dataKey="platform" type="category" stroke="var(--text-muted)" fontSize={11} width={70} tick={{ fill: 'var(--text-secondary)' }} />
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '12px', color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-secondary)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                        <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '11px' }} />
                        <Bar dataKey="Likes" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="Shares" fill="#6366f1" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="Comments" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                })()}
              </div>
            </motion.div>

            {/* Sentiment vs Engagement Scatter */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card p-5">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <SparklesIcon className="w-4 h-4 text-primary-400" /> Sentiment vs Engagement
              </h4>
              <div className="h-64">
                {(() => {
                  const scatterData = posts.slice(0, 100).map(p => ({
                    sentiment: p.sentiment_score != null ? +(p.sentiment_score * 100).toFixed(1) : 0,
                    engagement: (p.likes || 0) + (p.shares || 0) + (p.comments || 0),
                    platform: p.platform,
                  })).filter(d => d.engagement > 0)
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                        <XAxis dataKey="sentiment" name="Sentiment" stroke="var(--text-muted)" fontSize={10} tick={{ fill: 'var(--text-muted)' }} label={{ value: 'Sentiment %', position: 'insideBottom', offset: -5, style: { fill: 'var(--text-muted)', fontSize: 10 } }} />
                        <YAxis dataKey="engagement" name="Engagement" stroke="var(--text-muted)" fontSize={10} tick={{ fill: 'var(--text-muted)' }} label={{ value: 'Engagement', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)', fontSize: 10 } }} />
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '12px', color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-secondary)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                        <Scatter data={scatterData} fill="#8b5cf6" fillOpacity={0.6} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  )
                })()}
              </div>
            </motion.div>
          </div>

          {/* Word Cloud + Platform Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="card p-5">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <ChatBubbleLeftRightIcon className="w-4 h-4 text-primary-400" /> Trending Topics
              </h4>
              <WordCloud posts={posts} maxWords={35} />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="card p-5">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <ChartBarIcon className="w-4 h-4 text-primary-400" /> Platform Comparison
              </h4>
              <PlatformComparison platformBreakdown={platformBreakdown} posts={posts} />
            </motion.div>
          </div>
        </div>
      )}

      {/* AI Insights Tab */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {/* AI Summary Section */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <SparklesIcon className="w-4 h-4 text-primary-400" /> AI Executive Summary
              </h3>
              <button onClick={handleGenerateSummary} disabled={generatingSummary} className="btn-secondary text-xs flex items-center gap-1.5">
                {generatingSummary ? <><ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> Generating...</> : <><SparklesIcon className="w-3.5 h-3.5" /> Generate</>}
              </button>
            </div>

            {summary ? (
              <div className="space-y-5">
                {/* Executive Summary */}
                <div className="p-5 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
                  <h4 className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Executive Overview</h4>
                  <FormattedParagraph text={summary.summary_text} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }} />
                </div>

                {/* Key Insights */}
                {summary.key_insights?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold mb-3 uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <ChartBarIcon className="w-3.5 h-3.5 text-primary-400" /> Key Insights
                    </h4>
                    <div className="space-y-2">
                      {summary.key_insights.map((insight, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-3 rounded-lg"
                          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}
                        >
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}>
                            <span className="text-[10px] font-bold text-primary-400">{i + 1}</span>
                          </div>
                          <FormattedText text={insight} className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* What users like / dislike */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {summary.what_users_like && (
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <h4 className="text-xs font-semibold mb-3 flex items-center gap-2 text-emerald-400 uppercase tracking-wider">
                        <ArrowTrendingUpIcon className="w-3.5 h-3.5" /> Positive Drivers
                      </h4>
                      <FormattedParagraph text={summary.what_users_like} className="text-sm" style={{ color: 'var(--text-secondary)' }} />
                    </div>
                  )}
                  {summary.what_users_dislike && (
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(244, 63, 94, 0.06)', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                      <h4 className="text-xs font-semibold mb-3 flex items-center gap-2 text-rose-400 uppercase tracking-wider">
                        <ArrowTrendingDownIcon className="w-3.5 h-3.5" /> Negative Drivers
                      </h4>
                      <FormattedParagraph text={summary.what_users_dislike} className="text-sm" style={{ color: 'var(--text-secondary)' }} />
                    </div>
                  )}
                </div>

                {/* Platform Analysis */}
                {summary.platform_analysis && (
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                    <h4 className="text-xs font-semibold mb-3 flex items-center gap-2 text-indigo-400 uppercase tracking-wider">
                      <GlobeAltIcon className="w-3.5 h-3.5" /> Platform-Specific Observations
                    </h4>
                    <FormattedParagraph text={summary.platform_analysis} className="text-sm" style={{ color: 'var(--text-secondary)' }} />
                  </div>
                )}

                {/* Strategic Recommendations */}
                {summary.recommendations?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold mb-3 uppercase tracking-wider flex items-center gap-2 text-primary-400">
                      <SparklesIcon className="w-3.5 h-3.5" /> Strategic Recommendations
                    </h4>
                    <div className="space-y-2">
                      {summary.recommendations.map((rec, i) => (
                        <FormattedRecommendation key={i} text={rec} index={i} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <SparklesIcon className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No AI summary yet. Generate one to see executive insights.</p>
                <button onClick={handleGenerateSummary} disabled={generatingSummary} className="btn-primary text-sm">Generate Summary</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <BrandSettings
          brand={brand}
          brandId={brandId}
          fetchingLive={fetchingLive}
          onFetchLiveData={handleFetchLiveData}
          onDeleteBrand={handleDeleteBrand}
          onRefresh={fetchData}
        />
      )}
    </div>
  )
}

