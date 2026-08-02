"""
URL patterns for subscriptions app
"""
from django.urls import path
from . import views
from .stripe_views import StripeCheckoutView, StripeWebhookView, StripeConfigView, StripeVerifySessionView

app_name = 'subscriptions'

urlpatterns = [
    path('plans/', views.SubscriptionPlanListView.as_view(), name='plans'),
    path('current/', views.CurrentSubscriptionView.as_view(), name='current'),
    path('upgrade/', views.UpgradeSubscriptionView.as_view(), name='upgrade'),
    path('cancel/', views.CancelSubscriptionView.as_view(), name='cancel'),
    path('payments/', views.PaymentHistoryView.as_view(), name='payments'),
    path('usage/', views.UsageStatsView.as_view(), name='usage'),

    # Stripe
    path('stripe/checkout/', StripeCheckoutView.as_view(), name='stripe_checkout'),
    path('stripe/webhook/', StripeWebhookView.as_view(), name='stripe_webhook'),
    path('stripe/config/', StripeConfigView.as_view(), name='stripe_config'),
    path('stripe/verify/', StripeVerifySessionView.as_view(), name='stripe_verify'),
]
