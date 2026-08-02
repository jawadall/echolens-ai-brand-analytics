import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChartBarIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  const links = [
    { href: '#features', label: 'Features' },
    { href: '#platforms', label: 'Platforms' },
    { href: '#how-it-works', label: 'How It Works' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#team', label: 'Team' },
  ]

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="fixed top-0 w-full z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(10,10,18,0.92)' : 'rgba(10,10,18,0.6)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${scrolled ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)'}`,
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 cursor-pointer group">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-shadow duration-300 group-hover:shadow-lg group-hover:shadow-indigo-500/20" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.2)' }}>
            <ChartBarIcon className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold" style={{ background: 'linear-gradient(135deg, #c4b5fd, #e9d5ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Echo Lens</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-7">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-sm font-medium transition-colors duration-200 cursor-pointer hover:text-indigo-300" style={{ color: 'rgba(148,163,184,0.7)' }}>{l.label}</a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 cursor-pointer hover:bg-white/5" style={{ color: 'rgba(148,163,184,0.8)' }}>Sign In</Link>
          <Link to="/register" className="text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 4px 16px rgba(99,102,241,0.2)' }}>
            Get Started Free
          </Link>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden cursor-pointer" style={{ color: '#94a3b8' }}>
          {mobileOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="md:hidden px-6 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="block text-sm py-2 cursor-pointer" style={{ color: 'rgba(148,163,184,0.7)' }}>{l.label}</a>
          ))}
          <div className="flex gap-3 pt-2">
            <Link to="/login" className="flex-1 text-center text-sm py-2.5 rounded-xl cursor-pointer" style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0' }}>Sign In</Link>
            <Link to="/register" className="flex-1 text-center text-sm font-semibold py-2.5 rounded-xl cursor-pointer" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}>Get Started</Link>
          </div>
        </motion.div>
      )}
    </motion.nav>
  )
}
