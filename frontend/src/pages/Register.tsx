import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import api, { authAPI } from '../api/client'
import { ChartBarIcon, EyeIcon, EyeSlashIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
)

const PasswordStrength = ({ password }: { password: string }) => {
  const getStrength = () => {
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return score
  }
  const strength = getStrength()
  if (!password) return null
  const labels = ['Weak', 'Fair', 'Good', 'Strong']
  const colors = ['#ef4444', '#f59e0b', '#38bdf8', '#22c55e']
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300" style={{
            background: i < strength ? colors[strength - 1] : 'rgba(255,255,255,0.06)',
          }} />
        ))}
      </div>
      <p className="text-xs mt-1" style={{ color: colors[strength - 1] || '#71717a' }}>{labels[strength - 1] || 'Too short'}</p>
    </div>
  )
}

export default function Register() {
  const [formData, setFormData] = useState({
    email: '', password: '', password_confirm: '', first_name: '', last_name: '', company: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.password !== formData.password_confirm) return toast.error('Passwords do not match')
    if (formData.password.length < 8) return toast.error('Password must be at least 8 characters')
    setLoading(true)
    try {
      const response = await authAPI.register(formData)
      const data = response.data
      if (data.requires_verification) {
        toast.success('Account created! Check your email for verification code.')
        navigate('/verify-email', { state: { email: data.email } })
      } else {
        setAuth(data.user, data.tokens.access, data.tokens.refresh)
        toast.success('Account created successfully!')
        navigate('/dashboard')
      }
    } catch (error: any) {
      const errors = error.response?.data
      if (errors) {
        const firstError = Object.values(errors)[0]
        toast.error(Array.isArray(firstError) ? (firstError as string[])[0] : String(firstError))
      } else {
        toast.error('Registration failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return toast.error('Google Sign-In is not configured')
    setGoogleLoading(true)
    const redirectUri = `${window.location.origin}/auth/google/callback`
    const scope = 'openid email profile'
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=select_account`
    window.location.href = authUrl
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e2e8f0',
  }
  const focusHandler = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(99,102,241,0.5)'
    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
  }
  const blurHandler = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.08)'
    e.target.style.boxShadow = 'none'
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0a12' }}>
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden">
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(135deg, #0f0f1e 0%, #1a1040 40%, #0d1b3e 70%, #0a0a18 100%)'
        }} />
        <motion.div className="absolute w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', top: '10%', left: '5%' }} animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div className="absolute w-[400px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', bottom: '5%', right: '10%' }} animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-20">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="flex items-center gap-4 mb-12">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)', boxShadow: '0 8px 32px rgba(99,102,241,0.3)' }}>
                <ChartBarIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight" style={{ background: 'linear-gradient(135deg, #c4b5fd, #e9d5ff, #c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Echo Lens</h1>
                <p className="text-sm" style={{ color: 'rgba(148,163,184,0.7)' }}>Brand Monitoring Intelligence</p>
              </div>
            </div>

            <h2 className="text-4xl xl:text-5xl font-bold leading-tight mb-6" style={{ color: '#e2e8f0' }}>
              Start Your Brand
              <br />
              <span style={{ background: 'linear-gradient(135deg, #818cf8, #c084fc, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Intelligence Journey</span>
            </h2>

            <div className="space-y-4 mb-10">
              {[
                'AI-powered sentiment analysis across 5+ platforms',
                'Real-time monitoring with smart alerts',
                'Professional reports & competitive insights',
              ].map((text, i) => (
                <motion.div key={i} className="flex items-center gap-3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.15, duration: 0.5 }}>
                  <CheckCircleIcon className="w-5 h-5 flex-shrink-0" style={{ color: '#818cf8' }} />
                  <span className="text-sm" style={{ color: 'rgba(148,163,184,0.8)' }}>{text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 overflow-y-auto">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="w-full max-w-[440px] my-auto">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-6 justify-center">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <ChartBarIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ background: 'linear-gradient(135deg, #c4b5fd, #e9d5ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Echo Lens</h1>
          </div>

          <div style={{
            background: 'rgba(15,15,30,0.6)', backdropFilter: 'blur(24px)',
            border: '1px solid rgba(99,102,241,0.12)', borderRadius: '20px', padding: '32px',
            boxShadow: '0 4px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
          }}>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-1" style={{ color: '#e2e8f0' }}>Create Account</h2>
              <p className="text-sm" style={{ color: 'rgba(148,163,184,0.7)' }}>Start monitoring your brand today</p>
            </div>

            {/* Google */}
            <button type="button" onClick={handleGoogleSignIn} disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer mb-5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            >
              <GoogleIcon />
              {googleLoading ? 'Connecting...' : 'Sign up with Google'}
            </button>

            <div className="flex items-center gap-4 mb-5">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.4)' }}>OR</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(148,163,184,0.8)' }}>First Name</label>
                  <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all duration-200" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} placeholder="John" required />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(148,163,184,0.8)' }}>Last Name</label>
                  <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all duration-200" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} placeholder="Doe" required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(148,163,184,0.8)' }}>Email Address</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all duration-200" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} placeholder="you@example.com" required />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(148,163,184,0.8)' }}>Business Name <span style={{ color: 'rgba(148,163,184,0.4)' }}>(Optional)</span></label>
                <input type="text" name="company" value={formData.company} onChange={handleChange} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all duration-200" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} placeholder="Acme Inc." />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(148,163,184,0.8)' }}>Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} className="w-full px-3.5 py-2.5 pr-11 rounded-xl text-sm outline-none transition-all duration-200" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} placeholder="••••••••" required minLength={8} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: 'rgba(148,163,184,0.5)' }}>
                    {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrength password={formData.password} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(148,163,184,0.8)' }}>Confirm Password</label>
                <input type="password" name="password_confirm" value={formData.password_confirm} onChange={handleChange} className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all duration-200" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} placeholder="••••••••" required />
              </div>

              <div className="flex items-start gap-2">
                <input type="checkbox" id="terms" required className="w-4 h-4 mt-0.5 rounded" style={{ accentColor: '#6366f1' }} />
                <label htmlFor="terms" className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.6)' }}>
                  I agree to the <a href="#" style={{ color: '#818cf8' }}>Terms of Service</a> and <a href="#" style={{ color: '#818cf8' }}>Privacy Policy</a>
                </label>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 4px 24px rgba(99,102,241,0.3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(99,102,241,0.3)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Creating Account...
                  </span>
                ) : 'Create Account'}
              </button>
            </form>

            <div className="mt-5 text-center">
              <p className="text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
                Already have an account?{' '}
                <Link to="/login" className="font-medium" style={{ color: '#818cf8' }}>Sign In</Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
