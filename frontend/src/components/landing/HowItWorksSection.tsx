import { motion } from 'framer-motion'
import {
  MagnifyingGlassIcon, CpuChipIcon, ChartBarIcon, BellAlertIcon,
} from '@heroicons/react/24/outline'

const fadeUp = {
  hidden: { opacity: 0, y: 25 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.5 } }),
}

const steps = [
  { num: '01', icon: MagnifyingGlassIcon, title: 'Add Your Brand', desc: 'Enter brand name, keywords, and select which of the 5 platforms to monitor. Set competitor brands for comparison.', color: '#818cf8' },
  { num: '02', icon: CpuChipIcon, title: 'Collect & Analyze', desc: 'Data connectors fetch mentions via platform APIs. The NLP engine runs sentiment classification and Gemini AI generates insights.', color: '#c084fc' },
  { num: '03', icon: ChartBarIcon, title: 'Visualize & Report', desc: 'View sentiment trends, word clouds, engagement metrics, and platform breakdowns on your interactive dashboard.', color: '#38bdf8' },
  { num: '04', icon: BellAlertIcon, title: 'Alert & Act', desc: 'Receive threshold-based alerts for negative spikes. Export reports as PDF/CSV/Excel and share with your team.', color: '#22c55e' },
]

export default function HowItWorksSection() {
  return (
    <section className="py-24 px-6" id="how-it-works">
      <div className="max-w-5xl mx-auto">
        <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
          <span className="text-sm font-semibold tracking-wider uppercase" style={{ color: '#818cf8' }}>Workflow</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4" style={{ color: '#e2e8f0' }}>How Echo Lens Works</h2>
          <p className="max-w-lg mx-auto text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
            Four steps from raw social data to actionable brand intelligence.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s, i) => (
            <motion.div key={i} className="relative rounded-2xl p-6 transition-all duration-250 cursor-default" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
              style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${s.color}25`; e.currentTarget.style.background = `${s.color}05` }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.background = 'rgba(255,255,255,0.015)' }}
            >
              {/* Step number watermark */}
              <div className="absolute top-4 right-5 text-4xl font-black select-none" style={{ color: `${s.color}12` }}>{s.num}</div>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${s.color}12`, border: `1px solid ${s.color}20` }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <h3 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.55)' }}>{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
