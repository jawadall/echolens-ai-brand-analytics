"""
URL patterns for Admin Dashboard
"""
from django.urls import path
from . import views

app_name = 'admin_dashboard'

urlpatterns = [
    # Dashboard overview
    path('overview/', views.AdminDashboardView.as_view(), name='overview'),

    # User management
    path('users/', views.AdminUserListView.as_view(), name='users'),
    path('users/<int:pk>/action/', views.AdminUserActionView.as_view(), name='user_action'),

    # System settings
    path('settings/', views.SystemSettingsView.as_view(), name='settings'),

    # SMTP settings
    path('settings/smtp/', views.SMTPSettingsView.as_view(), name='smtp_settings'),
    path('settings/smtp/test/', views.SMTPTestView.as_view(), name='smtp_test'),

    # SMS settings
    path('settings/sms/', views.SMSSettingsView.as_view(), name='sms_settings'),

    # Stripe settings
    path('settings/stripe/', views.StripeSettingsView.as_view(), name='stripe_settings'),

    # Platform API Keys
    path('settings/platform-apis/', views.PlatformAPIKeysView.as_view(), name='platform_api_keys'),
    path('settings/platform-apis/test/', views.PlatformAPITestView.as_view(), name='platform_api_test'),
    path('settings/platform-apis/status/', views.PlatformStatusView.as_view(), name='platform_status'),

    # Notification management
    path('notifications/', views.AdminNotificationListView.as_view(), name='notifications'),
    path('notifications/send/', views.AdminSendNotificationView.as_view(), name='send_notification'),
    path('notifications/delete/', views.AdminDeleteNotificationsView.as_view(), name='delete_notifications'),

    # Audit logs
    path('audit-logs/', views.AuditLogView.as_view(), name='audit_logs'),

    # Company management
    path('companies/', views.CompanyListView.as_view(), name='companies'),
    path('companies/<int:pk>/', views.CompanyDetailView.as_view(), name='company_detail'),

    # Company user management
    path('companies/<int:pk>/users/', views.CompanyUsersView.as_view(), name='company_users'),
    path('companies/<int:pk>/users/invite/', views.CompanyInviteUserView.as_view(), name='company_invite_user'),
    path('companies/<int:pk>/users/<int:user_id>/remove/', views.CompanyRemoveUserView.as_view(), name='company_remove_user'),
    path('companies/<int:pk>/users/<int:user_id>/role/', views.CompanyUpdateUserRoleView.as_view(), name='company_update_role'),

    # Company usage & settings
    path('companies/<int:pk>/usage/', views.CompanyUsageView.as_view(), name='company_usage'),
    path('companies/<int:pk>/settings/', views.CompanySettingsView.as_view(), name='company_settings'),

    # Subscription plan management
    path('subscription-plans/', views.AdminSubscriptionPlansView.as_view(), name='subscription_plans'),
    path('subscription-plans/<int:pk>/', views.AdminSubscriptionPlanDetailView.as_view(), name='subscription_plan_detail'),
    path('subscriptions/', views.AdminActiveSubscriptionsView.as_view(), name='active_subscriptions'),
    path('subscriptions/<int:pk>/action/', views.AdminSubscriptionActionView.as_view(), name='subscription_action'),
]
