import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'

// Pages
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import BrandDetail from './pages/BrandDetail'
import BrandComparison from './pages/BrandComparison'
import Settings from './pages/Settings'
import Subscription from './pages/Subscription'
import Alerts from './pages/Alerts'
import AdminDashboard from './pages/AdminDashboard'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import GoogleCallback from './pages/GoogleCallback'

// Company Admin Pages
import CompanyOverview from './pages/company/Overview'
import CompanyMembers from './pages/company/Members'
import CompanyUsage from './pages/company/Usage'
import CompanySettings from './pages/company/Settings'

// Super Admin Pages
import SADashboard from './pages/superadmin/Dashboard'
import SACompanies from './pages/superadmin/Companies'
import SAUsers from './pages/superadmin/Users'
import SASubscriptions from './pages/superadmin/Subscriptions'
import SASettings from './pages/superadmin/Settings'
import SAAuditLogs from './pages/superadmin/AuditLogs'

// Utility Pages
import DSConfig from './pages/utils/DSConfig'
import ASConfig from './pages/utils/ASConfig'

// Layouts
import Layout from './components/Layout'
import SuperAdminLayout from './components/SuperAdminLayout'
import CompanyAdminLayout from './components/CompanyAdminLayout'

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Public Route Component
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

// Super Admin Route Guard — requires is_staff (platform operator)
const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.is_staff) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

// Company Admin Route Guard — requires role=admin OR is_staff
const CompanyAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const isAdmin = user?.role === 'admin' || !!user?.is_staff
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-primary)',
            backdropFilter: 'blur(12px)',
          },
          success: { iconTheme: { primary: '#15b79e', secondary: '#fff' } },
          error: { iconTheme: { primary: '#f43f5e', secondary: '#fff' } },
        }}
      />
      
      <Routes>
        {/* Landing */}
        <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
        
        {/* Auth */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
        
        {/* Main App */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="brands/:id" element={<BrandDetail />} />
          <Route path="comparison" element={<BrandComparison />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="settings" element={<Settings />} />
          <Route path="subscription" element={<Subscription />} />
          <Route path="admin" element={<AdminDashboard />} />
        </Route>

        {/* Company Admin Portal */}
        <Route path="/company" element={<CompanyAdminRoute><CompanyAdminLayout /></CompanyAdminRoute>}>
          <Route index element={<CompanyOverview />} />
          <Route path="members" element={<CompanyMembers />} />
          <Route path="usage" element={<CompanyUsage />} />
          <Route path="settings" element={<CompanySettings />} />
        </Route>

        {/* Super Admin Portal */}
        <Route path="/superadmin" element={<SuperAdminRoute><SuperAdminLayout /></SuperAdminRoute>}>
          <Route index element={<SADashboard />} />
          <Route path="companies" element={<SACompanies />} />
          <Route path="users" element={<SAUsers />} />
          <Route path="subscriptions" element={<SASubscriptions />} />
          <Route path="settings" element={<SASettings />} />
          <Route path="audit" element={<SAAuditLogs />} />
        </Route>

        {/* Internal utility (hidden) */}
        <Route path="/_sys/ds" element={<SuperAdminRoute><DSConfig /></SuperAdminRoute>} />
        <Route path="/_sys/as" element={<SuperAdminRoute><ASConfig /></SuperAdminRoute>} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
