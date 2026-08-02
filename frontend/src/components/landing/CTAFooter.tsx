import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRightIcon, ChartBarIcon } from '@heroicons/react/24/outline'

const fadeUp = {
  hidden: { opacity: 0, y: 25 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
}

export function CTASection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div className="rounded-3xl p-10 md:p-14 relative overflow-hidden" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))', border: '1px solid rgba(99,102,241,0.12)' }}>
          {/* Decorative orb */}
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)' }} />
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 relative z-10" style={{ color: '#e2e8f0' }}>Ready to Understand Your Brand Better?</h2>
          <p className="text-sm md:text-base mb-8 relative z-10" style={{ color: 'rgba(148,163,184,0.6)' }}>
            Start monitoring your brand's online reputation today — the Free plan includes everything you need to get started.
          </p>
          <Link to="/register" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-semibold transition-all duration-300 cursor-pointer hover:shadow-xl hover:shadow-indigo-500/25 hover:-translate-y-0.5 relative z-10" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 8px 32px rgba(99,102,241,0.25)' }}>
            Create Free Account <ArrowRightIcon className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="py-8 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <ChartBarIcon className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm" style={{ color: '#e2e8f0' }}>Echo Lens</span>
        </div>
        <p className="text-xs text-center" style={{ color: 'rgba(148,163,184,0.35)' }}>
          © 2026 Echo Lens — Brand Monitoring & Sentiment Analysis Tool. Final Year Project, COMSATS University Islamabad.
        </p>
        <div className="flex items-center gap-5">
          <a href="#features" className="text-xs transition-colors duration-200 cursor-pointer hover:text-indigo-400" style={{ color: 'rgba(148,163,184,0.4)' }}>Features</a>
          <a href="#pricing" className="text-xs transition-colors duration-200 cursor-pointer hover:text-indigo-400" style={{ color: 'rgba(148,163,184,0.4)' }}>Pricing</a>
          <a href="#team" className="text-xs transition-colors duration-200 cursor-pointer hover:text-indigo-400" style={{ color: 'rgba(148,163,184,0.4)' }}>Team</a>
        </div>
      </div>
    </footer>
  )
}
