"""
URL patterns for accounts app
"""
from django.urls import path
from . import views

app_name = 'accounts'

urlpatterns = [
    # Authentication
    path('login/', views.LoginView.as_view(), name='login'),
    path('register/', views.RegisterView.as_view(), name='register'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    
    # Google OAuth
    path('google-auth/', views.GoogleAuthView.as_view(), name='google_auth'),
    
    # Profile
    path('profile/', views.UserProfileView.as_view(), name='profile'),
    path('change-password/', views.ChangePasswordView.as_view(), name='change_password'),
    
    # Activities & Notifications
    path('activities/', views.UserActivityListView.as_view(), name='activities'),
    path('notifications/', views.NotificationListView.as_view(), name='notifications'),
    path('notifications/mark-read/', views.NotificationMarkReadView.as_view(), name='mark_notifications_read'),
    
    # API Keys
    path('api-keys/', views.APIKeyManagementView.as_view(), name='api_keys'),
    
    # Dashboard
    path('dashboard-stats/', views.DashboardStatsView.as_view(), name='dashboard_stats'),

    # Password Reset (OTP-based)
    path('forgot-password/', views.ForgotPasswordView.as_view(), name='forgot_password'),
    path('verify-reset-otp/', views.VerifyResetOTPView.as_view(), name='verify_reset_otp'),
    path('reset-password-otp/', views.ResetPasswordWithOTPView.as_view(), name='reset_password_otp'),
    path('reset-password/', views.ResetPasswordView.as_view(), name='reset_password'),

    # Email Verification (OTP-based)
    path('verify-email/', views.VerifyEmailView.as_view(), name='verify_email'),
    path('resend-verification/', views.ResendVerificationView.as_view(), name='resend_verification'),
]
