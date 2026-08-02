import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { subscriptionsAPI } from '../../api/client'

const fadeUp = {
  hidden: { opacity: 0, y: 25 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
}

// Fallback plans if API fails
const FALLBACK_PLANS = [
  {
    name: 'Free', display_name: 'Free', price_monthly: '0', price_yearly: '0', currency: 'PKR',
    description: 'Get started with basic brand monitoring', is_popular: false,
    features: ['1 Brand', '2 Team Members', '500 Posts/month', '2 CSV Exports/month', 'Basic Sentiment Analysis', '7-Day Data Retention'],
  },
  {
    name: 'Basic', display_name: 'Basic', price_monthly: '2999', price_yearly: '29990', currency: 'PKR',
    description: 'For small teams tracking multiple brands', is_popular: false,
    features: ['3 Brands', '5 Team Members', '2,000 Posts/month', '10 Exports/month', 'Advanced Analytics', 'Custom Alert Rules', 'PDF & CSV Reports', '30-Day Retention'],
  },
  {
    name: 'Professional', display_name: 'Professional', price_monthly: '7999', price_yearly: '79990', currency: 'PKR',
    description: 'For agencies and marketing teams', is_popular: true,
    features: ['10 Brands', '15 Team Members', '10,000 Posts/month', '50 Exports/month', 'AI-Powered Insights (Gemini)', 'Competitor Analysis', 'Brand Comparison Tool', 'Custom API Keys', 'Priority Support', '90-Day Retention'],
  },
  {
    name: 'Enterprise', display_name: 'Enterprise', price_monthly: '19999', price_yearly: '199990', currency: 'PKR',
    description: 'Full platform access for large organizations', is_popular: false,
    features: ['50 Brands', '100 Team Members', '100,000 Posts/month', '500 Exports/month', 'Everything in Professional', 'Custom SMTP Configuration', 'Dedicated Account Manager', 'SLA Guarantee', '365-Day Retention'],
  },
]

const formatPrice = (price: string | number) => {
  const num = typeof price === 'string' ? parseFloat(price) : price
  if (num === 0) return '0'
  return num.toLocaleString('en-PK')
}

export default function PricingSection() {
  const [yearly, setYearly] = useState(false)
  const [plans, setPlans] = useState<any[]>(FALLBACK_PLANS)

  useEffect(() => {
    subscriptionsAPI.getPlans()
      .then(res => {
        const data = res.data
        const plansList = Array.isArray(data) ? data : data.results || []
        if (plansList.length > 0) {
          setPlans(plansList)
        }
      })
      .catch(() => { /* use fallback */ })
  }, [])

  return (
    <section className="py-24 px-6" id="pricing" style={{ background: 'rgba(255,255,255,0.008)' }}>
      <div className="max-w-6xl mx-auto">
        <motion.div className="text-center mb-12" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
          <span className="text-sm font-semibold tracking-wider uppercase" style={{ color: '#818cf8' }}>Pricing</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4" style={{ color: '#e2e8f0' }}>Simple, Transparent Plans</h2>
          <p className="max-w-lg mx-auto text-sm mb-8" style={{ color: 'rgba(148,163,184,0.6)' }}>
            All prices in Pakistani Rupees (PKR). Start free, upgrade when your brand grows.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 p-1 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => setYearly(false)} className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer"
              style={{ background: !yearly ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent', color: !yearly ? '#fff' : 'rgba(148,163,184,0.6)' }}>
              Monthly
            </button>
            <button onClick={() => setYearly(true)} className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer flex items-center gap-1.5"
              style={{ background: yearly ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent', color: yearly ? '#fff' : 'rgba(148,163,184,0.6)' }}>
              Yearly <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>-17%</span>
            </button>
          </div>
        </motion.div>

        <div className={`grid gap-5 ${plans.length <= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
          {plans.map((plan, i) => {
            const priceM = formatPrice(plan.price_monthly)
            const priceY = formatPrice(plan.price_yearly)
            const isFree = parseFloat(String(plan.price_monthly)) === 0
            const popular = plan.is_popular

            return (
              <motion.div key={i} className="relative rounded-2xl p-6 flex flex-col transition-all duration-300 cursor-default"
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                style={{
                  background: popular ? 'rgba(99,102,241,0.05)' : 'rgba(255,255,255,0.015)',
                  border: `1px solid ${popular ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)'}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = popular ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.1)'; e.currentTarget.style.transform = 'translateY(-4px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = popular ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                {popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-bold" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}>Most Popular</div>
                )}
                <h3 className="text-lg font-semibold mb-1" style={{ color: '#e2e8f0' }}>{plan.display_name || plan.name}</h3>
                <p className="text-xs mb-4" style={{ color: 'rgba(148,163,184,0.5)' }}>{plan.description}</p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>{plan.currency || 'PKR'}</span>
                  <span className="text-3xl font-bold" style={{ color: '#e2e8f0' }}>{yearly ? priceY : priceM}</span>
                  <span className="text-sm" style={{ color: 'rgba(148,163,184,0.4)' }}>{isFree ? '' : yearly ? '/yr' : '/mo'}</span>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {(plan.features || []).map((f: string, j: number) => (
                    <li key={j} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(148,163,184,0.65)' }}>
                      <CheckCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: popular ? '#818cf8' : 'rgba(148,163,184,0.35)' }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link to="/register" className="block w-full text-center py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer"
                  style={{
                    background: popular ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.04)',
                    color: popular ? '#fff' : '#e2e8f0',
                    border: popular ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: popular ? '0 4px 20px rgba(99,102,241,0.25)' : 'none',
                  }}
                >
                  {isFree ? 'Get Started Free' : 'Subscribe Now'}
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
