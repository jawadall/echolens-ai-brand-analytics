/**
 * Role-Based Access Control Hook for Echo Lens
 * 
 * Roles:
 *   admin   — Full access (settings, users, brands, data)
 *   analyst — Can create/edit brands, fetch data, manage alerts
 *   viewer  — Read-only access to dashboards and analytics
 */
import { useAuthStore } from '../store/authStore'

export function usePermissions() {
  const { user } = useAuthStore()

  const role = user?.role || 'viewer'
  const isSuperAdmin = !!(user as any)?.is_staff || !!(user as any)?.is_superuser
  const isAdmin = role === 'admin' || isSuperAdmin
  const isAnalyst = role === 'analyst'
  const isViewer = role === 'viewer'
  const isAnalystOrAbove = isAdmin || isAnalyst

  // Business plan from company_info
  const plan = (user as any)?.company_info?.plan || user?.subscription_plan || 'free'

  return {
    role,
    plan,
    isSuperAdmin,
    isAdmin,
    isAnalyst,
    isViewer,
    isAnalystOrAbove,

    // Specific permission checks
    canCreateBrand: isAnalystOrAbove,
    canEditBrand: isAnalystOrAbove,
    canDeleteBrand: isAnalystOrAbove,
    canFetchData: isAnalystOrAbove,
    canManageAlerts: isAnalystOrAbove,
    canAccessSettings: isAdmin,
    canManageUsers: isAdmin,
    canManageSubscription: isAdmin,
    canAccessCompanyAdmin: isAdmin || isSuperAdmin,
  }
}
