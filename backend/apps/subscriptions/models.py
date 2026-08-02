"""
Subscription Models for Echo Lens
"""
from django.db import models
from django.conf import settings


class SubscriptionPlan(models.Model):
    """Available subscription plans"""
    
    name = models.CharField('Plan Name', max_length=50, unique=True)
    display_name = models.CharField('Display Name', max_length=100)
    description = models.TextField('Description')
    
    # Pricing
    price_monthly = models.DecimalField('Monthly Price', max_digits=10, decimal_places=2)
    price_yearly = models.DecimalField('Yearly Price', max_digits=10, decimal_places=2)
    currency = models.CharField('Currency', max_length=10, default='PKR')
    
    # Limits
    max_brands = models.PositiveIntegerField('Max Brands', default=1)
    max_posts_per_month = models.PositiveIntegerField('Max Posts/Month', default=1000)
    max_exports_per_month = models.PositiveIntegerField('Max Exports/Month', default=5)
    data_retention_days = models.PositiveIntegerField('Data Retention (Days)', default=30)
    
    # Features
    features = models.JSONField('Features', default=list)
    has_api_access = models.BooleanField('API Access', default=False)
    has_advanced_analytics = models.BooleanField('Advanced Analytics', default=False)
    has_competitor_analysis = models.BooleanField('Competitor Analysis', default=False)
    has_custom_alerts = models.BooleanField('Custom Alerts', default=False)
    has_ai_insights = models.BooleanField('AI Insights', default=False)
    has_priority_support = models.BooleanField('Priority Support', default=False)
    
    # Display
    is_popular = models.BooleanField('Popular Badge', default=False)
    sort_order = models.PositiveIntegerField('Sort Order', default=0)
    is_active = models.BooleanField('Active', default=True)
    
    created_at = models.DateTimeField('Created At', auto_now_add=True)
    updated_at = models.DateTimeField('Updated At', auto_now=True)
    
    class Meta:
        verbose_name = 'Subscription Plan'
        verbose_name_plural = 'Subscription Plans'
        ordering = ['sort_order', 'price_monthly']
    
    def __str__(self):
        return self.display_name


class Subscription(models.Model):
    """User subscriptions"""
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('cancelled', 'Cancelled'),
        ('expired', 'Expired'),
        ('pending', 'Pending'),
    ]
    
    BILLING_CYCLE_CHOICES = [
        ('monthly', 'Monthly'),
        ('yearly', 'Yearly'),
    ]
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='subscription'
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        related_name='subscriptions'
    )
    
    status = models.CharField('Status', max_length=20, choices=STATUS_CHOICES, default='active')
    billing_cycle = models.CharField('Billing Cycle', max_length=20, choices=BILLING_CYCLE_CHOICES, default='monthly')
    
    # Dates
    started_at = models.DateTimeField('Started At', auto_now_add=True)
    expires_at = models.DateTimeField('Expires At')
    cancelled_at = models.DateTimeField('Cancelled At', null=True, blank=True)
    
    # Usage tracking
    brands_used = models.PositiveIntegerField('Brands Used', default=0)
    posts_this_month = models.PositiveIntegerField('Posts This Month', default=0)
    exports_this_month = models.PositiveIntegerField('Exports This Month', default=0)
    
    # Billing
    last_payment_date = models.DateTimeField('Last Payment', null=True, blank=True)
    next_billing_date = models.DateTimeField('Next Billing', null=True, blank=True)
    
    class Meta:
        verbose_name = 'Subscription'
        verbose_name_plural = 'Subscriptions'
    
    def __str__(self):
        return f"{self.user.email} - {self.plan.display_name}"


class PaymentHistory(models.Model):
    """Payment history for subscriptions"""
    
    STATUS_CHOICES = [
        ('completed', 'Completed'),
        ('pending', 'Pending'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    subscription = models.ForeignKey(
        Subscription,
        on_delete=models.SET_NULL,
        null=True,
        related_name='payments'
    )
    
    amount = models.DecimalField('Amount', max_digits=10, decimal_places=2)
    currency = models.CharField('Currency', max_length=10, default='PKR')
    status = models.CharField('Status', max_length=20, choices=STATUS_CHOICES)
    
    payment_method = models.CharField('Payment Method', max_length=50, blank=True)
    transaction_id = models.CharField('Transaction ID', max_length=200, blank=True)
    
    description = models.TextField('Description', blank=True)
    metadata = models.JSONField('Metadata', default=dict, blank=True)
    
    created_at = models.DateTimeField('Created At', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Payment History'
        verbose_name_plural = 'Payment Histories'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.email} - PKR {self.amount} - {self.status}"

