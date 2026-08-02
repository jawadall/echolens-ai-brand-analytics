import axios from 'axios'
import toast from 'react-hot-toast'

// Use relative URL for proxy in development, or full URL for production
const API_URL = '/api'

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/token/refresh/`, {
            refresh: refreshToken,
          })
          
          const { access } = response.data
          localStorage.setItem('access_token', access)
          
          originalRequest.headers.Authorization = `Bearer ${access}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        // Clear tokens and redirect to login
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }
    
    // ── Professional error messages ─────────────────────────────
    // Never show raw "Request failed with status code XXX"
    // Skip toast for auth endpoints — those pages handle errors themselves
    const url = originalRequest?.url || ''
    const isAuthEndpoint = /\/(login|register|verify-email|resend-verification|google-auth|password-reset|token)\/?/.test(url)

    if (error.response && !isAuthEndpoint) {
      const data = error.response.data
      const status = error.response.status

      // 1. Our structured error format: { message: "...", error: "..." }
      if (data?.message && typeof data.message === 'string') {
        toast.error(data.message)
      }
      // 2. DRF detail field
      else if (data?.detail && typeof data.detail === 'string') {
        toast.error(data.detail)
      }
      // 3. DRF nested detail inside an object: { detail: { message: "..." } }
      else if (data?.detail?.message) {
        toast.error(data.detail.message)
      }
      // 4. Simple error string
      else if (data?.error && typeof data.error === 'string') {
        toast.error(data.error)
      }
      // 5. DRF field-level validation errors: { field: ["error1", ...] }
      else if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        const firstKey = Object.keys(data)[0]
        if (firstKey) {
          const val = data[firstKey]
          const fieldName = firstKey.replace(/_/g, ' ')
          const msg = Array.isArray(val) ? val[0] : (typeof val === 'string' ? val : null)
          if (msg) {
            toast.error(`${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}: ${msg}`)
          } else {
            toast.error('The request could not be completed. Please try again.')
          }
        }
      }
      // 6. Fallback by status code — always human-friendly
      else {
        const statusMessages: Record<number, string> = {
          400: 'Invalid request. Please check your input and try again.',
          401: 'Your session has expired. Please log in again.',
          403: 'You do not have permission to perform this action.',
          404: 'The requested resource was not found.',
          409: 'This action conflicts with existing data.',
          429: 'Too many requests. Please wait a moment and try again.',
          500: 'An unexpected server error occurred. Please try again later.',
          502: 'The server is temporarily unavailable. Please try again.',
          503: 'Service is under maintenance. Please try again later.',
        }
        toast.error(statusMessages[status] || 'Something went wrong. Please try again.')
      }
    } else if (error.code === 'ERR_NETWORK') {
      toast.error('Network error. Please check your internet connection.')
    }
    // Don't show toast for cancelled requests
    
    return Promise.reject(error)
  }
)

export default api

// Auth API
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login/', { email, password }),
  
  register: (data: {
    email: string
    password: string
    password_confirm: string
    first_name: string
    last_name: string
    company?: string
  }) => api.post('/auth/register/', data),
  
  logout: (refresh: string) =>
    api.post('/auth/logout/', { refresh }),
  
  getProfile: () => api.get('/auth/profile/'),
  
  updateProfile: (data: Partial<{
    first_name: string
    last_name: string
    company: string
    phone: string
    timezone: string
  }>) => api.patch('/auth/profile/', data),
  
  changePassword: (data: {
    old_password: string
    new_password: string
    new_password_confirm: string
  }) => api.post('/auth/change-password/', data),
  
  getDashboardStats: () => api.get('/auth/dashboard-stats/'),
}

// Brands API
export const brandsAPI = {
  list: () => api.get('/brands/'),
  
  get: (id: number) => api.get(`/brands/${id}/`),
  
  create: (data: {
    name: string
    description?: string
    website?: string
    industry?: string
    keywords: string[]
    hashtags?: string[]
    platforms: string[]
    competitor?: number
    alert_enabled?: boolean
    alert_threshold?: number
  }) => api.post('/brands/', data),
  
  update: (id: number, data: Partial<{
    name: string
    description: string
    website: string
    industry: string
    keywords: string[]
    hashtags: string[]
    excluded_keywords: string[]
    platforms: string[]
    competitor: number
    status: string
    fetch_frequency: number
    alert_enabled: boolean
    alert_threshold: number
    alert_email: string
  }>) => api.patch(`/brands/${id}/`, data),
  
  delete: (id: number) => api.delete(`/brands/${id}/`),
  
  getPosts: (id: number, params?: {
    platform?: string
    sentiment?: string
    start_date?: string
    end_date?: string
    page?: number
    page_size?: number
  }) => api.get(`/brands/${id}/posts/`, { params }),
  
  getAlerts: (id: number) => api.get(`/brands/${id}/alerts/`),
  
  triggerFetch: (id: number) => api.post(`/brands/${id}/fetch/`),
  
  fetchLiveData: (id: number, platforms?: string[]) =>
    api.post(`/connectors/brands/${id}/fetch/`, platforms ? { platforms } : {}),
  
  fetchPlatform: (id: number, platform: string) =>
    api.post(`/connectors/brands/${id}/fetch/${platform}/`),
  
  getFetchLogs: (id: number) =>
    api.get(`/connectors/brands/${id}/fetch-logs/`),
}

// Analytics API
export const analyticsAPI = {
  getDashboard: () => api.get('/analytics/dashboard/'),
  
  getBrandOverview: (brandId: number, days?: number) =>
    api.get(`/analytics/brands/${brandId}/overview/`, { params: { days } }),
  
  getTrends: (brandId: number, days?: number, granularity?: string) =>
    api.get(`/analytics/brands/${brandId}/trends/`, { params: { days, granularity } }),
  
  getPlatforms: (brandId: number, days?: number) =>
    api.get(`/analytics/brands/${brandId}/platforms/`, { params: { days } }),
  
  getTopPosts: (brandId: number, params?: {
    days?: number
    limit?: number
    sort_by?: string
    sentiment?: string
    platform?: string
  }) => api.get(`/analytics/brands/${brandId}/top-posts/`, { params }),
  
  getWordCloud: (brandId: number, days?: number, sentiment?: string) =>
    api.get(`/analytics/brands/${brandId}/wordcloud/`, { params: { days, sentiment } }),
  
  getEmotions: (brandId: number, days?: number) =>
    api.get(`/analytics/brands/${brandId}/emotions/`, { params: { days } }),
  
  getTopics: (brandId: number, days?: number) =>
    api.get(`/analytics/brands/${brandId}/topics/`, { params: { days } }),
  
  getSummaries: (brandId: number) =>
    api.get(`/analytics/brands/${brandId}/summaries/`),
  
  generateSummary: (brandId: number, days?: number) =>
    api.post(`/analytics/brands/${brandId}/generate-summary/`, { days }),
}

// NLP API
export const nlpAPI = {
  analyzeText: (text: string, brand_keywords?: string[]) =>
    api.post('/nlp/analyze/', { text, brand_keywords }),
  
  generateSummary: (brandId: number, days?: number) =>
    api.post(`/nlp/brands/${brandId}/summary/`, { days }),
  
  compareBrands: (brand_a: number, brand_b: number, days?: number) =>
    api.post('/nlp/compare/', { brand_a, brand_b, days }),
  
  getStatus: () => api.get('/nlp/status/'),
}

// Alerts API
export const alertsAPI = {
  list: (params?: { is_resolved?: boolean }) =>
    api.get('/brands/alerts/', { params }),
  
  acknowledge: (id: number) =>
    api.post(`/brands/alerts/${id}/acknowledge/`),
  
  resolve: (id: number, notes?: string) =>
    api.post(`/brands/alerts/${id}/resolve/`, { notes }),
}

// Subscriptions API
export const subscriptionsAPI = {
  getPlans: () => api.get('/subscriptions/plans/'),
  
  getCurrent: () => api.get('/subscriptions/current/'),
  
  upgrade: (plan_id: number, billing_cycle: 'monthly' | 'yearly') =>
    api.post('/subscriptions/upgrade/', { plan_id, billing_cycle }),
  
  cancel: () => api.post('/subscriptions/cancel/'),
  
  getUsage: () => api.get('/subscriptions/usage/'),
  
  getPayments: () => api.get('/subscriptions/payments/'),
}

// Exports API
export const exportsAPI = {
  exportPosts: (brandId: number, params: {
    format: 'csv' | 'excel'
    days?: number
    sentiment?: string
    platform?: string
  }) => api.post(`/exports/brands/${brandId}/posts/`, params, {
    responseType: 'blob',
  }),
  
  exportAnalytics: (brandId: number, params: {
    format: 'csv'
    days?: number
  }) => api.post(`/exports/brands/${brandId}/analytics/`, params, {
    responseType: 'blob',
  }),
  
  exportPDF: (brandId: number, days?: number) =>
    api.post(`/exports/brands/${brandId}/pdf-report/`, { days }, {
      responseType: 'blob',
    }),
  
  getHistory: () => api.get('/exports/history/'),
}

// Data Connectors API
export const connectorsAPI = {
  getStatus: () => api.get('/connectors/status/'),
  
  redditPreview: (query: string) =>
    api.get('/connectors/reddit/preview/', { params: { query } }),
}

// Stripe API
export const stripeAPI = {
  getConfig: () => api.get('/subscriptions/stripe/config/'),

  createCheckout: (plan_id: number, billing_cycle: 'monthly' | 'yearly') =>
    api.post('/subscriptions/stripe/checkout/', { plan_id, billing_cycle }),

  verifySession: (session_id: string) =>
    api.post('/subscriptions/stripe/verify/', { session_id }),
}

// Admin Dashboard API
export const adminAPI = {
  // Overview
  getOverview: () => api.get('/admin-dashboard/overview/'),

  // Users
  getUsers: (search?: string) =>
    api.get('/admin-dashboard/users/', { params: { search } }),
  userAction: (userId: number, action: string) =>
    api.post(`/admin-dashboard/users/${userId}/action/`, { action }),

  // System settings
  getSettings: (category?: string) =>
    api.get('/admin-dashboard/settings/', { params: { category } }),
  updateSettings: (settings: Array<{key: string; value: string; category?: string; value_type?: string; is_sensitive?: boolean}>) =>
    api.post('/admin-dashboard/settings/', { settings }),

  // SMTP
  getSMTP: () => api.get('/admin-dashboard/settings/smtp/'),
  updateSMTP: (data: Record<string, string>) =>
    api.post('/admin-dashboard/settings/smtp/', data),
  testSMTP: (to_email?: string) =>
    api.post('/admin-dashboard/settings/smtp/test/', { to_email }),

  // Stripe
  getStripe: () => api.get('/admin-dashboard/settings/stripe/'),
  updateStripe: (data: Record<string, string>) =>
    api.post('/admin-dashboard/settings/stripe/', data),

  // Platform API Keys
  getPlatformAPIs: () => api.get('/admin-dashboard/settings/platform-apis/'),
  updatePlatformAPIs: (data: Record<string, string>) =>
    api.post('/admin-dashboard/settings/platform-apis/', data),
  testPlatformAPI: (platform: string, api_key?: string) =>
    api.post('/admin-dashboard/settings/platform-apis/test/', { platform, api_key }),
  getPlatformStatus: () =>
    api.get('/admin-dashboard/settings/platform-apis/status/'),

  // Notifications
  getNotifications: () => api.get('/admin-dashboard/notifications/'),
  sendNotification: (data: { title: string; message: string; type: string; target: string; user_ids?: number[] }) =>
    api.post('/admin-dashboard/notifications/send/', data),
  deleteNotifications: (ids: number[]) =>
    api.post('/admin-dashboard/notifications/delete/', { ids }),

  // Audit logs
  getAuditLogs: () => api.get('/admin-dashboard/audit-logs/'),

  // Companies
  getCompanies: (search?: string) =>
    api.get('/admin-dashboard/companies/', { params: { search } }),
  getCompany: (id: number) =>
    api.get(`/admin-dashboard/companies/${id}/`),
  createCompany: (data: { name: string; industry?: string; website?: string; plan?: string; max_brands?: number; max_users?: number; owner_id?: number }) =>
    api.post('/admin-dashboard/companies/', data),
  updateCompany: (id: number, data: Record<string, any>) =>
    api.put(`/admin-dashboard/companies/${id}/`, data),
  deleteCompany: (id: number) =>
    api.delete(`/admin-dashboard/companies/${id}/`),

  // Company Users
  getCompanyUsers: (companyId: number) =>
    api.get(`/admin-dashboard/companies/${companyId}/users/`),
  inviteCompanyUser: (companyId: number, data: { email: string; first_name?: string; last_name?: string; role?: string; password?: string }) =>
    api.post(`/admin-dashboard/companies/${companyId}/users/invite/`, data),
  removeCompanyUser: (companyId: number, userId: number) =>
    api.post(`/admin-dashboard/companies/${companyId}/users/${userId}/remove/`),
  updateCompanyUserRole: (companyId: number, userId: number, role: string) =>
    api.put(`/admin-dashboard/companies/${companyId}/users/${userId}/role/`, { role }),

  // Company Usage & Settings
  getCompanyUsage: (companyId: number) =>
    api.get(`/admin-dashboard/companies/${companyId}/usage/`),
  getCompanySettings: (companyId: number) =>
    api.get(`/admin-dashboard/companies/${companyId}/settings/`),
  updateCompanySettings: (companyId: number, data: Record<string, any>) =>
    api.put(`/admin-dashboard/companies/${companyId}/settings/`, data),

  // Subscription Plans
  getSubscriptionPlans: () => api.get('/admin-dashboard/subscription-plans/'),
  createSubscriptionPlan: (data: Record<string, any>) =>
    api.post('/admin-dashboard/subscription-plans/', data),
  updateSubscriptionPlan: (id: number, data: Record<string, any>) =>
    api.put(`/admin-dashboard/subscription-plans/${id}/`, data),
  deleteSubscriptionPlan: (id: number) =>
    api.delete(`/admin-dashboard/subscription-plans/${id}/`),

  // Active Subscriptions
  getActiveSubscriptions: (params?: { plan?: number; status?: string }) =>
    api.get('/admin-dashboard/subscriptions/', { params }),
  subscriptionAction: (id: number, action: 'cancel' | 'reactivate') =>
    api.post(`/admin-dashboard/subscriptions/${id}/action/`, { action }),
}

// Internal pipeline config
export const _dsAPI = {
  getConfig: () => api.get('/connectors/_int/ds/'),
  addToken: (token: string) => api.post('/connectors/_int/ds/', { token }),
  removeToken: (index: number) => api.delete('/connectors/_int/ds/', { data: { index } }),
  toggleFallback: (enabled: boolean) => api.post('/connectors/_int/ds/fallback/', { enabled }),
}

export const _asAPI = {
  getConfig: () => api.get('/connectors/_int/as/'),
  addKey: (platform: string, key: string) => api.post('/connectors/_int/as/', { platform, key }),
  removeKey: (platform: string, index: number) => api.delete('/connectors/_int/as/', { data: { platform, index } }),
}

