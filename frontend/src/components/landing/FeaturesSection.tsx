import { motion } from 'framer-motion'
import {
  SparklesIcon, GlobeAltIcon, ArrowTrendingUpIcon, BellAlertIcon,
  DocumentArrowDownIcon, ShieldCheckIcon, ChartBarSquareIcon,
  CpuChipIcon, UserGroupIcon,
} from '@heroicons/react/24/outline'

const fadeUp = {
  hidden: { opacity: 0, y: 25 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5 } }),
}

const features = [
  { icon: SparklesIcon, title: 'AI-Powered Sentiment Analysis', desc: 'Uses NLP models and Google Gemini AI to classify mentions as positive, neutral, or negative — with emotion and aspect-level detection.' },
  { icon: GlobeAltIcon, title: '5-Platform Data Collection', desc: 'Fetches brand mentions from YouTube comments, Twitter/X posts, Reddit threads, Facebook posts, and online news articles via dedicated API connectors.' },
  { icon: ArrowTrendingUpIcon, title: 'Interactive Analytics Dashboard', desc: 'Visualize sentiment trends, engagement volumes, platform breakdowns, and topic word clouds with interactive Recharts-powered graphs.' },
  { icon: BellAlertIcon, title: 'Smart Alerts & Crisis Detection', desc: 'Configure threshold-based alerts for negative sentiment spikes, volume anomalies, or keyword triggers — delivered via email notifications.' },
  { icon: DocumentArrowDownIcon, title: 'Professional Export & Reports', desc: 'Export raw data as CSV/Excel or generate formatted PDF reports with AI-written executive summaries and actionable recommendations.' },
  { icon: ShieldCheckIcon, title: 'Competitor Brand Comparison', desc: 'Add competitor brands and compare sentiment scores, engagement rates, and platform presence side-by-side with interactive charts.' },
  { icon: CpuChipIcon, title: 'Automated Scheduled Fetching', desc: 'Celery-based background tasks automatically collect and analyze new mentions on configurable intervals — no manual intervention needed.' },
  { icon: UserGroupIcon, title: 'Multi-Tenant Team Management', desc: 'Company workspaces with role-based access (Admin, Analyst, Viewer), team invitations, and centralized subscription billing.' },
  { icon: ChartBarSquareIcon, title: 'Brand Health Score', desc: 'An aggregate metric combining sentiment ratio, engagement velocity, and platform reach into a single actionable brand health indicator.' },
]

export default function FeaturesSection() {
  return (
    <section className="py-24 px-6" id="features">
      <div className="max-w-6xl mx-auto">
        <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
          <span className="text-sm font-semibold tracking-wider uppercase" style={{ color: '#818cf8' }}>Powerful Features</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4" style={{ color: '#e2e8f0' }}>Everything You Need for Brand Intelligence</h2>
          <p className="max-w-xl mx-auto text-sm md:text-base" style={{ color: 'rgba(148,163,184,0.6)' }}>
            From data collection to AI-driven insights — Echo Lens provides a complete pipeline for understanding your brand's online reputation.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div key={i} className="group rounded-2xl p-6 transition-all duration-250 cursor-default" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
              style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.15)'; e.currentTarget.style.background = 'rgba(99,102,241,0.03)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.background = 'rgba(255,255,255,0.015)' }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-all duration-250" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.1)' }}>
                <f.icon className="w-5 h-5" style={{ color: '#818cf8' }} />
              </div>
              <h3 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.55)' }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
