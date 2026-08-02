import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { useTheme } from './ThemeProvider'
import { authAPI } from '../api/client'
import NotificationDropdown from './NotificationDropdown'
import GlobalSearch from './GlobalSearch'
import toast from 'react-hot-toast'
import {
  HomeIcon,
  ChartBarIcon,
  BellAlertIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ScaleIcon,
  ShieldCheckIcon,
  BuildingOffice2Icon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline'

// Navigation items with role-based visibility
// roles: undefined = all roles, 'admin' = company admin only, 'staff' = superadmin only
// hidden: array of roles that should NOT see this item
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Comparison', href: '/comparison', icon: ScaleIcon },
  { name: 'Alerts', href: '/alerts', icon: BellAlertIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, hidden: ['viewer'] },
  { name: 'Subscription', href: '/subscription', icon: CreditCardIcon, hidden: ['viewer', 'analyst'] },
  { name: 'Admin', href: '/company', icon: BuildingOffice2Icon, requireRole: 'admin' as const },
  { name: 'Super Admin', href: '/superadmin', icon: ShieldCheckIcon, requireStaff: true },
] as const

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, refreshToken } = useAuthStore()
  const { theme, toggleTheme } = useTheme()

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await authAPI.logout(refreshToken)
      }
    } catch (error) {
      // Ignore errors on logout
    } finally {
      logout()
      toast.success('Logged out successfully')
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-primary)',
        }}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-[72px] items-center justify-between px-5" style={{ borderBottom: '1px solid var(--border-primary)' }}>
            <Link to="/dashboard" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                <ChartBarIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-display font-bold gradient-text">Echo Lens</h1>
                <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Brand Intelligence</p>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg btn-ghost"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {navigation.filter(item => {
              // Staff-only items (SuperAdmin)
              if ('requireStaff' in item && item.requireStaff) return !!user?.is_staff
              // Business nav — show for all admins + superadmins (users need it to create/manage their business)
              if ('requireRole' in item && item.requireRole === 'admin') {
                return user?.role === 'admin' || !!user?.is_staff
              }
              // Hidden for specific roles
              if ('hidden' in item && item.hidden && user?.role) {
                return !(item.hidden as readonly string[]).includes(user.role)
              }
              return true
            }).map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href === '/dashboard' && location.pathname.startsWith('/brands/'))
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-sm ${
                    isActive
                      ? 'text-primary-400'
                      : ''
                  }`}
                  style={{
                    background: isActive ? 'rgba(90, 113, 242, 0.1)' : 'transparent',
                    color: isActive ? undefined : 'var(--text-secondary)',
                    border: isActive ? '1px solid rgba(90, 113, 242, 0.15)' : '1px solid transparent',
                  }}
                >
                  <item.icon
                    className={`w-[18px] h-[18px] ${
                      isActive ? 'text-primary-400' : 'group-hover:text-primary-400'
                    } transition-colors`}
                  />
                  <span className="font-medium">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Theme toggle + User section */}
          <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border-primary)' }}>
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all btn-ghost"
            >
              {theme === 'dark' ? (
                <SunIcon className="w-[18px] h-[18px] text-amber-400" />
              ) : (
                <MoonIcon className="w-[18px] h-[18px] text-primary-400" />
              )}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            {/* User */}
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.full_name}</p>
                <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg transition-colors hover:bg-rose-500/10"
                style={{ color: 'var(--text-muted)' }}
                title="Logout"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4 hover:text-rose-400" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-[260px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 glass" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex h-14 items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-1.5 rounded-lg btn-ghost"
              >
                <Bars3Icon className="w-5 h-5" />
              </button>
              
              {/* Search bar */}
              <GlobalSearch />
            </div>

            <div className="flex items-center gap-3">
              {/* Plan badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ 
                  background: 'rgba(90, 113, 242, 0.08)',
                  border: '1px solid rgba(90, 113, 242, 0.15)',
                  color: '#7b97f8'
                }}>
                <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
                {(user as any)?.company_info?.plan || user?.subscription_plan || 'Free'} Plan
              </div>
              
              {/* Notifications */}
              <NotificationDropdown />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
