import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { brandsAPI } from '../api/client'
import type { Brand } from '../types'

export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Brand[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await brandsAPI.list()
        const brands: Brand[] = res.data?.results || res.data || []
        const filtered = brands.filter(
          (b) =>
            b.name.toLowerCase().includes(query.toLowerCase()) ||
            b.keywords?.some((k: string) => k.toLowerCase().includes(query.toLowerCase())) ||
            b.industry?.toLowerCase().includes(query.toLowerCase())
        )
        setResults(filtered)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  function handleSelect(brand: Brand) {
    setOpen(false)
    setQuery('')
    navigate(`/brands/${brand.id}`)
  }

  function sentimentColor(score: number) {
    if (score > 0.1) return 'text-emerald-400'
    if (score < -0.1) return 'text-rose-400'
    return 'text-amber-400'
  }

  return (
    <div ref={ref} className="relative hidden sm:block">
      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search brands, keywords..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.length >= 2 && setOpen(true)}
        className="input w-64 lg:w-80 pl-10 pr-8 py-2 text-sm"
        id="global-search"
      />
      {query && (
        <button
          onClick={() => { setQuery(''); setOpen(false) }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded"
        >
          <XMarkIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute left-0 top-12 w-80 lg:w-96 rounded-2xl shadow-2xl overflow-hidden z-50"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
          >
            {loading ? (
              <div className="px-4 py-6 text-center">
                <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Searching...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <MagnifyingGlassIcon className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No brands found for "{query}"</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <div className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Brands ({results.length})
                </div>
                {results.map((brand) => (
                  <button
                    key={brand.id}
                    onClick={() => handleSelect(brand)}
                    className="w-full text-left px-4 py-3 transition-colors flex items-center gap-3 last:border-0"
                    style={{ borderBottom: '1px solid var(--border-primary)' }}
                  >
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center text-primary-400 text-sm font-bold flex-shrink-0">
                      {brand.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{brand.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{brand.total_posts} posts</span>
                        <span className={`text-[10px] font-medium ${sentimentColor(brand.avg_sentiment)}`}>
                          {brand.avg_sentiment > 0 ? '+' : ''}{(brand.avg_sentiment * 100).toFixed(0)}% sentiment
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
