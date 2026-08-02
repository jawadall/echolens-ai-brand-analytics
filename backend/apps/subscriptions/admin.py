"""
Admin configuration for subscriptions app
"""
from django.contrib import admin
from .models import SubscriptionPlan, Subscription, PaymentHistory


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ['display_name', 'name', 'price_monthly', 'price_yearly', 'max_brands', 'is_active', 'is_popular', 'sort_order']
    list_filter = ['is_active', 'is_popular']
    list_editable = ['is_active', 'is_popular', 'sort_order']
    search_fields = ['name', 'display_name']
    ordering = ['sort_order']


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ['user', 'plan', 'status', 'billing_cycle', 'started_at', 'expires_at']
    list_filter = ['status', 'billing_cycle', 'plan']
    search_fields = ['user__email']
    readonly_fields = ['started_at']


@admin.register(PaymentHistory)
class PaymentHistoryAdmin(admin.ModelAdmin):
    list_display = ['user', 'amount', 'currency', 'status', 'payment_method', 'created_at']
    list_filter = ['status', 'currency', 'created_at']
    search_fields = ['user__email', 'transaction_id']
    readonly_fields = ['created_at']

