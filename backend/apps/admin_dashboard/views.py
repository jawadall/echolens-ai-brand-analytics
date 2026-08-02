"""
Admin Dashboard Views
System statistics, user management, SMTP/SMS settings, notification management, Stripe config
"""
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Count, Avg, Q, Sum
from django.db.models.functions import TruncDate, TruncMonth
from datetime import timedelta
import json


def _mask_sensitive_value(val: str) -> str:
    """Mask a sensitive value with partial reveal: first 4 + bullets + last 4"""
    if not val:
        return ''
    if len(val) <= 8:
        return '••••••••'
    # Show first 4 and last 4, fill middle with bullets matching original length
    middle_len = len(val) - 8
    return val[:4] + '•' * middle_len + val[-4:]


def _is_masked_value(val: str) -> bool:
    """Check if a value is a masked placeholder (should not be saved)"""
    if not val:
        return False
    return '••••' in val or '****' in val


from apps.brands.models import Brand, SocialPost, BrandAlert
from apps.accounts.models import Notification, UserActivity
from apps.subscriptions.models import Subscription, PaymentHistory
from apps.exports.models import ExportJob
from .models import SystemSetting, AuditLog, Company, PLAN_LIMITS, PLAN_DISPLAY_NAMES

User = get_user_model()


class IsAdminUser(permissions.BasePermission):
    """Only allow admin users"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_staff or request.user.role == 'admin'
        )


# ─── SYSTEM OVERVIEW ─────────────────────────────────────────────
class AdminDashboardView(APIView):
    """Main admin dashboard with system-wide statistics"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        now = timezone.now()
        last_30 = now - timedelta(days=30)
        last_7 = now - timedelta(days=7)

        # User stats
        total_users = User.objects.count()
        new_users_30d = User.objects.filter(date_joined__gte=last_30).count()
        active_users_7d = User.objects.filter(last_activity__gte=last_7).count()

        # Brand stats
        total_brands = Brand.objects.count()
        active_brands = Brand.objects.filter(status='active').count()

        # Post stats
        total_posts = SocialPost.objects.count()
        posts_30d = SocialPost.objects.filter(fetched_at__gte=last_30).count()
        processed_posts = SocialPost.objects.filter(is_processed=True).count()

        # Alert stats
        total_alerts = BrandAlert.objects.count()
        unresolved_alerts = BrandAlert.objects.filter(is_resolved=False).count()

        # Sentiment overview
        avg_sentiment = SocialPost.objects.filter(
            is_processed=True
        ).aggregate(avg=Avg('sentiment_score'))['avg'] or 0

        sentiment_dist = {
            'positive': SocialPost.objects.filter(sentiment='positive').count(),
            'neutral': SocialPost.objects.filter(sentiment='neutral').count(),
            'negative': SocialPost.objects.filter(sentiment='negative').count(),
        }

        # Platform distribution
        platform_dist = list(
            SocialPost.objects.values('platform')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        # Subscription stats
        subscriptions = {
            'active': Subscription.objects.filter(status='active').count(),
            'cancelled': Subscription.objects.filter(status='cancelled').count(),
            'total_revenue': float(
                PaymentHistory.objects.filter(status='completed')
                .aggregate(total=Sum('amount'))['total'] or 0
            ),
        }

        # Recent user signups (chart data)
        signups_chart = list(
            User.objects.filter(date_joined__gte=last_30)
            .annotate(date=TruncDate('date_joined'))
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )

        # Recent posts (chart data)
        posts_chart = list(
            SocialPost.objects.filter(fetched_at__gte=last_30)
            .annotate(date=TruncDate('fetched_at'))
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )

        return Response({
            'users': {
                'total': total_users,
                'new_30d': new_users_30d,
                'active_7d': active_users_7d,
            },
            'brands': {
                'total': total_brands,
                'active': active_brands,
            },
            'posts': {
                'total': total_posts,
                'last_30d': posts_30d,
                'processed': processed_posts,
            },
            'alerts': {
                'total': total_alerts,
                'unresolved': unresolved_alerts,
            },
            'sentiment': {
                'average': round(avg_sentiment, 4),
                'distribution': sentiment_dist,
            },
            'platforms': platform_dist,
            'subscriptions': subscriptions,
            'charts': {
                'signups': [{'date': s['date'].isoformat(), 'count': s['count']}
                            for s in signups_chart],
                'posts': [{'date': p['date'].isoformat(), 'count': p['count']}
                          for p in posts_chart],
            },
        })


# ─── USER MANAGEMENT ─────────────────────────────────────────────
class AdminUserListView(APIView):
    """List and manage all users"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        users = User.objects.all().order_by('-date_joined')
        search = request.query_params.get('search', '')
        if search:
            users = users.filter(
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )

        data = []
        for u in users[:100]:
            data.append({
                'id': u.id,
                'email': u.email,
                'full_name': u.full_name,
                'role': u.role,
                'is_active': u.is_active,
                'is_staff': u.is_staff,
                'is_superuser': u.is_superuser,
                'subscription_plan': u.subscription_plan,
                'company_id': u.company_ref_id,
                'company_name': u.company_ref.name if u.company_ref else None,
                'company_plan': u.company_ref.plan if u.company_ref else None,
                'brands_count': u.company_ref.brands.count() if u.company_ref else u.brands.count(),
                'login_count': u.login_count,
                'last_activity': u.last_activity,
                'date_joined': u.date_joined,
            })
        return Response({'users': data, 'total': users.count()})


class AdminUserActionView(APIView):
    """Activate/deactivate/promote users"""
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            target = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        action = request.data.get('action')
        if action == 'activate':
            target.is_active = True
            target.save(update_fields=['is_active'])
        elif action == 'deactivate':
            target.is_active = False
            target.save(update_fields=['is_active'])
        elif action == 'make_superadmin':
            target.role = 'admin'
            target.is_staff = True
            target.is_superuser = True
            target.save(update_fields=['role', 'is_staff', 'is_superuser'])
        elif action == 'make_admin':
            target.role = 'admin'
            # Don't touch is_staff — admin is a business role, not platform staff
            target.save(update_fields=['role'])
        elif action == 'make_analyst':
            target.role = 'analyst'
            target.is_staff = False
            target.is_superuser = False
            target.save(update_fields=['role', 'is_staff', 'is_superuser'])
        elif action == 'make_viewer':
            target.role = 'viewer'
            target.is_staff = False
            target.is_superuser = False
            target.save(update_fields=['role', 'is_staff', 'is_superuser'])
        elif action == 'remove_superadmin':
            target.is_staff = False
            target.is_superuser = False
            target.save(update_fields=['is_staff', 'is_superuser'])
        else:
            return Response({'error': 'Invalid action'}, status=400)

        AuditLog.objects.create(
            user=request.user, action='user_action', target=f'User:{target.email}',
            description=f'{action} on user {target.email}',
            metadata={'target_id': pk, 'action': action}
        )
        return Response({'message': f'User {action} successfully'})


# ─── SYSTEM SETTINGS ─────────────────────────────────────────────
class SystemSettingsView(APIView):
    """Get/update system settings by category"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        category = request.query_params.get('category', '')
        qs = SystemSetting.objects.all()
        if category:
            qs = qs.filter(category=category)

        data = []
        for s in qs:
            val = s.value
            if s.is_sensitive and val:
                val = val[:4] + '****' + val[-4:] if len(val) > 8 else '****'
            data.append({
                'id': s.id, 'key': s.key, 'value': val,
                'value_type': s.value_type, 'category': s.category,
                'description': s.description, 'is_sensitive': s.is_sensitive,
                'updated_at': s.updated_at,
            })
        return Response({'settings': data})

    def post(self, request):
        settings_data = request.data.get('settings', [])
        updated = []
        for item in settings_data:
            key = item.get('key')
            if not key:
                continue
            obj = SystemSetting.set(
                key=key, value=item.get('value', ''),
                category=item.get('category', 'general'),
                description=item.get('description', ''),
                value_type=item.get('value_type', 'string'),
                is_sensitive=item.get('is_sensitive', False),
                user=request.user,
            )
            updated.append(key)

        AuditLog.objects.create(
            user=request.user, action='setting_change',
            target='SystemSettings',
            description=f'Updated settings: {", ".join(updated)}',
            metadata={'keys': updated}
        )
        return Response({'message': f'Updated {len(updated)} settings', 'keys': updated})


# ─── SMTP SETTINGS ───────────────────────────────────────────────
class SMTPSettingsView(APIView):
    """Manage SMTP email settings"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response({
            'smtp_host': SystemSetting.get('smtp_host', 'smtp.gmail.com'),
            'smtp_port': SystemSetting.get('smtp_port', '587'),
            'smtp_username': SystemSetting.get('smtp_username', ''),
            'smtp_password': SystemSetting.get('smtp_password', ''),
            'smtp_use_tls': SystemSetting.get('smtp_use_tls', 'true'),
            'smtp_from_email': SystemSetting.get('smtp_from_email', ''),
            'smtp_from_name': SystemSetting.get('smtp_from_name', 'Echo Lens'),
            'smtp_enabled': SystemSetting.get('smtp_enabled', 'false'),
        })

    def post(self, request):
        fields = ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_from_email',
                   'smtp_from_name', 'smtp_use_tls', 'smtp_enabled']
        for f in fields:
            if f in request.data:
                SystemSetting.set(f, request.data[f], category='smtp',
                                  description=f'SMTP {f}', user=request.user)

        if 'smtp_password' in request.data and not _is_masked_value(request.data['smtp_password']):
            SystemSetting.set('smtp_password', request.data['smtp_password'],
                              category='smtp', is_sensitive=True, user=request.user)

        AuditLog.objects.create(
            user=request.user, action='setting_change', target='SMTP',
            description='Updated SMTP settings'
        )
        return Response({'message': 'SMTP settings updated'})


class SMTPTestView(APIView):
    """Send a test email via configured SMTP — uses send_echolens_email"""
    permission_classes = [IsAdminUser]

    def post(self, request):
        to_email = request.data.get('to_email', request.user.email)
        try:
            from apps.accounts.emails import send_smtp_test_email
            result = send_smtp_test_email(to_email)
            if result is False:
                return Response({
                    'error': 'SMTP is disabled or credentials are missing. Please save your SMTP settings first.'
                }, status=400)
            return Response({'message': f'Test email sent successfully to {to_email}'})
        except Exception as e:
            return Response({'error': f'SMTP test failed: {str(e)}'}, status=400)


# ─── SMS SETTINGS ────────────────────────────────────────────────
class SMSSettingsView(APIView):
    """Manage SMS notification settings"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response({
            'sms_provider': SystemSetting.get('sms_provider', 'twilio'),
            'sms_account_sid': SystemSetting.get('sms_account_sid', ''),
            'sms_auth_token': SystemSetting.get('sms_auth_token', ''),
            'sms_from_number': SystemSetting.get('sms_from_number', ''),
            'sms_enabled': SystemSetting.get('sms_enabled', 'false'),
        })

    def post(self, request):
        fields = ['sms_provider', 'sms_account_sid', 'sms_from_number', 'sms_enabled']
        for f in fields:
            if f in request.data:
                SystemSetting.set(f, request.data[f], category='sms',
                                  description=f'SMS {f}', user=request.user)

        if 'sms_auth_token' in request.data and not _is_masked_value(request.data['sms_auth_token']):
            SystemSetting.set('sms_auth_token', request.data['sms_auth_token'],
                              category='sms', is_sensitive=True, user=request.user)

        AuditLog.objects.create(
            user=request.user, action='setting_change', target='SMS',
            description='Updated SMS settings'
        )
        return Response({'message': 'SMS settings updated'})


# ─── STRIPE SETTINGS ────────────────────────────────────────────
class StripeSettingsView(APIView):
    """Manage Stripe payment settings"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response({
            'stripe_enabled': SystemSetting.get('stripe_enabled', 'false'),
            'stripe_publishable_key': SystemSetting.get('stripe_publishable_key', ''),
            'stripe_secret_key': SystemSetting.get('stripe_secret_key', ''),
            'stripe_webhook_secret': SystemSetting.get('stripe_webhook_secret', ''),
            'stripe_currency': SystemSetting.get('stripe_currency', 'usd'),
        })

    def post(self, request):
        fields = ['stripe_enabled', 'stripe_publishable_key', 'stripe_currency']
        for f in fields:
            if f in request.data:
                SystemSetting.set(f, request.data[f], category='stripe',
                                  description=f'Stripe {f}', user=request.user)

        for sensitive in ['stripe_secret_key', 'stripe_webhook_secret']:
            if sensitive in request.data and not _is_masked_value(request.data[sensitive]):
                SystemSetting.set(sensitive, request.data[sensitive],
                                  category='stripe', is_sensitive=True, user=request.user)

        AuditLog.objects.create(
            user=request.user, action='setting_change', target='Stripe',
            description='Updated Stripe settings'
        )
        return Response({'message': 'Stripe settings updated'})


# ─── PLATFORM API KEYS ──────────────────────────────────────────
class PlatformAPIKeysView(APIView):
    """Manage global platform API keys used as defaults for all companies"""
    permission_classes = [IsAdminUser]

    PLATFORM_KEYS = [
        'youtube_api_key',
        'reddit_client_id', 'reddit_client_secret', 'reddit_user_agent',
        'twitter_bearer_token',
        'facebook_access_token',
        'news_api_key',
        'gemini_api_key',
    ]

    SENSITIVE_KEYS = [
        'youtube_api_key', 'reddit_client_secret', 'twitter_bearer_token',
        'facebook_access_token', 'news_api_key', 'gemini_api_key',
    ]

    def get(self, request):
        data = {}
        for key in self.PLATFORM_KEYS:
            data[key] = SystemSetting.get(key, '')
        # Also include enabled states
        for platform in ['youtube', 'reddit', 'twitter', 'facebook', 'news', 'gemini']:
            data[f'{platform}_enabled'] = SystemSetting.get(f'{platform}_enabled', 'true')
        return Response(data)

    def post(self, request):
        for key in self.PLATFORM_KEYS:
            if key in request.data:
                val = request.data[key]
                if _is_masked_value(str(val)):
                    continue  # Skip masked values
                is_sensitive = key in self.SENSITIVE_KEYS
                SystemSetting.set(key, val, category='platform_api',
                                  description=f'Platform API: {key}',
                                  is_sensitive=is_sensitive, user=request.user)

        # Save enabled states
        for platform in ['youtube', 'reddit', 'twitter', 'facebook', 'news', 'gemini']:
            enabled_key = f'{platform}_enabled'
            if enabled_key in request.data:
                SystemSetting.set(enabled_key, request.data[enabled_key],
                                  category='platform_api',
                                  description=f'{platform} API enabled',
                                  user=request.user)

        AuditLog.objects.create(
            user=request.user, action='setting_change', target='Platform API Keys',
            description='Updated platform API keys'
        )
        return Response({'message': 'Platform API keys updated'})


class PlatformAPITestView(APIView):
    """Test a platform API connection and store the result"""
    permission_classes = [IsAdminUser]

    # Map platform id to the primary DB key name
    KEY_MAP = {
        'youtube': 'youtube_api_key',
        'reddit': 'reddit_client_id',
        'twitter': 'twitter_bearer_token',
        'facebook': 'facebook_access_token',
        'news': 'news_api_key',
        'gemini': 'gemini_api_key',
    }

    def post(self, request):
        platform = request.data.get('platform', '')
        api_key = request.data.get('api_key', '')
        valid_platforms = ['youtube', 'reddit', 'twitter', 'facebook', 'news', 'gemini']

        if platform not in valid_platforms:
            return Response({'error': f'Unknown platform: {platform}'}, status=400)

        # If the key is masked (contains bullets), resolve the real key from DB
        if not api_key or '•' in api_key or '****' in api_key:
            db_key_name = self.KEY_MAP.get(platform, '')
            if db_key_name:
                api_key = SystemSetting.get(db_key_name, '')

        if not api_key or len(api_key.strip()) < 5:
            return Response({
                'status': 'error',
                'platform': platform,
                'message': f'No API key configured for {platform}. Please save a key first.',
            }, status=400)

        from apps.data_connectors.api_key_resolver import test_platform_connection

        result = test_platform_connection(platform, api_key.strip())

        # Store the connection status in DB so it persists
        import json
        status_val = 'online' if result.get('status') == 'success' else 'offline'
        SystemSetting.set(
            f'{platform}_connection_status',
            json.dumps({
                'status': status_val,
                'message': result.get('message', ''),
                'tested_at': timezone.now().isoformat(),
                'latency_ms': result.get('latency_ms', 0),
            }),
            category='platform_status',
            description=f'{platform} connection status',
            user=request.user,
        )

        if result.get('status') == 'error':
            return Response(result, status=400)
        return Response(result)

class PlatformStatusView(APIView):
    """Return detailed status for each platform including connection test results"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        import json
        from apps.data_connectors.api_key_resolver import resolve_platform_mode

        status_map = {}
        for platform in ['youtube', 'reddit', 'twitter', 'facebook', 'news', 'gemini']:
            enabled = SystemSetting.get(f'{platform}_enabled', 'true').lower() == 'true'
            mode, key = resolve_platform_mode(platform)
            has_key = mode != 'disabled'

            # Check stored connection status from last test
            conn_status_raw = SystemSetting.get(f'{platform}_connection_status', '')
            conn_info = None
            if conn_status_raw:
                try:
                    conn_info = json.loads(conn_status_raw)
                except Exception:
                    pass

            # Platform is online if: enabled + has key + (no test yet OR last test passed)
            if conn_info and conn_info.get('status') == 'offline':
                is_online = False
            else:
                is_online = enabled and has_key

            status_map[platform] = {
                'online': is_online,
                'enabled': enabled,
                'has_key': has_key,
                'mode': mode,
                'connection_status': conn_info.get('status', 'untested') if conn_info else 'untested',
                'last_tested': conn_info.get('tested_at', '') if conn_info else '',
                'last_message': conn_info.get('message', '') if conn_info else '',
                'latency_ms': conn_info.get('latency_ms', 0) if conn_info else 0,
            }

        return Response(status_map)


# ─── NOTIFICATION MANAGEMENT ────────────────────────────────────
class AdminNotificationListView(APIView):
    """Admin: view all notifications across all users"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        notifications = Notification.objects.select_related('user').order_by('-created_at')[:100]
        data = [{
            'id': n.id,
            'user_email': n.user.email,
            'type': n.type,
            'title': n.title,
            'message': n.message,
            'is_read': n.is_read,
            'created_at': n.created_at,
        } for n in notifications]
        return Response({
            'notifications': data,
            'total': Notification.objects.count(),
            'unread': Notification.objects.filter(is_read=False).count(),
        })


class AdminSendNotificationView(APIView):
    """Admin: send notification to specific users or broadcast"""
    permission_classes = [IsAdminUser]

    def post(self, request):
        title = request.data.get('title', '')
        message = request.data.get('message', '')
        ntype = request.data.get('type', 'info')
        target = request.data.get('target', 'all')  # 'all' or user_id list
        user_ids = request.data.get('user_ids', [])

        if not title or not message:
            return Response({'error': 'Title and message required'}, status=400)

        if target == 'all':
            users = User.objects.filter(is_active=True)
        else:
            users = User.objects.filter(id__in=user_ids)

        created = 0
        for user in users:
            Notification.objects.create(user=user, type=ntype, title=title, message=message)
            created += 1

        AuditLog.objects.create(
            user=request.user, action='notification_sent', target='Notification',
            description=f'Sent "{title}" to {created} users',
            metadata={'type': ntype, 'target': target, 'count': created}
        )
        return Response({'message': f'Notification sent to {created} users'})


class AdminDeleteNotificationsView(APIView):
    """Admin: delete notifications"""
    permission_classes = [IsAdminUser]

    def post(self, request):
        ids = request.data.get('ids', [])
        if ids:
            deleted, _ = Notification.objects.filter(id__in=ids).delete()
        else:
            return Response({'error': 'No notification IDs provided'}, status=400)
        return Response({'message': f'Deleted {deleted} notifications'})


# ─── AUDIT LOG ───────────────────────────────────────────────────
class AuditLogView(APIView):
    """View audit logs"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        logs = AuditLog.objects.select_related('user').order_by('-created_at')[:100]
        data = [{
            'id': l.id,
            'user': l.user.email if l.user else 'System',
            'action': l.action,
            'target': l.target,
            'description': l.description,
            'created_at': l.created_at,
        } for l in logs]
        return Response({'logs': data})


# ─── COMPANY MANAGEMENT ─────────────────────────────────────────
class CompanyListView(APIView):
    """List all companies or create a new one"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        companies = Company.objects.select_related('owner').all()
        search = request.query_params.get('search', '')
        if search:
            companies = companies.filter(
                Q(name__icontains=search) | Q(industry__icontains=search)
            )

        data = []
        for c in companies:
            data.append({
                'id': c.id,
                'name': c.name,
                'industry': c.industry,
                'website': c.website,
                'logo': c.logo,
                'plan': c.plan,
                'status': c.status,
                'max_brands': c.max_brands,
                'max_users': c.max_users,
                'brands_count': c.brands_count,
                'users_count': c.users_count,
                'owner': {
                    'id': c.owner.id,
                    'email': c.owner.email,
                    'full_name': c.owner.full_name,
                } if c.owner else None,
                'created_at': c.created_at,
                'updated_at': c.updated_at,
            })

        return Response({'companies': data, 'total': companies.count()})

    def post(self, request):
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'error': 'Business name is required'}, status=400)

        owner_id = request.data.get('owner_id')
        owner = None
        if owner_id:
            try:
                owner = User.objects.get(id=owner_id)
            except User.DoesNotExist:
                return Response({'error': 'Owner user not found'}, status=404)

        plan = request.data.get('plan', 'free')
        limits = PLAN_LIMITS.get(plan, PLAN_LIMITS['free'])

        company = Company.objects.create(
            name=name,
            industry=request.data.get('industry', ''),
            website=request.data.get('website', ''),
            logo=request.data.get('logo', ''),
            plan=plan,
            max_brands=limits.get('max_brands', 1),
            max_users=limits.get('max_users', 2),
            owner=owner or request.user,
        )

        # Auto-associate the owner/requesting user with the new business
        assign_user = owner or request.user
        if not assign_user.company_ref_id:
            assign_user.company_ref = company
            if assign_user.role != 'admin':
                assign_user.role = 'admin'
            assign_user.save(update_fields=['company_ref', 'role'])

        AuditLog.objects.create(
            user=request.user, action='system', target=f'Company:{company.name}',
            description=f'Created business "{company.name}"',
            metadata={'company_id': company.id}
        )

        return Response({
            'message': f'Business "{company.name}" created',
            'company': {'id': company.id, 'name': company.name},
        }, status=201)


class CompanyDetailView(APIView):
    """Get, update, or delete a specific company"""
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            c = Company.objects.select_related('owner').get(id=pk)
        except Company.DoesNotExist:
            return Response({'error': 'Company not found'}, status=404)

        return Response({
            'id': c.id,
            'name': c.name,
            'industry': c.industry,
            'website': c.website,
            'logo': c.logo,
            'plan': c.plan,
            'status': c.status,
            'max_brands': c.max_brands,
            'max_users': c.max_users,
            'brands_count': c.brands_count,
            'users_count': c.users_count,
            'owner': {
                'id': c.owner.id,
                'email': c.owner.email,
                'full_name': c.owner.full_name,
            } if c.owner else None,
            'metadata': c.metadata,
            'created_at': c.created_at,
            'updated_at': c.updated_at,
        })

    def put(self, request, pk):
        try:
            company = Company.objects.get(id=pk)
        except Company.DoesNotExist:
            return Response({'error': 'Company not found'}, status=404)

        for field in ['name', 'industry', 'website', 'logo', 'plan', 'status',
                      'max_brands', 'max_users']:
            if field in request.data:
                setattr(company, field, request.data[field])

        if 'owner_id' in request.data:
            try:
                company.owner = User.objects.get(id=request.data['owner_id'])
            except User.DoesNotExist:
                return Response({'error': 'Owner user not found'}, status=404)

        company.save()

        AuditLog.objects.create(
            user=request.user, action='system', target=f'Company:{company.name}',
            description=f'Updated company "{company.name}"',
            metadata={'company_id': company.id, 'fields': list(request.data.keys())}
        )

        return Response({'message': f'Company "{company.name}" updated'})

    def delete(self, request, pk):
        try:
            company = Company.objects.get(id=pk)
        except Company.DoesNotExist:
            return Response({'error': 'Company not found'}, status=404)

        name = company.name
        company.delete()

        AuditLog.objects.create(
            user=request.user, action='system', target=f'Company:{name}',
            description=f'Deleted company "{name}"',
            metadata={'company_id': pk}
        )

        return Response({'message': f'Company "{name}" deleted'})


# ─── COMPANY USER MANAGEMENT ────────────────────────────────────
class IsCompanyAdminOrSuperAdmin(permissions.BasePermission):
    """Allow company admins (for their own company) or super admins"""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        # Super admin
        if request.user.is_staff or request.user.is_superuser:
            return True
        # Company admin
        if request.user.role == 'admin' and request.user.company_ref:
            return True
        return False


class CompanyUsersView(APIView):
    """List all users in a company"""
    permission_classes = [IsCompanyAdminOrSuperAdmin]

    def get(self, request, pk):
        try:
            company = Company.objects.get(id=pk)
        except Company.DoesNotExist:
            return Response({'error': 'Company not found'}, status=404)

        # Company admins can only see their own company
        if not (request.user.is_staff or request.user.is_superuser):
            if request.user.company_ref_id != pk:
                return Response({'error': 'Access denied'}, status=403)

        users = User.objects.filter(company_ref=company).order_by('-date_joined')
        limits = company.get_plan_limits()

        data = [{
            'id': u.id,
            'email': u.email,
            'full_name': u.full_name,
            'role': u.role,
            'is_active': u.is_active,
            'is_owner': company.owner_id == u.id,
            'invite_pending': (u.preferences or {}).get('invite_pending', False),
            'brands_count': u.brands.count() if hasattr(u, 'brands') else 0,
            'last_activity': u.last_activity,
            'date_joined': u.date_joined,
        } for u in users]

        return Response({
            'users': data,
            'total': len(data),
            'limits': {
                'max_users': limits['max_users'],
                'max_brands': limits['max_brands'],
                'current_users': len(data),
                'current_brands': company.brands_count,
            },
            'company': {
                'id': company.id,
                'name': company.name,
                'plan': company.plan,
            },
        })


class CompanyInviteUserView(APIView):
    """Create/invite a new user into a company"""
    permission_classes = [IsCompanyAdminOrSuperAdmin]

    def post(self, request, pk):
        try:
            company = Company.objects.get(id=pk)
        except Company.DoesNotExist:
            return Response({'error': 'Company not found'}, status=404)

        # Company admins can only manage their own company
        if not (request.user.is_staff or request.user.is_superuser):
            if request.user.company_ref_id != pk:
                return Response({'error': 'Access denied'}, status=403)

        # Check user limit
        if not company.can_add_user():
            limits = company.get_plan_limits()
            return Response({
                'error': 'User limit reached',
                'message': f'Your {company.plan.title()} plan allows a maximum of '
                           f'{limits["max_users"]} users. Please upgrade to add more.',
                'limit': limits['max_users'],
                'current': company.users_count,
                'plan': company.plan,
            }, status=403)

        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': 'Email is required'}, status=400)

        # Check if user already exists
        existing = User.objects.filter(email=email).first()
        if existing:
            if existing.company_ref_id == pk:
                return Response({'error': 'User is already a member of this company'}, status=400)
            # Move existing user to this company
            existing.company_ref = company
            existing.company = company.name
            existing.save(update_fields=['company_ref', 'company'])
            return Response({'message': f'{email} added to {company.name}'})

        # Create new user
        first_name = request.data.get('first_name', email.split('@')[0])
        last_name = request.data.get('last_name', '')
        role = request.data.get('role', 'analyst')
        password = request.data.get('password', '') or 'EchoLens@2026!'

        if role not in ['admin', 'analyst', 'viewer']:
            return Response({'error': 'Invalid role. Must be admin, analyst, or viewer'}, status=400)

        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            company=company.name,
            company_ref=company,
            role=role,
        )

        # Mark as invite pending — status changes to Active on first login
        user.preferences = user.preferences or {}
        user.preferences['invite_pending'] = True
        user.preferences['invited_by'] = request.user.email
        user.save(update_fields=['preferences'])

        # Send invite email with credentials
        try:
            from apps.accounts.emails import send_invite_email
            send_invite_email(
                user=user,
                company_name=company.name,
                role=role,
                password=password,
                invited_by=request.user.full_name or request.user.email,
            )
            email_sent = True
        except Exception as mail_err:
            import logging
            logging.getLogger(__name__).warning(f'Invite email failed: {mail_err}')
            email_sent = False

        AuditLog.objects.create(
            user=request.user, action='user_action',
            target=f'Company:{company.name}',
            description=f'Invited {email} to company as {role}',
            metadata={'company_id': pk, 'user_id': user.id}
        )

        return Response({
            'message': f'User {email} created and added to {company.name}',
            'email_sent': email_sent,
            'user': {'id': user.id, 'email': user.email, 'role': user.role},
        }, status=201)


class CompanyRemoveUserView(APIView):
    """Remove a user from a company"""
    permission_classes = [IsCompanyAdminOrSuperAdmin]

    def post(self, request, pk, user_id):
        try:
            company = Company.objects.get(id=pk)
        except Company.DoesNotExist:
            return Response({'error': 'Company not found'}, status=404)

        if not (request.user.is_staff or request.user.is_superuser):
            if request.user.company_ref_id != pk:
                return Response({'error': 'Access denied'}, status=403)

        try:
            target_user = User.objects.get(id=user_id, company_ref=company)
        except User.DoesNotExist:
            return Response({'error': 'User not found in this company'}, status=404)

        # Cannot remove the owner
        if company.owner_id == target_user.id:
            return Response({'error': 'Cannot remove the company owner'}, status=400)

        target_user.company_ref = None
        target_user.company = ''
        target_user.save(update_fields=['company_ref', 'company'])

        AuditLog.objects.create(
            user=request.user, action='user_action',
            target=f'Company:{company.name}',
            description=f'Removed {target_user.email} from company',
            metadata={'company_id': pk, 'user_id': user_id}
        )

        return Response({'message': f'{target_user.email} removed from {company.name}'})


class CompanyUsageView(APIView):
    """Get usage statistics for a company"""
    permission_classes = [IsCompanyAdminOrSuperAdmin]

    def get(self, request, pk):
        try:
            company = Company.objects.get(id=pk)
        except Company.DoesNotExist:
            return Response({'error': 'Company not found'}, status=404)

        if not (request.user.is_staff or request.user.is_superuser):
            if request.user.company_ref_id != pk:
                return Response({'error': 'Access denied'}, status=403)

        usage = company.get_usage()
        features = company.get_features()

        return Response({
            'usage': usage,
            'features': features,
            'plan': {
                'name': company.plan,
                'display_name': PLAN_DISPLAY_NAMES.get(company.plan, company.plan.title()),
            },
            'company': {
                'id': company.id,
                'name': company.name,
                'status': company.status,
            },
        })


class CompanySettingsView(APIView):
    """Get and update company-level settings"""
    permission_classes = [IsCompanyAdminOrSuperAdmin]

    def get(self, request, pk):
        try:
            company = Company.objects.get(id=pk)
        except Company.DoesNotExist:
            return Response({'error': 'Company not found'}, status=404)

        if not (request.user.is_staff or request.user.is_superuser):
            if request.user.company_ref_id != pk:
                return Response({'error': 'Access denied'}, status=403)

        settings_data = company.metadata.get('settings', {})
        return Response({
            'company': {
                'id': company.id,
                'name': company.name,
                'industry': company.industry,
                'website': company.website,
                'plan': company.plan,
            },
            'notifications': settings_data.get('notifications', {
                'email_enabled': True,
                'frequency': 'instant',
                'alert_email': company.owner.email if company.owner else '',
            }),
            'alert_preferences': settings_data.get('alert_preferences', {
                'negative_threshold': -0.3,
                'volume_spike_multiplier': 2.0,
                'auto_resolve_hours': 48,
            }),
            'smtp': settings_data.get('smtp', {
                'host': '',
                'port': 587,
                'username': '',
                'password': '',
                'from_email': '',
                'use_tls': True,
                'use_custom': False,
            }),
            'api_keys': settings_data.get('api_keys', {
                'use_custom_apis': False,
                'platforms': {},
            }),
        })

    def put(self, request, pk):
        try:
            company = Company.objects.get(id=pk)
        except Company.DoesNotExist:
            return Response({'error': 'Company not found'}, status=404)

        if not (request.user.is_staff or request.user.is_superuser):
            if request.user.company_ref_id != pk:
                return Response({'error': 'Access denied'}, status=403)

        data = request.data

        # Update company info fields
        if 'name' in data:
            company.name = data['name']
        if 'industry' in data:
            company.industry = data['industry']
        if 'website' in data:
            company.website = data['website']

        # Update settings in metadata
        settings_data = company.metadata.get('settings', {})
        if 'notifications' in data:
            settings_data['notifications'] = data['notifications']
        if 'alert_preferences' in data:
            settings_data['alert_preferences'] = data['alert_preferences']
        if 'smtp' in data:
            settings_data['smtp'] = data['smtp']
        if 'api_keys' in data:
            settings_data['api_keys'] = data['api_keys']
        company.metadata['settings'] = settings_data
        company.save()

        AuditLog.objects.create(
            user=request.user, action='settings_change',
            target=f'Company:{company.name}',
            description='Company settings updated',
            metadata={'company_id': pk}
        )

        return Response({'message': 'Settings updated successfully'})


class CompanyUpdateUserRoleView(APIView):
    """Update a user's role within a company"""
    permission_classes = [IsCompanyAdminOrSuperAdmin]

    def put(self, request, pk, user_id):
        try:
            company = Company.objects.get(id=pk)
        except Company.DoesNotExist:
            return Response({'error': 'Company not found'}, status=404)

        if not (request.user.is_staff or request.user.is_superuser):
            if request.user.company_ref_id != pk:
                return Response({'error': 'Access denied'}, status=403)

        try:
            target_user = User.objects.get(id=user_id, company_ref=company)
        except User.DoesNotExist:
            return Response({'error': 'User not found in this company'}, status=404)

        new_role = request.data.get('role', '').strip()
        if new_role not in ['admin', 'analyst', 'viewer']:
            return Response({
                'error': 'Invalid role',
                'message': 'Role must be one of: admin, analyst, or viewer.',
            }, status=400)

        # Cannot change the owner's role
        if company.owner_id == target_user.id and new_role != 'admin':
            return Response({
                'error': 'Cannot change owner role',
                'message': 'The company owner must remain an administrator.',
            }, status=400)

        old_role = target_user.role
        target_user.role = new_role
        target_user.save(update_fields=['role'])

        AuditLog.objects.create(
            user=request.user, action='user_action',
            target=f'Company:{company.name}',
            description=f'Changed {target_user.email} role from {old_role} to {new_role}',
            metadata={'company_id': pk, 'user_id': user_id}
        )

        return Response({
            'message': f'{target_user.email} role updated to {new_role}',
            'user': {'id': target_user.id, 'email': target_user.email, 'role': new_role},
        })


# ═══════════════════════════════════════════════════════════════
# SuperAdmin Subscription Management
# ═══════════════════════════════════════════════════════════════

class AdminSubscriptionPlansView(APIView):
    """List and create subscription plans (SuperAdmin only)"""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        from apps.subscriptions.models import SubscriptionPlan, Subscription
        plans = SubscriptionPlan.objects.all().order_by('sort_order', 'price_monthly')
        data = []
        for plan in plans:
            active_subs = Subscription.objects.filter(plan=plan, status='active').count()
            total_subs = Subscription.objects.filter(plan=plan).count()
            # Revenue = active monthly + yearly
            monthly_rev = Subscription.objects.filter(
                plan=plan, status='active', billing_cycle='monthly'
            ).count() * float(plan.price_monthly)
            yearly_rev = Subscription.objects.filter(
                plan=plan, status='active', billing_cycle='yearly'
            ).count() * float(plan.price_yearly) / 12
            data.append({
                'id': plan.id,
                'name': plan.name,
                'display_name': plan.display_name,
                'description': plan.description,
                'price_monthly': str(plan.price_monthly),
                'price_yearly': str(plan.price_yearly),
                'currency': plan.currency,
                'max_brands': plan.max_brands,
                'max_posts_per_month': plan.max_posts_per_month,
                'max_exports_per_month': plan.max_exports_per_month,
                'data_retention_days': plan.data_retention_days,
                'features': plan.features,
                'has_api_access': plan.has_api_access,
                'has_advanced_analytics': plan.has_advanced_analytics,
                'has_competitor_analysis': plan.has_competitor_analysis,
                'has_custom_alerts': plan.has_custom_alerts,
                'has_ai_insights': plan.has_ai_insights,
                'has_priority_support': plan.has_priority_support,
                'is_popular': plan.is_popular,
                'is_active': plan.is_active,
                'sort_order': plan.sort_order,
                'active_subscribers': active_subs,
                'total_subscribers': total_subs,
                'monthly_revenue': round(monthly_rev + yearly_rev, 2),
            })
        return Response(data)

    def post(self, request):
        from apps.subscriptions.models import SubscriptionPlan
        d = request.data
        plan = SubscriptionPlan.objects.create(
            name=d.get('name', '').lower().replace(' ', '_'),
            display_name=d.get('display_name', d.get('name', '')),
            description=d.get('description', ''),
            price_monthly=d.get('price_monthly', 0),
            price_yearly=d.get('price_yearly', 0),
            currency=d.get('currency', 'PKR'),
            max_brands=d.get('max_brands', 1),
            max_posts_per_month=d.get('max_posts_per_month', 1000),
            max_exports_per_month=d.get('max_exports_per_month', 5),
            data_retention_days=d.get('data_retention_days', 30),
            features=d.get('features', []),
            has_api_access=d.get('has_api_access', False),
            has_advanced_analytics=d.get('has_advanced_analytics', False),
            has_competitor_analysis=d.get('has_competitor_analysis', False),
            has_custom_alerts=d.get('has_custom_alerts', False),
            has_ai_insights=d.get('has_ai_insights', False),
            has_priority_support=d.get('has_priority_support', False),
            is_popular=d.get('is_popular', False),
            is_active=d.get('is_active', True),
            sort_order=d.get('sort_order', 0),
        )
        return Response({'id': plan.id, 'message': f'Plan "{plan.display_name}" created'}, status=status.HTTP_201_CREATED)


class AdminSubscriptionPlanDetailView(APIView):
    """Update or delete a subscription plan (SuperAdmin only)"""
    permission_classes = [permissions.IsAdminUser]

    def put(self, request, pk):
        from apps.subscriptions.models import SubscriptionPlan
        try:
            plan = SubscriptionPlan.objects.get(id=pk)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)

        d = request.data
        for field in ['display_name', 'description', 'currency', 'name']:
            if field in d:
                setattr(plan, field, d[field])
        for field in ['price_monthly', 'price_yearly']:
            if field in d:
                setattr(plan, field, d[field])
        for field in ['max_brands', 'max_posts_per_month', 'max_exports_per_month', 'data_retention_days', 'sort_order']:
            if field in d:
                setattr(plan, field, int(d[field]))
        for field in ['has_api_access', 'has_advanced_analytics', 'has_competitor_analysis',
                       'has_custom_alerts', 'has_ai_insights', 'has_priority_support',
                       'is_popular', 'is_active']:
            if field in d:
                setattr(plan, field, bool(d[field]))
        if 'features' in d:
            plan.features = d['features']
        plan.save()
        return Response({'message': f'Plan "{plan.display_name}" updated'})

    def delete(self, request, pk):
        from apps.subscriptions.models import SubscriptionPlan, Subscription
        try:
            plan = SubscriptionPlan.objects.get(id=pk)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)
        if Subscription.objects.filter(plan=plan, status='active').exists():
            return Response({'error': 'Cannot delete a plan with active subscribers'}, status=status.HTTP_400_BAD_REQUEST)
        name = plan.display_name
        plan.delete()
        return Response({'message': f'Plan "{name}" deleted'})


class AdminActiveSubscriptionsView(APIView):
    """List all businesses/companies with their subscription, users, and usage"""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        from apps.admin_dashboard.models import Company
        from apps.brands.models import Brand, SocialPost
        from apps.subscriptions.models import Subscription
        from datetime import timedelta

        companies = Company.objects.prefetch_related('members').order_by('-created_at')

        status_filter = request.query_params.get('status')
        if status_filter:
            companies = companies.filter(status=status_filter)

        month_ago = timezone.now() - timedelta(days=30)
        data = []
        for company in companies[:100]:
            # Get owner / admin subscription
            owner = company.owner
            sub = None
            if owner:
                sub = Subscription.objects.filter(user=owner).select_related('plan').first()

            # Members
            members = []
            for m in company.members.all():
                members.append({
                    'id': m.id,
                    'email': m.email,
                    'first_name': m.first_name,
                    'last_name': m.last_name,
                    'role': m.role,
                    'is_active': m.is_active,
                })

            # Actual usage
            actual_brands = Brand.objects.filter(company=company).count()
            actual_posts = SocialPost.objects.filter(
                brand__company=company, posted_at__gte=month_ago, is_spam=False
            ).count()

            data.append({
                'id': company.id,
                'company_name': company.name,
                'industry': company.industry,
                'plan': company.plan,
                'status': company.status,
                'owner': {
                    'id': owner.id,
                    'email': owner.email,
                    'first_name': owner.first_name,
                    'last_name': owner.last_name,
                } if owner else None,
                'subscription': {
                    'id': sub.id,
                    'plan_display': sub.plan.display_name,
                    'status': sub.status,
                    'billing_cycle': sub.billing_cycle,
                    'started_at': sub.started_at,
                    'expires_at': sub.expires_at,
                    'cancelled_at': sub.cancelled_at,
                } if sub else None,
                'members': members,
                'members_count': len(members),
                'brands_used': actual_brands,
                'posts_this_month': actual_posts,
                'max_brands': company.max_brands,
                'max_users': company.max_users,
                'created_at': company.created_at,
            })
        return Response(data)


class AdminSubscriptionActionView(APIView):
    """Cancel or reactivate a business subscription (by company ID)"""
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, pk):
        from apps.admin_dashboard.models import Company
        from apps.subscriptions.models import Subscription
        try:
            company = Company.objects.get(id=pk)
        except Company.DoesNotExist:
            return Response({'error': 'Business not found'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        if action == 'cancel':
            company.status = 'cancelled'
            company.save(update_fields=['status'])
            # Cancel owner subscription too
            if company.owner:
                Subscription.objects.filter(user=company.owner, status='active').update(
                    status='cancelled', cancelled_at=timezone.now()
                )
            return Response({'message': f'Business "{company.name}" subscription cancelled'})
        elif action == 'reactivate':
            company.status = 'active'
            company.save(update_fields=['status'])
            if company.owner:
                Subscription.objects.filter(user=company.owner, status='cancelled').update(
                    status='active', cancelled_at=None
                )
            return Response({'message': f'Business "{company.name}" subscription reactivated'})
        else:
            return Response({'error': 'Invalid action. Use cancel or reactivate'}, status=status.HTTP_400_BAD_REQUEST)
