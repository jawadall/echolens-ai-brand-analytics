import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import api from '../api/client'
import { ChartBarIcon, EnvelopeIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

export default function VerifyEmail() {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const navigate = useNavigate()
  const location = useLocation()
  const { setAuth } = useAuthStore()

  const email = (location.state as any)?.email || ''

  // Auto-send verification code on mount
  useEffect(() => {
    if (!email) {
      navigate('/register')
      return
    }
    inputRefs.current[0]?.focus()

    // Auto-trigger resend so the user gets the code immediately
    const autoSend = async () => {
      try {
        await api.post('/auth/resend-verification/', { email })
        setCountdown(60)
      } catch {
        // Silently fail — user can still click Resend manually
      }
    }
    autoSend()
  }, [])

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [countdown])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newOtp = [...otp]
    paste.split('').forEach((d, i) => { if (i < 6) newOtp[i] = d })
    setOtp(newOtp)
    inputRefs.current[Math.min(paste.length, 5)]?.focus()
  }

  const handleSubmit = async () => {
    const code = otp.join('')
    if (code.length !== 6) return toast.error('Please enter the complete 6-digit code')
    setLoading(true)
    try {
      const res = await api.post('/auth/verify-email/', { email, otp: code })
      const { tokens, user } = res.data
      if (tokens && user) {
        setAuth(user, tokens.access, tokens.refresh)
        toast.success('Email verified! Welcome to Echo Lens.')
        navigate('/dashboard')
      } else {
        toast.success('Email verified!')
        navigate('/login')
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid verification code')
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0) return
    setResending(true)
    try {
      await api.post('/auth/resend-verification/', { email })
      toast.success('New code sent!')
      setCountdown(60)
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch {
      toast.error('Failed to resend code')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0a0a12' }}>
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)' }} />
        <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)' }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-[440px] relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <ChartBarIcon className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ background: 'linear-gradient(135deg, #c4b5fd, #e9d5ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Echo Lens</h1>
        </div>

        <div style={{
          background: 'rgba(15,15,30,0.6)', backdropFilter: 'blur(24px)',
          border: '1px solid rgba(99,102,241,0.12)', borderRadius: '20px', padding: '40px',
          boxShadow: '0 4px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}>
          <div className="text-center mb-8">
            <motion.div
              className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)' }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <EnvelopeIcon className="w-8 h-8" style={{ color: '#818cf8' }} />
            </motion.div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#e2e8f0' }}>Verify Your Email</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.7)' }}>
              We sent a 6-digit code to<br />
              <span className="font-medium" style={{ color: '#c4b5fd' }}>{email}</span>
            </p>
          </div>

          {/* OTP inputs */}
          <div className="flex justify-center gap-3 mb-8" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="w-12 h-14 text-center text-xl font-bold rounded-xl outline-none transition-all duration-200"
                style={{
                  background: digit ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${digit ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: '#e2e8f0',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                onBlur={(e) => { e.target.style.borderColor = digit ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
              />
            ))}
          </div>

          <button onClick={handleSubmit} disabled={loading || otp.join('').length !== 6}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer mb-4"
            style={{
              background: otp.join('').length === 6 ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(99,102,241,0.2)',
              color: '#fff',
              boxShadow: otp.join('').length === 6 ? '0 4px 24px rgba(99,102,241,0.3)' : 'none',
              opacity: otp.join('').length === 6 ? 1 : 0.5,
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Verifying...
              </span>
            ) : 'Verify Email'}
          </button>

          <div className="text-center">
            <p className="text-sm mb-2" style={{ color: 'rgba(148,163,184,0.5)' }}>Didn't receive the code?</p>
            <button onClick={handleResend} disabled={resending || countdown > 0}
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 cursor-pointer"
              style={{ color: countdown > 0 ? 'rgba(148,163,184,0.4)' : '#818cf8' }}
            >
              <ArrowPathIcon className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
              {countdown > 0 ? `Resend in ${countdown}s` : resending ? 'Sending...' : 'Resend Code'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
