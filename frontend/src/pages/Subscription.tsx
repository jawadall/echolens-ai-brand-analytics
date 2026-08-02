import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { CheckIcon, SparklesIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { subscriptionsAPI, stripeAPI } from '../api/client'
import { SubscriptionPlan, Subscription as SubscriptionType } from '../types'
import { useAuthStore } from '../store/authStore'
import { usePermissions } from '../hooks/usePermissions'

const formatPrice = (price: string | number) => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price
  return numPrice.toLocaleString('en-PK')
}

export default function Subscription() {
  const { user, updateUser } = useAuthStore()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionType | null>(null)
  const [loading, setLoading] = useState(true)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [upgrading, setUpgrading] = useState<number | null>(null)

  // Only admins should manage subscriptions
  const { isAdmin } = usePermissions()
  const companyInfo = user?.company_info

  useEffect(() => {
    fetchData()

    // Handle return from Stripe checkout
    const params = new URLSearchParams(window.location.search)
    const urlStatus = params.get('status')
    if (urlStatus === 'success') {
      // Verify session with backend to activate subscription
      const storedSessionId = localStorage.getItem('stripe_session_id')
      if (storedSessionId) {
        toast.loading('Verifying payment...', { id: 'stripe-verify' })
        stripeAPI.verifySession(storedSessionId)
          .then((res) => {
            localStorage.removeItem('stripe_session_id')
            setCurrentSubscription(res.data.subscription)
            const updates: any = { subscription_plan: res.data.subscription?.plan_details?.name }
            if (res.data.company_info) updates.company_info = res.data.company_info
            updateUser(updates)
            toast.success('Payment successful! Your subscription is now active.', { id: 'stripe-verify' })
            fetchData() // Refresh data
          })
          .catch(() => {
            localStorage.removeItem('stripe_session_id')
            toast.error('Payment received but activation failed. Please contact support.', { id: 'stripe-verify' })
          })
      } else {
        toast.success('Payment successful! Refreshing subscription...')
        fetchData()
      }
      window.history.replaceState({}, '', '/subscription')
    } else if (urlStatus === 'cancelled') {
      localStorage.removeItem('stripe_session_id')
      toast.error('Payment was cancelled. Your plan has not been changed.')
      window.history.replaceState({}, '', '/subscription')
    }
  }, [])

  const fetchData = async () => {
    try {
      const [plansRes, currentRes] = await Promise.all([
        subscriptionsAPI.getPlans(),
        subscriptionsAPI.getCurrent(),
      ])
      setPlans(plansRes.data.results || plansRes.data)
      if (currentRes.data.plan) {
        setCurrentSubscription(currentRes.data)
      }
    } catch (error) {
      console.error('Failed to fetch subscription data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (planId: number, planName: string) => {
    if (!isAdmin) {
      toast.error('Only company administrators can change the subscription plan.')
      return
    }

    // Check if downgrading would exceed limits
    const targetPlan = displayPlans.find(p => p.id === planId)
    if (targetPlan && companyInfo) {
      if (companyInfo.brands_used > targetPlan.max_brands) {
        toast.error(
          `Cannot downgrade: you have ${companyInfo.brands_used} brands but the ${targetPlan.display_name} plan only allows ${targetPlan.max_brands}. Please remove brands first.`
        )
        return
      }
      if (companyInfo.users_used > (targetPlan as any).max_users) {
        toast.error(
          `Cannot downgrade: you have ${companyInfo.users_used} team members but the ${targetPlan.display_name} plan allows fewer. Please remove members first.`
        )
        return
      }
    }

    setUpgrading(planId)
    try {
      toast.loading('Processing subscription change...', { id: 'upgrade' })
      const response = await subscriptionsAPI.upgrade(planId, billingCycle)

      // If Stripe payment is required, redirect to checkout
      if (response.data.requires_payment && response.data.checkout_url) {
        // Store session_id for verification after return
        if (response.data.session_id) {
          localStorage.setItem('stripe_session_id', response.data.session_id)
        }
        toast.loading('Redirecting to Stripe checkout...', { id: 'upgrade' })
        window.location.href = response.data.checkout_url
        return
      }

      setCurrentSubscription(response.data.subscription)

      // Update the auth store with new plan + company_info
      const updates: any = { subscription_plan: planName }
      if (response.data.company_info) {
        updates.company_info = response.data.company_info
      }
      updateUser(updates)

      toast.success(`Successfully upgraded to ${response.data.subscription?.plan_details?.display_name || planName}!`, { id: 'upgrade' })
    } catch {
      // handled by interceptor
      toast.dismiss('upgrade')
    } finally {
      setUpgrading(null)
    }
  }

  // Default plans if API doesn't return any
  const displayPlans: SubscriptionPlan[] = plans.length > 0 ? plans : [
    {
      id: 1, name: 'free', display_name: 'Free',
      description: 'Get started with basic brand monitoring',
      price_monthly: '0', price_yearly: '0', currency: 'PKR',
      max_brands: 1, max_posts_per_month: 500, max_exports_per_month: 2, data_retention_days: 7,
      features: ['1 Brand', '2 Team Members', '500 Posts/month', '2 CSV Exports/month', 'Basic Sentiment Analysis', '7-Day Data Retention'],
      has_api_access: false, has_advanced_analytics: false, has_competitor_analysis: false,
      has_custom_alerts: false, has_ai_insights: false, has_priority_support: false, is_popular: false,
    },
    {
      id: 2, name: 'basic', display_name: 'Basic',
      description: 'For small teams tracking multiple brands',
      price_monthly: '2999', price_yearly: '29990', currency: 'PKR',
      max_brands: 3, max_posts_per_month: 2000, max_exports_per_month: 10, data_retention_days: 30,
      features: ['3 Brands', '5 Team Members', '2,000 Posts/month', '10 Exports/month', 'Advanced Analytics', 'Custom Alert Rules', 'PDF & CSV Reports', '30-Day Retention'],
      has_api_access: false, has_advanced_analytics: true, has_competitor_analysis: false,
      has_custom_alerts: true, has_ai_insights: false, has_priority_support: false, is_popular: false,
    },
    {
      id: 3, name: 'professional', display_name: 'Professional',
      description: 'For agencies and marketing teams',
      price_monthly: '7999', price_yearly: '79990', currency: 'PKR',
      max_brands: 10, max_posts_per_month: 10000, max_exports_per_month: 50, data_retention_days: 90,
      features: ['10 Brands', '15 Team Members', '10,000 Posts/month', '50 Exports/month', 'AI-Powered Insights', 'Competitor Analysis', 'Brand Comparison Tool', 'Custom API Keys', 'Priority Support', '90-Day Retention'],
      has_api_access: true, has_advanced_analytics: true, has_competitor_analysis: true,
      has_custom_alerts: true, has_ai_insights: true, has_priority_support: true, is_popular: true,
    },
    {
      id: 4, name: 'enterprise', display_name: 'Enterprise',
      description: 'Full platform access for large organizations',
      price_monthly: '19999', price_yearly: '199990', currency: 'PKR',
      max_brands: 50, max_posts_per_month: 100000, max_exports_per_month: 500, data_retention_days: 365,
      features: ['50 Brands', '100 Team Members', '100,000 Posts/month', '500 Exports/month', 'Everything in Professional', 'Custom SMTP', 'Dedicated Account Manager', 'SLA Guarantee', '365-Day Retention'],
      has_api_access: true, has_advanced_analytics: true, has_competitor_analysis: true,
      has_custom_alerts: true, has_ai_insights: true, has_priority_support: true, is_popular: false,
    },
  ]

  const currentPlanName = companyInfo?.plan || user?.subscription_plan || 'free'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  // Non-admin users see a restricted view
  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
            <LockClosedIcon className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Subscription Management
          </h1>
          <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Your company is currently on the <strong className="text-indigo-400">{currentPlanName.charAt(0).toUpperCase() + currentPlanName.slice(1)}</strong> plan.
            Only company administrators can change the subscription plan.
          </p>
          <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
            Contact your company admin to upgrade or change plans.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Subscription Plans</h1>
        <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>Choose the perfect plan for your brand monitoring needs</p>
        {companyInfo && (
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Currently using {companyInfo.brands_used}/{companyInfo.brands_limit} brands, {companyInfo.users_used}/{companyInfo.users_limit} users
          </p>
        )}
      </div>

      {/* Billing Toggle */}
      <div className="flex justify-center">
        <div className="p-1 rounded-xl inline-flex" style={{ background: 'var(--bg-elevated)' }}>
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${billingCycle === 'monthly' ? 'bg-primary-500 text-white' : 'btn-ghost'
              }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${billingCycle === 'yearly' ? 'bg-primary-500 text-white' : 'btn-ghost'
              }`}
          >
            Yearly <span className="text-xs text-emerald-400 ml-1">Save 17%</span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {displayPlans.map((plan, index) => {
          const isCurrentPlan = currentPlanName === plan.name
          const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly
          const isUpgrading = upgrading === plan.id

          // Check if downgrade would exceed limits
          const wouldExceedBrands = companyInfo ? companyInfo.brands_used > plan.max_brands : false

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`card p-6 relative ${plan.is_popular ? 'border-primary-500/50 ring-1 ring-primary-500/20' : ''
                } ${isCurrentPlan ? 'ring-2 ring-indigo-500/40' : ''}`}
            >
              {plan.is_popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary-500 text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                    <SparklesIcon className="w-3 h-3" />
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{plan.display_name}</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{plan.description}</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>PKR</span>
                  <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatPrice(price)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <CheckIcon className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              {isCurrentPlan ? (
                <button disabled className="w-full py-2.5 rounded-xl font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Current Plan
                </button>
              ) : wouldExceedBrands ? (
                <div>
                  <button disabled className="w-full py-2.5 rounded-xl font-medium opacity-50 btn-secondary">
                    Cannot Downgrade
                  </button>
                  <p className="text-[10px] text-center mt-1.5 text-rose-400">
                    You have {companyInfo?.brands_used} brands (max {plan.max_brands})
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.id, plan.name)}
                  disabled={isUpgrading}
                  className={`w-full py-2.5 rounded-xl font-medium transition-all ${plan.is_popular ? 'btn-primary' : 'btn-secondary'
                    }`}
                >
                  {isUpgrading ? 'Processing...' : plan.name === 'free' ? 'Downgrade' : 'Upgrade'}
                </button>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Current Plan Info */}
      {currentSubscription && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Current Subscription</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Plan</p>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{currentSubscription.plan_details?.display_name}</p>
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Status</p>
              <p className="text-emerald-400 font-medium capitalize">{currentSubscription.status}</p>
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Expires</p>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {new Date(currentSubscription.expires_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* FAQ */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Frequently Asked Questions</h3>
        <div className="space-y-4">
          {[
            { q: 'Can I change plans anytime?', a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.' },
            { q: 'What payment methods do you accept?', a: 'We accept all major credit/debit cards using Stripe Payments.' },
            { q: 'Is there a free trial?', a: 'Yes! The Free plan lets you try Echo Lens with limited features. No payment required.' },
          ].map((faq) => (
            <div key={faq.q}>
              <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>{faq.q}</h4>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
