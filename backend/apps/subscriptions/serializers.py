"""
Serializers for Subscriptions
"""
from rest_framework import serializers
from .models import SubscriptionPlan, Subscription, PaymentHistory


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    """Serializer for subscription plans"""
    
    class Meta:
        model = SubscriptionPlan
        fields = [
            'id', 'name', 'display_name', 'description',
            'price_monthly', 'price_yearly', 'currency',
            'max_brands', 'max_posts_per_month', 'max_exports_per_month',
            'data_retention_days', 'features',
            'has_api_access', 'has_advanced_analytics', 'has_competitor_analysis',
            'has_custom_alerts', 'has_ai_insights', 'has_priority_support',
            'is_popular'
        ]


class SubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for user subscription"""
    
    plan_details = SubscriptionPlanSerializer(source='plan', read_only=True)
    
    class Meta:
        model = Subscription
        fields = [
            'id', 'plan', 'plan_details', 'status', 'billing_cycle',
            'started_at', 'expires_at', 'cancelled_at',
            'brands_used', 'posts_this_month', 'exports_this_month',
            'last_payment_date', 'next_billing_date'
        ]
        read_only_fields = ['id', 'started_at', 'cancelled_at']


class PaymentHistorySerializer(serializers.ModelSerializer):
    """Serializer for payment history"""
    
    class Meta:
        model = PaymentHistory
        fields = [
            'id', 'amount', 'currency', 'status',
            'payment_method', 'transaction_id', 'description',
            'created_at'
        ]


class UpgradeSubscriptionSerializer(serializers.Serializer):
    """Serializer for upgrading subscription"""
    
    plan_id = serializers.IntegerField()
    billing_cycle = serializers.ChoiceField(choices=['monthly', 'yearly'])

