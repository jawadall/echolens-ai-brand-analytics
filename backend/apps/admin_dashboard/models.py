"""
Admin Dashboard App - Models
System settings, SMTP/SMS configuration, and admin management
"""
from django.db import models
from django.conf import settings


# ─── Plan enforcement limits ────────────────────────────────────
PLAN_LIMITS = {
    'free':         {'max_brands': 1,  'max_users': 2,  'max_posts_per_month': 500,    'max_exports_per_month': 2,
                     'has_advanced_analytics': False, 'has_competitor_analysis': False, 'has_custom_alerts': False,
                     'has_ai_insights': False, 'has_api_access': False, 'has_priority_support': False},
    'basic':        {'max_brands': 3,  'max_users': 5,  'max_posts_per_month': 2000,   'max_exports_per_month': 10,
                     'has_advanced_analytics': True, 'has_competitor_analysis': False, 'has_custom_alerts': True,
                     'has_ai_insights': False, 'has_api_access': False, 'has_priority_support': False},
    'professional': {'max_brands': 10, 'max_users': 15, 'max_posts_per_month': 10000,  'max_exports_per_month': 50,
                     'has_advanced_analytics': True, 'has_competitor_analysis': True, 'has_custom_alerts': True,
                     'has_ai_insights': True, 'has_api_access': True, 'has_priority_support': True},
    'pro':          {'max_brands': 10, 'max_users': 15, 'max_posts_per_month': 10000,  'max_exports_per_month': 50,
                     'has_advanced_analytics': True, 'has_competitor_analysis': True, 'has_custom_alerts': True,
                     'has_ai_insights': True, 'has_api_access': True, 'has_priority_support': True},
    'enterprise':   {'max_brands': 50, 'max_users': 100,'max_posts_per_month': 100000, 'max_exports_per_month': 500,
                     'has_advanced_analytics': True, 'has_competitor_analysis': True, 'has_custom_alerts': True,
                     'has_ai_insights': True, 'has_api_access': True, 'has_priority_support': True},
}

PLAN_DISPLAY_NAMES = {
    'free': 'Free', 'basic': 'Basic', 'professional': 'Professional',
    'pro': 'Professional', 'enterprise': 'Enterprise',
}


class Company(models.Model):
    """Represents an organization/company on the platform"""
    name = models.CharField('Name', max_length=200)
    industry = models.CharField('Industry', max_length=100, blank=True)
    website = models.URLField('Website', blank=True)
    logo = models.URLField('Logo URL', blank=True)
    plan = models.CharField('Plan', max_length=50, default='free',
                            choices=[('free', 'Free'), ('basic', 'Basic'),
                                     ('pro', 'Pro'), ('enterprise', 'Enterprise')])
    status = models.CharField('Status', max_length=20, default='active',
                              choices=[('active', 'Active'), ('suspended', 'Suspended'), ('cancelled', 'Cancelled')])
    max_brands = models.IntegerField('Max Brands', default=3)
    max_users = models.IntegerField('Max Users', default=5)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                              on_delete=models.SET_NULL, related_name='owned_companies')
    metadata = models.JSONField('Metadata', default=dict, blank=True)
    created_at = models.DateTimeField('Created At', auto_now_add=True)
    updated_at = models.DateTimeField('Updated At', auto_now=True)

    class Meta:
        verbose_name = 'Company'
        verbose_name_plural = 'Companies'
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def brands_count(self):
        """Count brands across all members of this company"""
        from apps.brands.models import Brand
        member_ids = self.members.values_list('id', flat=True)
        return Brand.objects.filter(user_id__in=member_ids).count()

    @property
    def users_count(self):
        """Number of users in this company"""
        return self.members.count()

    def get_plan_limits(self):
        """Return the plan limits for this company"""
        return PLAN_LIMITS.get(self.plan, PLAN_LIMITS['free'])

    def can_add_brand(self):
        limits = self.get_plan_limits()
        return self.brands_count < limits['max_brands']

    def can_add_user(self):
        limits = self.get_plan_limits()
        return self.users_count < limits['max_users']

    def get_usage(self):
        """Return current usage statistics for the company"""
        from apps.brands.models import SocialPost
        from apps.exports.models import ExportJob
        from django.utils import timezone
        import datetime

        limits = self.get_plan_limits()
        member_ids = list(self.members.values_list('id', flat=True))

        # Posts fetched this month
        month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        posts_this_month = SocialPost.objects.filter(
            brand__user_id__in=member_ids,
            fetched_at__gte=month_start
        ).count() if member_ids else 0

        # Exports this month
        exports_this_month = ExportJob.objects.filter(
            user_id__in=member_ids,
            created_at__gte=month_start
        ).count() if member_ids else 0

        # Check if company uses custom API keys (bypass post quota)
        settings_data = self.metadata.get('settings', {})
        api_keys_config = settings_data.get('api_keys', {})
        use_custom_apis = api_keys_config.get('use_custom_apis', False)

        posts_limit = -1 if use_custom_apis else limits['max_posts_per_month']

        return {
            'brands': {'used': self.brands_count, 'limit': limits['max_brands']},
            'users': {'used': self.users_count, 'limit': limits['max_users']},
            'posts_this_month': {'used': posts_this_month, 'limit': posts_limit},
            'exports_this_month': {'used': exports_this_month, 'limit': limits['max_exports_per_month']},
            'use_custom_apis': use_custom_apis,
        }

    def get_features(self):
        """Return feature flags based on plan"""
        limits = self.get_plan_limits()
        return {
            'advanced_analytics': limits.get('has_advanced_analytics', False),
            'competitor_analysis': limits.get('has_competitor_analysis', False),
            'custom_alerts': limits.get('has_custom_alerts', False),
            'ai_insights': limits.get('has_ai_insights', False),
            'api_access': limits.get('has_api_access', False),
            'priority_support': limits.get('has_priority_support', False),
        }



class SystemSetting(models.Model):
    """Stores system-wide configuration as key-value pairs"""
    key = models.CharField('Key', max_length=100, unique=True, db_index=True)
    value = models.TextField('Value', blank=True, default='')
    value_type = models.CharField('Type', max_length=20, default='string',
                                  choices=[('string', 'String'), ('int', 'Integer'),
                                           ('bool', 'Boolean'), ('json', 'JSON')])
    description = models.CharField('Description', max_length=255, blank=True)
    category = models.CharField('Category', max_length=50, default='general',
                                choices=[('general', 'General'), ('smtp', 'SMTP Email'),
                                         ('sms', 'SMS'), ('stripe', 'Stripe Payments'),
                                         ('notifications', 'Notifications')])
    is_sensitive = models.BooleanField('Sensitive', default=False)
    updated_at = models.DateTimeField('Updated At', auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name='settings_updates')

    class Meta:
        verbose_name = 'System Setting'
        verbose_name_plural = 'System Settings'
        ordering = ['category', 'key']

    def __str__(self):
        return f'{self.category}/{self.key}'

    @classmethod
    def get(cls, key, default=''):
        try:
            setting = cls.objects.get(key=key)
            if setting.value_type == 'bool':
                return setting.value.lower() in ('true', '1', 'yes')
            if setting.value_type == 'int':
                return int(setting.value) if setting.value else 0
            if setting.value_type == 'json':
                import json
                return json.loads(setting.value) if setting.value else {}
            return setting.value
        except cls.DoesNotExist:
            return default

    @classmethod
    def set(cls, key, value, category='general', description='', value_type='string',
            is_sensitive=False, user=None):
        obj, _ = cls.objects.update_or_create(
            key=key,
            defaults={
                'value': str(value),
                'category': category,
                'description': description,
                'value_type': value_type,
                'is_sensitive': is_sensitive,
                'updated_by': user,
            }
        )
        return obj


class AuditLog(models.Model):
    """Tracks admin actions for accountability"""
    ACTION_CHOICES = [
        ('setting_change', 'Setting Changed'),
        ('user_action', 'User Action'),
        ('system', 'System Event'),
        ('notification_sent', 'Notification Sent'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                             on_delete=models.SET_NULL, related_name='audit_logs')
    action = models.CharField('Action', max_length=50, choices=ACTION_CHOICES)
    target = models.CharField('Target', max_length=200, blank=True)
    description = models.TextField('Description')
    metadata = models.JSONField('Metadata', default=dict, blank=True)
    ip_address = models.GenericIPAddressField('IP Address', null=True, blank=True)
    created_at = models.DateTimeField('Created At', auto_now_add=True)

    class Meta:
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} by {self.user} at {self.created_at}'
