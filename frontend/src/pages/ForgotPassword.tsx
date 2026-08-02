import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '../api/client'
import { ChartBarIcon, EnvelopeIcon, KeyIcon, ShieldCheckIcon, ArrowLeftIcon, EyeIcon, EyeSlashIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

type Step = 'email' | 'otp' | 'password' | 'success'

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e2e8f0',
  }
  const focusH = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }
  const blurH = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return toast.error('Please enter your email')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password/', { email })
      toast.success('Code sent to your email!')
      setStep('otp')
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const n = [...otp]
    n[index] = value.slice(-1)
    setOtp(n)
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
  }
  const handleOtpKey = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus()
  }
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const n = [...otp]
    paste.split('').forEach((d, i) => { if (i < 6) n[i] = d })
    setOtp(n)
  }

  const handleOtpSubmit = async () => {
    const code = otp.join('')
    if (code.length !== 6) return toast.error('Enter complete 6-digit code')
    setLoading(true)
    try {
      const res = await api.post('/auth/verify-reset-otp/', { email, otp: code })
      if (res.data.valid) {
        toast.success('OTP verified!')
        setStep('password')
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid code')
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) return toast.error('Password must be at least 8 characters')
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match')
    setLoading(true)
    try {
      await api.post('/auth/reset-password-otp/', {
        email, otp: otp.join(''), new_password: newPassword, confirm_password: confirmPassword,
      })
      toast.success('Password reset successfully!')
      setStep('success')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  const steps = { email: 1, otp: 2, password: 3, success: 4 }
  const stepNum = steps[step]

  const StepIcon = ({ icon: Icon, active, done }: { icon: any; active: boolean; done: boolean }) => (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300" style={{
        background: done ? 'rgba(34,197,94,0.15)' : active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${done ? 'rgba(34,197,94,0.3)' : active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`,
        color: done ? '#22c55e' : active ? '#818cf8' : 'rgba(148,163,184,0.4)',
      }}>
        {done ? '✓' : <Icon className="w-3.5 h-3.5" />}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0a0a12' }}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)' }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[440px] relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <ChartBarIcon className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ background: 'linear-gradient(135deg, #c4b5fd, #e9d5ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Echo Lens</h1>
        </div>

        <div style={{
          background: 'rgba(15,15,30,0.6)', backdropFilter: 'blur(24px)',
          border: '1px solid rgba(99,102,241,0.12)', borderRadius: '20px', padding: '36px',
          boxShadow: '0 4px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}>
          {/* Progress */}
          {step !== 'success' && (
            <div className="flex items-center justify-center gap-3 mb-8">
              <StepIcon icon={EnvelopeIcon} active={stepNum === 1} done={stepNum > 1} />
              <div className="w-8 h-px" style={{ background: stepNum > 1 ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)' }} />
              <StepIcon icon={KeyIcon} active={stepNum === 2} done={stepNum > 2} />
              <div className="w-8 h-px" style={{ background: stepNum > 2 ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)' }} />
              <StepIcon icon={ShieldCheckIcon} active={stepNum === 3} done={stepNum > 3} />

            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 'email' && (
              <motion.div key="email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold mb-1" style={{ color: '#e2e8f0' }}>Forgot Password?</h2>
                  <p className="text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>Enter your email and we'll send a reset code</p>
                </div>
                <form onSubmit={handleEmailSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(148,163,184,0.8)' }}>Email Address</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200" style={inputStyle} onFocus={focusH} onBlur={blurH} placeholder="you@example.com" required />
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-300" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 4px 24px rgba(99,102,241,0.3)' }}>
                    {loading ? 'Sending...' : 'Send Reset Code'}
                  </button>
                </form>
              </motion.div>
            )}

            {step === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold mb-1" style={{ color: '#e2e8f0' }}>Enter Reset Code</h2>
                  <p className="text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
                    Sent to <span style={{ color: '#c4b5fd' }}>{email}</span>
                  </p>
                </div>
                <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
                  {otp.map((d, i) => (
                    <input key={i} ref={el => { otpRefs.current[i] = el }} type="text" inputMode="numeric" maxLength={1} value={d} onChange={e => handleOtpChange(i, e.target.value)} onKeyDown={e => handleOtpKey(i, e)}
                      className="w-12 h-14 text-center text-xl font-bold rounded-xl outline-none transition-all duration-200"
                      style={{ background: d ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${d ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`, color: '#e2e8f0' }}
                      onFocus={focusH} onBlur={blurH}
                    />
                  ))}
                </div>
                <button onClick={handleOtpSubmit} disabled={loading || otp.join('').length !== 6} className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-300 mb-3" style={{ background: otp.join('').length === 6 ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(99,102,241,0.2)', color: '#fff', opacity: otp.join('').length === 6 ? 1 : 0.5 }}>
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>
                <button onClick={() => { setStep('email'); setOtp(['', '', '', '', '', '']) }} className="w-full text-sm text-center cursor-pointer" style={{ color: 'rgba(148,163,184,0.5)' }}>
                  ← Use different email
                </button>
              </motion.div>
            )}

            {step === 'password' && (
              <motion.div key="password" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold mb-1" style={{ color: '#e2e8f0' }}>Set New Password</h2>
                  <p className="text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>Choose a strong password</p>
                </div>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(148,163,184,0.8)' }}>New Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all duration-200" style={inputStyle} onFocus={focusH} onBlur={blurH} placeholder="••••••••" required minLength={8} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: 'rgba(148,163,184,0.5)' }}>
                        {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(148,163,184,0.8)' }}>Confirm Password</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200" style={inputStyle} onFocus={focusH} onBlur={blurH} placeholder="••••••••" required />
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-300" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 4px 24px rgba(99,102,241,0.3)' }}>
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
                <motion.div
                  className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <CheckCircleIcon className="w-8 h-8" style={{ color: '#22c55e' }} />
                </motion.div>
                <h2 className="text-xl font-bold mb-2" style={{ color: '#e2e8f0' }}>Password Reset!</h2>
                <p className="text-sm mb-6" style={{ color: 'rgba(148,163,184,0.6)' }}>Your password has been changed successfully.</p>
                <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 4px 24px rgba(99,102,241,0.3)' }}>
                  <ArrowLeftIcon className="w-4 h-4" /> Back to Login
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {step !== 'success' && (
            <div className="mt-6 text-center">
              <Link to="/login" className="inline-flex items-center gap-1 text-sm transition-colors duration-200" style={{ color: 'rgba(148,163,184,0.5)' }}>
                <ArrowLeftIcon className="w-3 h-3" /> Back to Login
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
