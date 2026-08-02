import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { ChartBarIcon, LockClosedIcon, CheckCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import api from '../api/client'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const uid = searchParams.get('uid') || ''
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) return toast.error('Passwords do not match')
    if (password.length < 8) return toast.error('Password must be at least 8 characters')

    setLoading(true)
    try {
      await api.post('/auth/reset-password/', {
        uid, token, new_password: password, confirm_password: confirm
      })
      setDone(true)
      toast.success('Password reset successful!')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Reset failed. Link may be expired.')
    } finally {
      setLoading(false)
    }
  }

  if (!uid || !token) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6">
        <div className="card p-8 text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">Invalid Reset Link</h2>
          <p className="text-gray-400 text-sm mb-6">This password reset link is invalid or has expired.</p>
          <Link to="/forgot-password" className="btn-primary text-sm">Request New Link</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <ChartBarIcon className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-primary-400 via-accent-400 to-primary-400 bg-clip-text text-transparent">Echo Lens</h1>
        </div>

        <div className="card p-8">
          {done ? (
            <div className="text-center">
              <CheckCircleIcon className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Password Reset!</h2>
              <p className="text-gray-400 text-sm mb-6">You can now sign in with your new password.</p>
              <Link to="/login" className="btn-primary inline-flex items-center gap-2 text-sm">
                <ArrowLeftIcon className="w-4 h-4" /> Go to Login
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <LockClosedIcon className="w-12 h-12 text-primary-400 mx-auto mb-3" />
                <h2 className="text-xl font-bold mb-1">Set New Password</h2>
                <p className="text-sm text-gray-400">Enter your new password below.</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">New Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    className="input w-full" placeholder="••••••••" required minLength={8} />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Confirm Password</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                    className="input w-full" placeholder="••••••••" required />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
