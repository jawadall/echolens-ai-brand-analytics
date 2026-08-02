import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import api from '../api/client'

/**
 * Google OAuth callback page.
 * Google redirects here with ?code=xxx after user consents.
 * We send the code to the backend to exchange for tokens + user info.
 */
export default function GoogleCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      toast.error('Google sign-in was cancelled')
      navigate('/login', { replace: true })
      return
    }

    if (!code) {
      toast.error('No authorization code received')
      navigate('/login', { replace: true })
      return
    }

    // Exchange code for tokens
    const exchangeCode = async () => {
      try {
        const redirectUri = `${window.location.origin}/auth/google/callback`
        const res = await api.post('/auth/google-auth/', {
          code,
          redirect_uri: redirectUri,
        })
        const { tokens, user } = res.data
        setAuth(user, tokens.access, tokens.refresh)
        toast.success(`Welcome, ${user.first_name || user.email}!`)
        navigate('/dashboard', { replace: true })
      } catch (err: any) {
        console.error('Google auth error:', err)
        toast.error(err.response?.data?.error || 'Google sign-in failed')
        navigate('/login', { replace: true })
      }
    }

    exchangeCode()
  }, [searchParams, navigate, setAuth])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a12' }}>
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-sm" style={{ color: 'rgba(148,163,184,0.8)' }}>Completing Google sign-in...</p>
      </div>
    </div>
  )
}
