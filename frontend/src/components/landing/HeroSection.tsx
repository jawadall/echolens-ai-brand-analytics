import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRightIcon, PlayCircleIcon } from '@heroicons/react/24/outline'

const fadeUp = (i: number) => ({
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.7, ease: 'easeOut' } },
})

export default function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 px-6 overflow-hidden">
      {/* Ambient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div className="absolute rounded-full" style={{ width: 600, height: 600, background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', top: '0%', left: '10%' }} animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 8, repeat: Infinity }} />
        <motion.div className="absolute rounded-full" style={{ width: 500, height: 500, background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', top: '15%', right: '5%' }} animate={{ scale: [1.1, 1, 1.1], opacity: [0.25, 0.45, 0.25] }} transition={{ duration: 10, repeat: Infinity }} />
        <motion.div className="absolute rounded-full" style={{ width: 300, height: 300, background: 'radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 70%)', bottom: '10%', left: '40%' }} animate={{ x: [-20, 20, -20], y: [-10, 10, -10] }} transition={{ duration: 14, repeat: Infinity }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
      </div>

      <div className="max-w-5xl mx-auto text-center relative z-10">
        {/* Badge */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp(0)}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium cursor-default" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.12)', color: '#818cf8' }}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            COMSATS University Islamabad — Final Year Project
          </span>
        </motion.div>

        {/* Heading */}
        <motion.h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mt-8 mb-6 tracking-tight" initial="hidden" animate="visible" variants={fadeUp(1)}>
          <span style={{ color: '#e2e8f0' }}>AI-Powered </span>
          <span style={{ background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 40%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Brand Monitoring
          </span>
          <br />
          <span style={{ color: '#e2e8f0' }}>&amp; Sentiment Analysis</span>
        </motion.h1>

        {/* Subheading */}
        <motion.p className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: 'rgba(148,163,184,0.75)' }} initial="hidden" animate="visible" variants={fadeUp(2)}>
          Echo Lens tracks your brand across YouTube, Twitter/X, Reddit, Facebook, and News — then uses NLP and Google Gemini AI to analyze public sentiment in real time.
        </motion.p>

        {/* CTAs */}
        <motion.div className="flex flex-col sm:flex-row items-center justify-center gap-4" initial="hidden" animate="visible" variants={fadeUp(3)}>
          <Link to="/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-semibold transition-all duration-300 cursor-pointer hover:shadow-xl hover:shadow-indigo-500/25 hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: '#fff', boxShadow: '0 8px 32px rgba(99,102,241,0.25)' }}>
            Start Monitoring — It's Free <ArrowRightIcon className="w-5 h-5" />
          </Link>
          <a href="#how-it-works" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-medium transition-all duration-200 cursor-pointer hover:bg-white/[0.06]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#e2e8f0' }}>
            <PlayCircleIcon className="w-5 h-5" style={{ color: '#818cf8' }} /> See How It Works
          </a>
        </motion.div>

        {/* Stats bar */}
        <motion.div className="mt-16 inline-flex items-center gap-6 sm:gap-10 px-8 py-4 rounded-2xl" initial="hidden" animate="visible" variants={fadeUp(4)}
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
          {[
            { val: '5', label: 'Platforms' },
            { val: 'NLP', label: 'Sentiment Engine' },
            { val: 'Gemini AI', label: 'Insights' },
            { val: 'Real-time', label: 'Monitoring' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-lg sm:text-xl font-bold" style={{ background: 'linear-gradient(135deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{s.val}</div>
              <div className="text-[11px] sm:text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.45)' }}>{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
