import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { ScaleIcon, SparklesIcon, ArrowTrendingUpIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { brandsAPI, nlpAPI, analyticsAPI } from '../api/client'
import { Brand } from '../types'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const COLORS_A = ['#6366f1', '#818cf8', '#a5b4fc']
const COLORS_B = ['#14b8a6', '#2dd4bf', '#5eead4']

export default function BrandComparison() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [brandA, setBrandA] = useState<number | null>(null)
  const [brandB, setBrandB] = useState<number | null>(null)
  const [comparison, setComparison] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(30)
  const [overviewA, setOverviewA] = useState<any>(null)
  const [overviewB, setOverviewB] = useState<any>(null)
  const [trendsA, setTrendsA] = useState<any>(null)
  const [trendsB, setTrendsB] = useState<any>(null)
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchBrands() }, [])

  const fetchBrands = async () => {
    try {
      const response = await brandsAPI.list()
      setBrands(response.data.results || response.data)
    } catch (error) {
      console.error('Failed to fetch brands:', error)
    }
  }

  const handleCompare = async () => {
    if (!brandA || !brandB) { toast.error('Please select two brands to compare'); return }
    if (brandA === brandB) { toast.error('Please select different brands'); return }

    setLoading(true)
    try {
      const [compRes, ovA, ovB, trA, trB] = await Promise.all([
        nlpAPI.compareBrands(brandA, brandB, days),
        analyticsAPI.getBrandOverview(brandA, days),
        analyticsAPI.getBrandOverview(brandB, days),
        analyticsAPI.getTrends(brandA, days).catch(() => null),
        analyticsAPI.getTrends(brandB, days).catch(() => null),
      ])
      setComparison(compRes.data)
      setOverviewA(ovA.data)
      setOverviewB(ovB.data)
      setTrendsA(trA?.data || null)
      setTrendsB(trB?.data || null)
    } catch { toast.error('Failed to compare brands') }
    finally { setLoading(false) }
  }

  const selectedBrandA = brands.find(b => b.id === brandA)
  const selectedBrandB = brands.find(b => b.id === brandB)
  const nameA = selectedBrandA?.name || 'Brand A'
  const nameB = selectedBrandB?.name || 'Brand B'

  // Tooltip style
  const tooltipStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '12px', color: 'var(--text-primary)' }

  /** Parse markdown bold/italic inline formatting */
  const renderMarkdownLine = (text: string) => {
    // Split on **bold** and *italic* patterns
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i}>{part.slice(1, -1)}</em>
      }
      return <span key={i}>{part}</span>
    })
  }

  /** Export the full comparison report as PDF */
  const handleExportPDF = async () => {
    if (!reportRef.current) return
    setExporting(true)
    toast.loading('Generating PDF report...', { id: 'pdf' })
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, useCORS: true, backgroundColor: '#0f1117',
        logging: false, windowWidth: 1200,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 10
      const contentW = pageW - margin * 2
      const imgH = (canvas.height * contentW) / canvas.width
      let yOffset = 0

      while (yOffset < imgH) {
        if (yOffset > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', margin, margin - yOffset, contentW, imgH)
        yOffset += pageH - margin * 2
      }
      pdf.save(`${nameA}_vs_${nameB}_comparison_report.pdf`)
      toast.success('PDF downloaded!', { id: 'pdf' })
    } catch {
      toast.error('Failed to generate PDF', { id: 'pdf' })
    } finally { setExporting(false) }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Brand Comparison</h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Compare sentiment, engagement, and performance between brands</p>
      </div>

      {/* Selection */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Brand A</label>
            <select value={brandA || ''} onChange={(e) => setBrandA(e.target.value ? parseInt(e.target.value) : null)} className="input w-full">
              <option value="">Select brand</option>
              {brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-center">
            <ScaleIcon className="w-8 h-8 text-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Brand B</label>
            <select value={brandB || ''} onChange={(e) => setBrandB(e.target.value ? parseInt(e.target.value) : null)} className="input w-full">
              <option value="">Select brand</option>
              {brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Time Period</label>
            <select value={days} onChange={(e) => setDays(parseInt(e.target.value))} className="input w-full">
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          <button onClick={handleCompare} disabled={loading || !brandA || !brandB} className="btn-primary">
            {loading ? 'Comparing...' : 'Compare'}
          </button>
        </div>
      </motion.div>

      {/* Results */}
      {comparison && overviewA && overviewB && (
        <div ref={reportRef} className="space-y-8">
          {/* Key Metrics Table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden">
            <div className="p-5 pb-0">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Key Metrics</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Metric</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-indigo-400">{nameA}</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-teal-400">{nameB}</th>
                    <th className="text-center px-5 py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { metric: 'Total Posts', a: overviewA.total_posts, b: overviewB.total_posts, higher: true },
                    { metric: 'Avg Sentiment', a: overviewA.sentiment?.average_score, b: overviewB.sentiment?.average_score, higher: true, pct: true },
                    { metric: 'Positive %', a: overviewA.sentiment?.positive / Math.max(1, overviewA.total_posts), b: overviewB.sentiment?.positive / Math.max(1, overviewB.total_posts), higher: true, pct: true },
                    { metric: 'Negative %', a: overviewA.sentiment?.negative / Math.max(1, overviewA.total_posts), b: overviewB.sentiment?.negative / Math.max(1, overviewB.total_posts), higher: false, pct: true },
                    { metric: 'Total Likes', a: overviewA.engagement?.total_likes || 0, b: overviewB.engagement?.total_likes || 0, higher: true },
                    { metric: 'Total Shares', a: overviewA.engagement?.total_shares || 0, b: overviewB.engagement?.total_shares || 0, higher: true },
                    { metric: 'Total Comments', a: overviewA.engagement?.total_comments || 0, b: overviewB.engagement?.total_comments || 0, higher: true },
                  ].map(row => {
                    const va = row.a || 0, vb = row.b || 0
                    const winnerIsA = row.higher ? va >= vb : va <= vb
                    return (
                      <tr key={row.metric} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                        <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{row.metric}</td>
                        <td className={`px-5 py-3 text-right font-medium ${winnerIsA ? 'text-indigo-400' : ''}`} style={winnerIsA ? {} : { color: 'var(--text-secondary)' }}>
                          {row.pct ? `${(va * 100).toFixed(1)}%` : va.toLocaleString()}
                        </td>
                        <td className={`px-5 py-3 text-right font-medium ${!winnerIsA ? 'text-teal-400' : ''}`} style={!winnerIsA ? {} : { color: 'var(--text-secondary)' }}>
                          {row.pct ? `${(vb * 100).toFixed(1)}%` : vb.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${winnerIsA ? 'bg-indigo-500/10 text-indigo-400' : 'bg-teal-500/10 text-teal-400'}`}>
                            {winnerIsA ? nameA : nameB}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Sentiment Distribution Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[
              { name: nameA, overview: overviewA, colors: COLORS_A, gradient: 'from-indigo-500 to-purple-500' },
              { name: nameB, overview: overviewB, colors: COLORS_B, gradient: 'from-teal-500 to-emerald-500' },
            ].map((item, idx) => {
              const pieData = [
                { name: 'Positive', value: item.overview.sentiment?.positive || 0, color: item.colors[0] },
                { name: 'Neutral', value: item.overview.sentiment?.neutral || 0, color: item.colors[1] },
                { name: 'Negative', value: item.overview.sentiment?.negative || 0, color: item.colors[2] },
              ]
              return (
                <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="card p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-white font-bold`}>
                      {item.name[0]}
                    </div>
                    <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.name} — Sentiment</h4>
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                          {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4">
                    {pieData.map(d => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} /> {d.name}: {d.value}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Metrics Comparison Bar Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Engagement Comparison</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { metric: 'Posts', [nameA]: overviewA.total_posts || 0, [nameB]: overviewB.total_posts || 0 },
                  { metric: 'Likes', [nameA]: overviewA.engagement?.total_likes || 0, [nameB]: overviewB.engagement?.total_likes || 0 },
                  { metric: 'Shares', [nameA]: overviewA.engagement?.total_shares || 0, [nameB]: overviewB.engagement?.total_shares || 0 },
                  { metric: 'Comments', [nameA]: overviewA.engagement?.total_comments || 0, [nameB]: overviewB.engagement?.total_comments || 0 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                  <XAxis dataKey="metric" stroke="var(--text-muted)" fontSize={11} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey={nameA} fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={nameB} fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Platform Breakdown Radar */}
          {overviewA.platform_breakdown && overviewB.platform_breakdown && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Platform Distribution</h3>
              <div className="h-72">
                {(() => {
                  const platforms = [...new Set([...Object.keys(overviewA.platform_breakdown || overviewA.all_time_platform_breakdown || {}), ...Object.keys(overviewB.platform_breakdown || overviewB.all_time_platform_breakdown || {})])]
                  const radarData = platforms.map(p => ({
                    platform: p.charAt(0).toUpperCase() + p.slice(1),
                    [nameA]: (overviewA.platform_breakdown || overviewA.all_time_platform_breakdown || {})[p] || 0,
                    [nameB]: (overviewB.platform_breakdown || overviewB.all_time_platform_breakdown || {})[p] || 0,
                  }))
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="var(--border-primary)" />
                        <PolarAngleAxis dataKey="platform" stroke="var(--text-muted)" fontSize={11} />
                        <PolarRadiusAxis stroke="var(--text-muted)" fontSize={9} />
                        <Radar name={nameA} dataKey={nameA} stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} />
                        <Radar name={nameB} dataKey={nameB} stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.15} />
                        <Legend />
                        <Tooltip contentStyle={tooltipStyle} />
                      </RadarChart>
                    </ResponsiveContainer>
                  )
                })()}
              </div>
            </motion.div>
          )}

          {/* Sentiment Trend Overlay */}
          {trendsA && trendsB && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Sentiment Trend Comparison</h3>
              <div className="h-72">
                {(() => {
                  const dataA = trendsA.labels?.map((l: string, i: number) => ({
                    date: new Date(l).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    [nameA]: trendsA.datasets?.sentiment_score?.[i] || 0,
                  })) || []
                  const dataB = trendsB.labels?.map((l: string, i: number) => ({
                    date: new Date(l).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    [nameB]: trendsB.datasets?.sentiment_score?.[i] || 0,
                  })) || []
                  // Merge by date
                  const merged: any[] = []
                  const dateMap: Record<string, any> = {}
                  ;[...dataA, ...dataB].forEach((d: any) => {
                    if (!dateMap[d.date]) { dateMap[d.date] = { date: d.date }; merged.push(dateMap[d.date]) }
                    Object.assign(dateMap[d.date], d)
                  })
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={merged}>
                        <defs>
                          <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/><stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                        <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} />
                        <YAxis stroke="var(--text-muted)" fontSize={10} domain={[-1, 1]} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend />
                        <Area type="monotone" dataKey={nameA} stroke="#6366f1" fill="url(#gradA)" />
                        <Area type="monotone" dataKey={nameB} stroke="#14b8a6" fill="url(#gradB)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )
                })()}
              </div>
            </motion.div>
          )}

          {/* AI Insights — Professionally Structured */}
          {comparison.comparison && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-primary-400" />
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>AI Comparison Insights</h3>
                </div>
              </div>

              {/* Better Sentiment Winner Card */}
              {comparison.comparison.better_sentiment && (
                <div className="mb-5 p-4 rounded-xl" style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(99,102,241,0.08))',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                      <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Sentiment Leader</span>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        <span className="text-emerald-400">{comparison.comparison.better_sentiment}</span> leads in overall sentiment performance
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Key Differentiators */}
              {comparison.comparison.differentiators && comparison.comparison.differentiators.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span className="w-6 h-6 rounded-md bg-primary-500/10 flex items-center justify-center text-xs text-primary-400 font-bold">
                      {comparison.comparison.differentiators.length}
                    </span>
                    Key Differentiators
                  </h4>
                  <div className="space-y-3">
                    {comparison.comparison.differentiators.map((diff: string, i: number) => {
                      // Extract a title if the line starts with a bold section
                      const boldMatch = diff.match(/^\*\*([^*]+)\*\*:?\s*(.*)/s)
                      const title = boldMatch ? boldMatch[1] : null
                      const body = boldMatch ? boldMatch[2] : diff

                      return (
                        <div key={i} className="flex gap-3 p-4 rounded-xl transition-all hover:scale-[1.005]"
                          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
                          <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                            style={{ background: 'var(--primary-color)', color: '#fff' }}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            {title && (
                              <h5 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                                {title}
                              </h5>
                            )}
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                              {renderMarkdownLine(body)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* PDF Export Button */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            className="flex justify-center">
            <button onClick={handleExportPDF} disabled={exporting}
              className="btn-primary flex items-center gap-2 px-6 py-3 text-sm">
              <ArrowDownTrayIcon className="w-5 h-5" />
              {exporting ? 'Generating PDF...' : 'Download Comparison Report (PDF)'}
            </button>
          </motion.div>
        </div>
      )}

      {/* Empty State */}
      {!comparison && !loading && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-12 text-center">
          <ScaleIcon className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Compare Your Brands</h3>
          <p className="max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Select two brands above and click Compare to see detailed analytics on sentiment, engagement, platform distribution, and trends.
          </p>
        </motion.div>
      )}
    </div>
  )
}
