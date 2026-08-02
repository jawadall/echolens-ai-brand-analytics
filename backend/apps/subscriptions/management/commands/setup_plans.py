"""
Django management command to set up subscription plans
"""
from django.core.management.base import BaseCommand
from apps.subscriptions.models import SubscriptionPlan


class Command(BaseCommand):
    help = 'Set up initial subscription plans'

    def handle(self, *args, **options):
        plans = [
            {
                'name': 'free',
                'display_name': 'Free',
                'description': 'Get started with basic monitoring',
                'price_monthly': 0,
                'price_yearly': 0,
                'currency': 'PKR',
                'max_brands': 1,
                'max_posts_per_month': 100,
                'max_exports_per_month': 2,
                'data_retention_days': 7,
                'features': ['1 Brand', '100 Posts/month', 'Basic Sentiment', 'CSV Export'],
                'has_api_access': False,
                'has_advanced_analytics': False,
                'has_competitor_analysis': False,
                'has_custom_alerts': False,
                'has_ai_insights': False,
                'has_priority_support': False,
                'is_popular': False,
                'sort_order': 1,
            },
            {
                'name': 'basic',
                'display_name': 'Basic',
                'description': 'For small teams and growing brands',
                'price_monthly': 2999,
                'price_yearly': 29990,
                'currency': 'PKR',
                'max_brands': 3,
                'max_posts_per_month': 1000,
                'max_exports_per_month': 10,
                'data_retention_days': 30,
                'features': ['3 Brands', '1,000 Posts/month', 'Advanced Sentiment', 'PDF Reports', 'Email Alerts'],
                'has_api_access': False,
                'has_advanced_analytics': True,
                'has_competitor_analysis': False,
                'has_custom_alerts': True,
                'has_ai_insights': False,
                'has_priority_support': False,
                'is_popular': False,
                'sort_order': 2,
            },
            {
                'name': 'professional',
                'display_name': 'Professional',
                'description': 'For marketing teams and agencies',
                'price_monthly': 7999,
                'price_yearly': 79990,
                'currency': 'PKR',
                'max_brands': 10,
                'max_posts_per_month': 10000,
                'max_exports_per_month': 50,
                'data_retention_days': 90,
                'features': ['10 Brands', '10,000 Posts/month', 'AI Insights', 'Competitor Analysis', 'API Access', 'Priority Support'],
                'has_api_access': True,
                'has_advanced_analytics': True,
                'has_competitor_analysis': True,
                'has_custom_alerts': True,
                'has_ai_insights': True,
                'has_priority_support': True,
                'is_popular': True,
                'sort_order': 3,
            },
            {
                'name': 'enterprise',
                'display_name': 'Enterprise',
                'description': 'For large organizations',
                'price_monthly': 19999,
                'price_yearly': 199990,
                'currency': 'PKR',
                'max_brands': 50,
                'max_posts_per_month': 100000,
                'max_exports_per_month': 500,
                'data_retention_days': 365,
                'features': ['50 Brands', '100,000 Posts/month', 'Custom Integrations', 'Dedicated Support', 'SLA', 'White Label'],
                'has_api_access': True,
                'has_advanced_analytics': True,
                'has_competitor_analysis': True,
                'has_custom_alerts': True,
                'has_ai_insights': True,
                'has_priority_support': True,
                'is_popular': False,
                'sort_order': 4,
            },
        ]

        for plan_data in plans:
            plan, created = SubscriptionPlan.objects.update_or_create(
                name=plan_data['name'],
                defaults=plan_data
            )
            status = 'Created' if created else 'Updated'
            self.stdout.write(self.style.SUCCESS(f'{status} plan: {plan.display_name}'))

        self.stdout.write(self.style.SUCCESS('Successfully set up subscription plans!'))
