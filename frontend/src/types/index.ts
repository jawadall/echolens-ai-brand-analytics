// User types
export interface CompanyInfo {
  id: number
  name: string
  plan: string
  status: string
  is_owner: boolean
  brands_used: number
  brands_limit: number
  users_used: number
  users_limit: number
}

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  full_name: string
  company: string
  company_info?: CompanyInfo | null
  role: 'admin' | 'analyst' | 'viewer'
  is_staff?: boolean
  subscription_plan: string
  subscription_expires: string | null
  avatar: string | null
  timezone: string
  max_brands?: number
  brands_count?: number
  created_at: string
}

export interface CompanyMember {
  id: number
  email: string
  full_name: string
  role: 'admin' | 'analyst' | 'viewer'
  is_active: boolean
  is_owner: boolean
  brands_count: number
  last_activity: string | null
  date_joined: string
}

export interface CompanyUsage {
  brands: { used: number; limit: number }
  users: { used: number; limit: number }
  posts_this_month: { used: number; limit: number }
  exports_this_month: { used: number; limit: number }
  features: Record<string, boolean>
  plan: { name: string; display_name: string }
  company: { id: number; name: string }
}

// Brand types
export interface Brand {
  id: number
  name: string
  description: string
  logo: string | null
  website: string
  industry: string
  keywords: string[]
  hashtags: string[]
  excluded_keywords: string[]
  competitor: number | null
  competitor_name: string | null
  platforms: string[]
  status: 'active' | 'paused' | 'archived'
  fetch_frequency: number
  last_fetch: string | null
  alert_enabled: boolean
  alert_threshold: number
  alert_email: string
  total_posts: number
  posts_count?: number
  avg_sentiment: number
  sentiment_distribution: {
    positive: number
    neutral: number
    negative: number
  }
  api_keys?: Record<string, string>
  created_at: string
  updated_at: string
}

// Post types
export interface Post {
  id: number
  platform: 'twitter' | 'reddit' | 'facebook' | 'instagram' | 'youtube' | 'news' | 'other'
  url: string
  author_name: string
  author_username: string
  author_verified: boolean
  content: string
  sentiment: 'positive' | 'neutral' | 'negative' | null
  sentiment_score: number | null
  likes: number
  shares: number
  comments: number
  engagement_score: number
  topics: string[]
  emotions?: Record<string, number>
  views?: number
  posted_at: string
}

// Analytics types
export interface BrandOverview {
  brand_id: number
  brand_name: string
  period: {
    start: string
    end: string
    days: number
  }
  total_posts: number
  total_all_time?: number
  platform_breakdown?: Record<string, number>
  all_time_platform_breakdown?: Record<string, number>
  sentiment: {
    positive: number
    neutral: number
    negative: number
    average_score: number
    avg_score?: number
    change: number
  }
  engagement: {
    total_likes: number
    total_shares: number
    total_comments: number
    total_views: number
  }
  trending_topics: Array<{
    topic: string
    count: number
  }>
  recent_alerts: number
}

export interface TrendData {
  labels: string[]
  datasets: {
    total: number[]
    positive: number[]
    neutral: number[]
    negative: number[]
    sentiment_score: number[]
  }
}

export interface WordCloudItem {
  text: string
  value: number
  sentiment: string
  sentiment_score: number
}

// Alert types
export interface Alert {
  id: number
  brand: number
  brand_name: string
  alert_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  metrics: Record<string, any>
  is_acknowledged: boolean
  acknowledged_at: string | null
  is_resolved: boolean
  resolution_notes: string
  resolved_at: string | null
  created_at: string
}

// Subscription types
export interface SubscriptionPlan {
  id: number
  name: string
  display_name: string
  description: string
  price_monthly: string
  price_yearly: string
  currency: string
  max_brands: number
  max_posts_per_month: number
  max_exports_per_month: number
  data_retention_days: number
  features: string[]
  has_api_access: boolean
  has_advanced_analytics: boolean
  has_competitor_analysis: boolean
  has_custom_alerts: boolean
  has_ai_insights: boolean
  has_priority_support: boolean
  is_popular: boolean
}

export interface Subscription {
  id: number
  plan: number
  plan_details: SubscriptionPlan
  status: 'active' | 'cancelled' | 'expired' | 'pending'
  billing_cycle: 'monthly' | 'yearly'
  started_at: string
  expires_at: string
  cancelled_at: string | null
  brands_used: number
  posts_this_month: number
  exports_this_month: number
}

// Summary types
export interface AISummary {
  id: number
  summary_type: string
  start_date: string
  end_date: string
  summary_text: string
  key_insights: string[]
  what_users_like: string
  what_users_dislike: string
  platform_analysis?: string
  recommendations: string[]
  metrics_snapshot: Record<string, number>
  created_at: string
}

// Dashboard types
export interface DashboardOverview {
  total_brands: number
  total_posts: number
  total_alerts: number
  overall_sentiment: number
  brands: Array<{
    id: number
    name: string
    logo: string | null
    posts: number
    sentiment: number
    alerts: number
    last_fetch: string | null
  }>
}

// API Response types
export interface AuthResponse {
  access: string
  refresh: string
  user: User
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

