import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { useTheme } from './ThemeProvider'
import { authAPI } from '../api/client'
import toast from 'react-hot-toast'
import {
  ChartBarIcon,
  BuildingOffice2Icon,
  UsersIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  ArrowLeftIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'

const adminNav = [
  { name: 'Overview', href: '/superadmin', icon: ChartBarIcon },
  { name: 'Businesses', href: '/superadmin/companies', icon: BuildingOffice2Icon },
  { name: 'Users', href: '/superadmin/users', icon: UsersIcon },
  { name: 'Subscriptions', href: '/superadmin/subscriptions', icon: CreditCardIcon },
  { name: 'System Settings', href: '/superadmin/settings', icon: Cog6ToothIcon },
  { name: 'Audit Logs', href: '/superadmin/audit', icon: ClipboardDocumentListIcon },
]

export default function SuperAdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, refreshToken } = useAuthStore()
  const { theme, toggleTheme } = useTheme()

  const handleLogout = async () => {
    try { if (refreshToken) await authAPI.logout(refreshToken) } catch {}
    finally { logout(); toast.success('Logged out'); navigate('/login') }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>

      <aside className={`fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-primary)' }}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-[72px] items-center justify-between px-5" style={{ borderBottom: '1px solid var(--border-primary)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-rose-500 to-orange-500">
                <ShieldCheckIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-display font-bold" style={{ color: 'var(--text-primary)' }}>Super Admin</h1>
                <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Echo Lens Control</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg btn-ghost">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {adminNav.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link key={item.name} to={item.href} onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-sm ${isActive ? 'text-rose-400' : ''}`}
                  style={{
                    background: isActive ? 'rgba(244, 63, 94, 0.1)' : 'transparent',
                    color: isActive ? undefined : 'var(--text-secondary)',
                    border: isActive ? '1px solid rgba(244, 63, 94, 0.15)' : '1px solid transparent',
                  }}>
                  <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-rose-400' : 'group-hover:text-rose-400'} transition-colors`} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              )
            })}

            {/* Back to main app */}
            <div className="pt-4 mt-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
              <Link to="/dashboard"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium btn-ghost">
                <ArrowLeftIcon className="w-[18px] h-[18px]" />
                Back to App
              </Link>
            </div>
          </nav>

          {/* Bottom */}
          <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border-primary)' }}>
            <button onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium btn-ghost">
              {theme === 'dark' ? <SunIcon className="w-[18px] h-[18px] text-amber-400" /> : <MoonIcon className="w-[18px] h-[18px] text-primary-400" />}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 bg-gradient-to-br from-rose-500 to-orange-500">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.full_name}</p>
                <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>Super Admin</p>
              </div>
              <button onClick={handleLogout} className="p-1.5 rounded-lg transition-colors hover:bg-rose-500/10" style={{ color: 'var(--text-muted)' }} title="Logout">
                <ArrowRightOnRectangleIcon className="w-4 h-4 hover:text-rose-400" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-30 glass" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex h-14 items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg btn-ghost">
                <Bars3Icon className="w-5 h-5" />
              </button>
              <h2 className="text-sm font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
                {adminNav.find(n => n.href === location.pathname)?.name || 'Super Admin'}
              </h2>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              Admin Mode
            </div>
          </div>
        </header>
        <main className="p-4 lg:p-6"><Outlet /></main>
      </div>
    </div>
  )
}
