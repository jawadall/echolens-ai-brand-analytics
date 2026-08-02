"""
Views for Subscription Management
"""
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.conf import settings
from datetime import timedelta

from .models import SubscriptionPlan, Subscription, PaymentHistory
from .serializers import (
    SubscriptionPlanSerializer, SubscriptionSerializer,
    PaymentHistorySerializer, UpgradeSubscriptionSerializer
)


class SubscriptionPlanListView(generics.ListAPIView):
    """List all available subscription plans"""
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [permissions.AllowAny]
    queryset = SubscriptionPlan.objects.filter(is_active=True).order_by('sort_order')


class CurrentSubscriptionView(APIView):
    """Get current user's subscription"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        # Build fresh company_info
        company_info = None
        if request.user.company_ref:
            co = request.user.company_ref
            limits = co.get_plan_limits()
            company_info = {
                'id': co.id,
                'name': co.name,
                'plan': co.plan,
                'status': co.status,
                'is_owner': co.owner_id == request.user.id,
                'brands_used': co.brands_count,
                'brands_limit': limits['max_brands'],
                'users_used': co.users_count,
                'users_limit': limits['max_users'],
            }

        try:
            subscription = Subscription.objects.get(user=request.user)
            serializer = SubscriptionSerializer(subscription)
            data = serializer.data
            data['company_info'] = company_info
            return Response(data)
        except Subscription.DoesNotExist:
            # Return free plan info
            return Response({
                'plan': 'free',
                'status': 'active',
                'company_info': company_info,
                'limits': {
                    'max_brands': 1,
                    'max_posts_per_month': 100,
                    'max_exports_per_month': 2,
                }
            })


class UpgradeSubscriptionView(APIView):
    """Upgrade subscription to a new plan"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = UpgradeSubscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        plan_id = serializer.validated_data['plan_id']
        billing_cycle = serializer.validated_data['billing_cycle']
        
        try:
            plan = SubscriptionPlan.objects.get(id=plan_id, is_active=True)
        except SubscriptionPlan.DoesNotExist:
            return Response(
                {'error': 'Invalid plan'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Determine price
        if billing_cycle == 'monthly':
            amount = plan.price_monthly
            expires_at = timezone.now() + timedelta(days=30)
        else:
            amount = plan.price_yearly
            expires_at = timezone.now() + timedelta(days=365)

        # ── Check if Stripe payment is required ────────────────
        price_value = float(amount)
        if price_value > 0:
            try:
                from apps.admin_dashboard.models import SystemSetting
                stripe_enabled = SystemSetting.get('stripe_enabled', 'false').lower() == 'true'

                if stripe_enabled:
                    # Create Stripe Checkout Session instead of instant upgrade
                    from apps.subscriptions.stripe_views import get_stripe
                    stripe = get_stripe()
                    if stripe and stripe.api_key:
                        session = stripe.checkout.Session.create(
                            payment_method_types=['card'],
                            line_items=[{
                                'price_data': {
                                    'currency': plan.currency.lower(),
                                    'product_data': {
                                        'name': f'Echo Lens - {plan.display_name}',
                                        'description': f'{billing_cycle.capitalize()} subscription',
                                    },
                                    'unit_amount': int(price_value * 100),
                                },
                                'quantity': 1,
                            }],
                            mode='payment',
                            success_url=f'{settings.FRONTEND_URL}/subscription?status=success&plan={plan.name}',
                            cancel_url=f'{settings.FRONTEND_URL}/subscription?status=cancelled',
                            metadata={
                                'user_id': str(request.user.id),
                                'plan_id': str(plan.id),
                                'billing_cycle': billing_cycle,
                            },
                            customer_email=request.user.email,
                        )
                        return Response({
                            'requires_payment': True,
                            'checkout_url': session.url,
                            'session_id': session.id,
                            'message': 'Redirecting to Stripe checkout...',
                        })
            except Exception as e:
                # If Stripe fails, fall back to demo mode
                import logging
                logging.getLogger(__name__).warning(f'Stripe checkout failed, falling back to demo: {e}')
        
        # ── Free plan or Stripe not enabled: instant activation ──
        return self._activate_subscription(request.user, plan, billing_cycle, amount, expires_at)

    def _activate_subscription(self, user, plan, billing_cycle, amount, expires_at):
        """Activate subscription immediately (free plans or demo mode)"""
        # Create or update subscription
        subscription, created = Subscription.objects.update_or_create(
            user=user,
            defaults={
                'plan': plan,
                'status': 'active',
                'billing_cycle': billing_cycle,
                'expires_at': expires_at,
                'next_billing_date': expires_at,
                'last_payment_date': timezone.now(),
            }
        )
        
        # Update user's subscription info
        user.subscription_plan = plan.name
        user.subscription_expires = expires_at
        user.save(update_fields=['subscription_plan', 'subscription_expires'])
        
        # ── Sync company plan ──────────────────────────────────
        company_info = None
        if user.company_ref:
            from apps.admin_dashboard.models import PLAN_LIMITS
            company = user.company_ref
            company.plan = plan.name
            limits = PLAN_LIMITS.get(plan.name, PLAN_LIMITS['free'])
            company.max_brands = limits['max_brands']
            company.max_users = limits['max_users']
            company.save(update_fields=['plan', 'max_brands', 'max_users'])
            company_info = {
                'id': company.id,
                'name': company.name,
                'plan': company.plan,
                'status': company.status,
                'is_owner': company.owner_id == user.id,
                'brands_used': company.brands_count,
                'brands_limit': limits['max_brands'],
                'users_used': company.users_count,
                'users_limit': limits['max_users'],
            }
        
        # Create payment record
        PaymentHistory.objects.create(
            user=user,
            subscription=subscription,
            amount=amount,
            currency=plan.currency,
            status='completed',
            payment_method='demo',
            description=f'Subscription to {plan.display_name} ({billing_cycle})'
        )
        
        return Response({
            'message': f'Successfully upgraded to {plan.display_name}',
            'subscription': SubscriptionSerializer(subscription).data,
            'company_info': company_info,
        })


class CancelSubscriptionView(APIView):
    """Cancel current subscription"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            subscription = Subscription.objects.get(user=request.user)
        except Subscription.DoesNotExist:
            return Response(
                {'error': 'No active subscription'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        subscription.status = 'cancelled'
        subscription.cancelled_at = timezone.now()
        subscription.save()
        
        # Downgrade user to free plan after expiry
        # (keeping benefits until expiry date)
        
        return Response({
            'message': 'Subscription cancelled',
            'expires_at': subscription.expires_at,
            'note': 'You will retain access until the end of your billing period'
        })


class PaymentHistoryView(generics.ListAPIView):
    """List payment history"""
    serializer_class = PaymentHistorySerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return PaymentHistory.objects.filter(user=self.request.user)


class UsageStatsView(APIView):
    """Get current usage statistics"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        try:
            subscription = Subscription.objects.get(user=user)
            plan = subscription.plan
            limits = {
                'max_brands': plan.max_brands,
                'max_posts_per_month': plan.max_posts_per_month,
                'max_exports_per_month': plan.max_exports_per_month,
            }
            usage = {
                'brands_used': subscription.brands_used,
                'posts_this_month': subscription.posts_this_month,
                'exports_this_month': subscription.exports_this_month,
            }
        except Subscription.DoesNotExist:
            # Free plan limits
            limits = {
                'max_brands': 1,
                'max_posts_per_month': 100,
                'max_exports_per_month': 2,
            }
            usage = {
                'brands_used': user.brands.count() if hasattr(user, 'brands') else 0,
                'posts_this_month': 0,
                'exports_this_month': 0,
            }
        
        return Response({
            'limits': limits,
            'usage': usage,
            'percentages': {
                'brands': usage['brands_used'] / limits['max_brands'] * 100 if limits['max_brands'] > 0 else 0,
                'posts': usage['posts_this_month'] / limits['max_posts_per_month'] * 100 if limits['max_posts_per_month'] > 0 else 0,
                'exports': usage['exports_this_month'] / limits['max_exports_per_month'] * 100 if limits['max_exports_per_month'] > 0 else 0,
            }
        })

