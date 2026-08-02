"""
Stripe Payment Integration for Echo Lens
Handles checkout sessions, webhooks, and payment verification
"""
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import logging
import json

from apps.subscriptions.models import SubscriptionPlan, Subscription, PaymentHistory

logger = logging.getLogger(__name__)


def _safe_stripe_dict(obj):
    """Safely convert a Stripe object to a plain Python dict.
    StripeObject in v15 doesn't support dict() — use to_dict_recursive() or manual extraction."""
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    # Try Stripe's own conversion methods
    if hasattr(obj, 'to_dict_recursive'):
        return obj.to_dict_recursive()
    if hasattr(obj, 'to_dict'):
        return obj.to_dict()
    # Manual fallback: iterate over known keys
    try:
        return {k: obj[k] for k in obj.keys()}
    except Exception:
        return {}


def _safe_stripe_val(obj, key, default=''):
    """Safely get a value from a Stripe object by key."""
    if obj is None:
        return default
    try:
        val = obj[key]
        return val if val is not None else default
    except (KeyError, TypeError, AttributeError):
        return default


def get_stripe():
    """Lazy import stripe and configure from SuperAdmin settings (DB only, no .env)"""
    try:
        import stripe
        from apps.admin_dashboard.models import SystemSetting
        secret = SystemSetting.get('stripe_secret_key', '')
        if not secret:
            logger.error("Stripe secret key not configured in SuperAdmin settings")
            return None
        stripe.api_key = secret
        return stripe
    except ImportError:
        logger.error("stripe package not installed")
        return None


class StripeCheckoutView(APIView):
    """Create a Stripe Checkout session"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        stripe = get_stripe()
        if not stripe or not stripe.api_key:
            return Response({'error': 'Stripe not configured'}, status=400)

        plan_id = request.data.get('plan_id')
        billing_cycle = request.data.get('billing_cycle', 'monthly')

        try:
            plan = SubscriptionPlan.objects.get(id=plan_id, is_active=True)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Invalid plan'}, status=400)

        price = float(plan.price_monthly if billing_cycle == 'monthly' else plan.price_yearly)

        try:
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': plan.currency.lower(),
                        'product_data': {
                            'name': f'Echo Lens - {plan.display_name}',
                            'description': f'{billing_cycle.capitalize()} subscription',
                        },
                        'unit_amount': int(price * 100),  # Stripe uses cents
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=request.data.get('success_url',
                    f'{settings.FRONTEND_URL}/subscription?status=success'),
                cancel_url=request.data.get('cancel_url',
                    f'{settings.FRONTEND_URL}/subscription?status=cancelled'),
                metadata={
                    'user_id': str(request.user.id),
                    'plan_id': str(plan.id),
                    'billing_cycle': billing_cycle,
                },
                customer_email=request.user.email,
            )
            return Response({
                'session_id': session.id,
                'checkout_url': session.url,
            })
        except Exception as e:
            logger.error(f"Stripe checkout error: {e}")
            return Response({'error': str(e)}, status=400)


class StripeWebhookView(APIView):
    """Handle Stripe webhooks for payment confirmation"""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        stripe = get_stripe()
        if not stripe:
            return Response(status=400)

        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')

        from apps.admin_dashboard.models import SystemSetting
        webhook_secret = SystemSetting.get('stripe_webhook_secret', '')

        try:
            if webhook_secret:
                event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
            else:
                event = json.loads(payload)
        except Exception as e:
            logger.error(f"Webhook error: {e}")
            return Response({'error': str(e)}, status=400)

        if event.get('type') == 'checkout.session.completed':
            session = event['data']['object']
            self._handle_successful_payment(session)

        return Response({'status': 'ok'})

    def _handle_successful_payment(self, session):
        from django.contrib.auth import get_user_model
        User = get_user_model()

        metadata = _safe_stripe_dict(session.metadata) if hasattr(session, 'metadata') else {}
        user_id = metadata.get('user_id')
        plan_id = metadata.get('plan_id')
        billing_cycle = metadata.get('billing_cycle', 'monthly')

        if not user_id or not plan_id:
            return

        try:
            user = User.objects.get(id=int(user_id))
            plan = SubscriptionPlan.objects.get(id=int(plan_id))
        except (User.DoesNotExist, SubscriptionPlan.DoesNotExist):
            return

        expires_at = (timezone.now() + timedelta(days=30)
                      if billing_cycle == 'monthly'
                      else timezone.now() + timedelta(days=365))

        subscription, _ = Subscription.objects.update_or_create(
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

        user.subscription_plan = plan.name
        user.subscription_expires = expires_at
        user.save()

        amount = (_safe_stripe_val(session, 'amount_total', 0) or 0) / 100.0
        PaymentHistory.objects.create(
            user=user,
            subscription=subscription,
            amount=amount,
            currency=plan.currency,
            status='completed',
            payment_method='stripe',
            transaction_id=str(_safe_stripe_val(session, 'payment_intent', '')),
            description=f'Stripe payment for {plan.display_name} ({billing_cycle})',
        )

        from apps.accounts.models import Notification
        Notification.objects.create(
            user=user, type='success',
            title='Payment Successful',
            message=f'Your {plan.display_name} subscription is now active!',
        )


class StripeConfigView(APIView):
    """Return the publishable key for frontend (DB only, no .env)"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.admin_dashboard.models import SystemSetting
        pub_key = SystemSetting.get('stripe_publishable_key', '')
        enabled = SystemSetting.get('stripe_enabled', 'false')
        return Response({
            'publishable_key': pub_key,
            'enabled': enabled in ('true', True),
        })


class StripeVerifySessionView(APIView):
    """Verify a Stripe checkout session and activate subscription.
    Called by frontend after returning from Stripe checkout.
    This is the primary activation path (webhooks may not work in dev)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        session_id = request.data.get('session_id', '')
        if not session_id:
            return Response({'error': 'session_id required'}, status=400)

        stripe_mod = get_stripe()
        if not stripe_mod or not stripe_mod.api_key:
            return Response({'error': 'Stripe not configured'}, status=400)

        try:
            session = stripe_mod.checkout.Session.retrieve(session_id)
        except Exception as e:
            logger.error(f"Stripe session retrieve failed: {e}")
            return Response({'error': f'Could not retrieve session: {str(e)}'}, status=400)

        # Verify payment status
        if session.payment_status != 'paid':
            return Response({
                'error': 'Payment not completed',
                'payment_status': session.payment_status,
            }, status=400)

        # Safely extract metadata from Stripe session (v15 StripeObject)
        metadata = _safe_stripe_dict(session.metadata) if hasattr(session, 'metadata') else {}
        session_user_id = metadata.get('user_id', '')
        if str(request.user.id) != str(session_user_id):
            logger.warning(f"Session user mismatch: session={session_user_id}, request={request.user.id}")
            return Response({'error': 'Session does not belong to this user'}, status=403)

        # Extract plan info
        plan_id = metadata.get('plan_id')
        billing_cycle = metadata.get('billing_cycle', 'monthly')

        if not plan_id:
            return Response({'error': 'No plan_id in session metadata'}, status=400)

        try:
            plan = SubscriptionPlan.objects.get(id=int(plan_id))
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Invalid plan'}, status=400)

        # Get transaction_id safely
        pi = _safe_stripe_val(session, 'payment_intent', '')
        if hasattr(pi, 'id'):
            transaction_id = pi.id
        else:
            transaction_id = str(pi) if pi else ''

        # Duplicate check — if payment already recorded for this transaction, return success
        if transaction_id:
            existing_payment = PaymentHistory.objects.filter(
                transaction_id=transaction_id, status='completed'
            ).first()
            if existing_payment and existing_payment.subscription:
                logger.info(f"Duplicate verify for transaction {transaction_id}, returning existing subscription")
                from apps.subscriptions.serializers import SubscriptionSerializer
                return Response({
                    'message': 'Subscription already activated',
                    'subscription': SubscriptionSerializer(existing_payment.subscription).data,
                })

        try:
            expires_at = (timezone.now() + timedelta(days=30)
                          if billing_cycle == 'monthly'
                          else timezone.now() + timedelta(days=365))

            subscription, _ = Subscription.objects.update_or_create(
                user=request.user,
                defaults={
                    'plan': plan,
                    'status': 'active',
                    'billing_cycle': billing_cycle,
                    'expires_at': expires_at,
                    'next_billing_date': expires_at,
                    'last_payment_date': timezone.now(),
                }
            )

            request.user.subscription_plan = plan.name
            request.user.subscription_expires = expires_at
            request.user.save(update_fields=['subscription_plan', 'subscription_expires'])

            # Sync company plan
            company_info = None
            try:
                if hasattr(request.user, 'company_ref') and request.user.company_ref:
                    from apps.admin_dashboard.models import PLAN_LIMITS
                    company = request.user.company_ref
                    company.plan = plan.name
                    limits = PLAN_LIMITS.get(plan.name, PLAN_LIMITS.get('free', {}))
                    if limits:
                        company.max_brands = limits.get('max_brands', company.max_brands)
                        company.max_users = limits.get('max_users', company.max_users)
                        company.save(update_fields=['plan', 'max_brands', 'max_users'])
                    company_info = {
                        'id': company.id,
                        'name': company.name,
                        'plan': company.plan,
                        'status': company.status,
                        'is_owner': company.owner_id == request.user.id,
                        'brands_used': getattr(company, 'brands_count', 0),
                        'brands_limit': limits.get('max_brands', 0),
                        'users_used': getattr(company, 'users_count', 0),
                        'users_limit': limits.get('max_users', 0),
                    }
            except Exception as ce:
                logger.warning(f"Company sync failed (non-critical): {ce}")

            # Record payment
            amount = (_safe_stripe_val(session, 'amount_total', 0) or 0) / 100.0
            PaymentHistory.objects.create(
                user=request.user,
                subscription=subscription,
                amount=amount,
                currency=plan.currency,
                status='completed',
                payment_method='stripe',
                transaction_id=transaction_id,
                description=f'Stripe payment for {plan.display_name} ({billing_cycle})',
            )

            # Create notification
            try:
                from apps.accounts.models import Notification
                Notification.objects.create(
                    user=request.user, type='success',
                    title='Payment Successful',
                    message=f'Your {plan.display_name} subscription is now active!',
                )
            except Exception:
                pass

            logger.info(f"Subscription activated for user {request.user.id}: {plan.display_name}")

            from apps.subscriptions.serializers import SubscriptionSerializer
            return Response({
                'message': f'Subscription activated: {plan.display_name}',
                'subscription': SubscriptionSerializer(subscription).data,
                'company_info': company_info,
            })

        except Exception as e:
            logger.error(f"Subscription activation failed for user {request.user.id}: {e}", exc_info=True)
            return Response({
                'error': f'Activation failed: {str(e)}',
                'detail': 'Payment was received. Please contact support if your plan is not updated.',
            }, status=500)

