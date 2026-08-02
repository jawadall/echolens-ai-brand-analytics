"""
Views for Data Connectors — Real-Time Platform Data
"""
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.brands.models import Brand, FetchLog
from apps.brands.views import get_brand_for_user
from .youtube_connector import youtube_connector
from .reddit_connector import reddit_connector
from .news_connector import news_connector
from .twitter_connector import twitter_connector
from .facebook_connector import facebook_connector
from .tasks import fetch_brand_data, fetch_single_platform


class ConnectorStatusView(APIView):
    """Check status of all data connectors"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .api_key_resolver import resolve_platform_mode

        def _platform_status(platform_id, connector, api_type, note):
            mode, key = resolve_platform_mode(platform_id)
            # Check if platform is enabled in settings
            try:
                from apps.admin_dashboard.models import SystemSetting
                enabled = SystemSetting.get(f'{platform_id}_enabled', 'true').lower() == 'true'
            except Exception:
                enabled = True

            if not enabled:
                return {
                    'available': False,
                    'mode': 'disabled',
                    'type': api_type,
                    'note': f'{platform_id.title()} is disabled in settings',
                }

            if mode == 'disabled':
                return {
                    'available': False,
                    'mode': 'disabled',
                    'type': api_type,
                    'note': f'No API key configured for {platform_id.title()}',
                }

            # Check stored connection test status
            conn_failed = False
            try:
                from apps.admin_dashboard.models import SystemSetting
                import json
                conn_raw = SystemSetting.get(f'{platform_id}_connection_status', '')
                if conn_raw:
                    conn_info = json.loads(conn_raw)
                    if conn_info.get('status') == 'offline':
                        conn_failed = True
            except Exception:
                pass

            available = connector.is_available() if hasattr(connector, 'is_available') else True
            # If last connection test failed, mark as unavailable
            if conn_failed:
                available = False

            return {
                'available': available and enabled,
                'mode': mode,
                'type': api_type,
                'note': note if mode == 'internal' else f'Using real {platform_id.title()} API',
            }

        return Response({
            'youtube': {
                **_platform_status('youtube', youtube_connector, 'API', 'YouTube Data API v3 (free, 10K units/day)'),
                'quota': youtube_connector.get_quota_usage() if youtube_connector.is_available() else None,
            },
            'reddit': _platform_status('reddit', reddit_connector, 'API', 'Reddit API for posts and comments'),
            'twitter': _platform_status('twitter', twitter_connector, 'API + Web Search', 'Twitter API v2 with web search fallback'),
            'news': _platform_status('news', news_connector, 'API', 'NewsAPI for articles and headlines'),
            'facebook': _platform_status('facebook', facebook_connector, 'API + Web Search', 'Facebook Graph API with web search fallback'),
        })


class FetchLiveDataView(APIView):
    """Trigger real-time data fetch for a brand from all platforms"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        brand = get_brand_for_user(pk, request.user)
        if not brand:
            return Response(
                {'error': 'Brand not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Optional: specific platforms only
        platforms = request.data.get('platforms', None)
        if platforms:
            brand.platforms = platforms
            brand.save(update_fields=['platforms'])

        # Ensure default platforms are set
        if not brand.platforms:
            brand.platforms = ['youtube', 'reddit', 'twitter', 'news', 'facebook']
            brand.save(update_fields=['platforms'])

        # Try async first, fall back to synchronous
        try:
            task = fetch_brand_data.delay(brand.id)
            return Response({
                'message': f'Live data fetch started for {brand.name}',
                'task_id': task.id,
                'platforms': brand.platforms,
            })
        except Exception as celery_error:
            # Run synchronously
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Celery not available, running synchronously: {celery_error}")

            result = fetch_brand_data(brand.id)

            return Response({
                'message': result,
                'platforms': brand.platforms,
                'synchronous': True,
            })


class FetchSinglePlatformView(APIView):
    """Fetch data from a single platform"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, platform):
        brand = get_brand_for_user(pk, request.user)
        if not brand:
            return Response(
                {'error': 'Brand not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        valid_platforms = ['youtube', 'reddit', 'twitter', 'news', 'facebook']
        if platform not in valid_platforms:
            return Response(
                {'error': f'Invalid platform. Choose from: {valid_platforms}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            task = fetch_single_platform.delay(brand.id, platform)
            return Response({
                'message': f'{platform.title()} data fetch started for {brand.name}',
                'task_id': task.id,
            })
        except Exception:
            result = fetch_single_platform(brand.id, platform)
            return Response({
                'message': result,
                'synchronous': True,
            })


class FetchLogsView(APIView):
    """Get fetch history for a brand"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        brand = get_brand_for_user(pk, request.user)
        if not brand:
            return Response(
                {'error': 'Brand not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        logs = FetchLog.objects.filter(brand=brand).order_by('-started_at')[:50]
        data = []
        for log in logs:
            data.append({
                'id': log.id,
                'platform': log.platform,
                'status': log.status,
                'posts_fetched': log.posts_fetched,
                'posts_new': log.posts_new,
                'error_message': log.error_message,
                'started_at': log.started_at.isoformat(),
                'completed_at': log.completed_at.isoformat() if log.completed_at else None,
            })

        return Response({'logs': data})


class RedditSearchPreviewView(APIView):
    """Preview Reddit search results"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('query')

        if not query:
            return Response(
                {'error': 'Query parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        posts = reddit_connector.search_posts(
            query=query,
            limit=10,
            time_filter='week'
        )

        return Response({
            'available': True,
            'query': query,
            'results': posts[:10]
        })


# ═══════════════════════════════════════════════════════════════
# Internal pipeline configuration — data source management
# ═══════════════════════════════════════════════════════════════

class _DSConfigView(APIView):
    """
    Manage data-source pipeline tokens.
    GET  → list all configured tokens with account info & usage
    POST → add a new token (duplicate detection)
    """
    permission_classes = [permissions.IsAuthenticated]

    def _require_staff(self, request):
        if not request.user.is_staff:
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def _get_tokens(self):
        from apps.admin_dashboard.models import SystemSetting
        raw = SystemSetting.get('apify_api_tokens', '')
        if not raw:
            return []
        return [t.strip() for t in raw.split(',') if t.strip()]

    def _save_tokens(self, tokens, user=None):
        from apps.admin_dashboard.models import SystemSetting
        SystemSetting.set(
            'apify_api_tokens',
            ','.join(tokens),
            category='general',
            description='Apify API tokens (comma-separated)',
            value_type='string',
            is_sensitive=True,
            user=user,
        )

    def get(self, request):
        denied = self._require_staff(request)
        if denied:
            return denied

        tokens = self._get_tokens()

        # Get fallback setting
        from apps.admin_dashboard.models import SystemSetting
        fallback_enabled = SystemSetting.get('apify_fallback_enabled', 'false')
        if isinstance(fallback_enabled, str):
            fallback_enabled = fallback_enabled.lower() in ('true', '1', 'yes')

        accounts = []
        for i, token in enumerate(tokens):
            acct = {
                'index': i,
                'token_preview': f"...{token[-8:]}" if len(token) > 8 else '***',
                'status': 'unknown',
                'email': '',
                'usage': None,
            }
            # Check token validity + get account info
            try:
                from apify_client import ApifyClient
                import httpx
                client = ApifyClient(token)
                user_info = client.user().get()
                if user_info:
                    acct['status'] = 'active'
                    acct['email'] = user_info.get('email', '')
                    acct['username'] = user_info.get('username', '')
                    acct['plan'] = user_info.get('plan', {}).get('id', 'FREE') if isinstance(user_info.get('plan'), dict) else str(user_info.get('plan', 'FREE'))

                    # Get REAL usage from Apify limits API
                    try:
                        resp = httpx.get(
                            'https://api.apify.com/v2/users/me/limits',
                            headers={'Authorization': f'Bearer {token}'},
                            timeout=10,
                        )
                        if resp.status_code == 200:
                            limits_data = resp.json().get('data', resp.json())
                            current = limits_data.get('current', {})
                            limits = limits_data.get('limits', {})
                            acct['usage'] = {
                                'monthly_usage_usd': round(current.get('monthlyUsageUsd', 0), 4),
                                'monthly_limit_usd': limits.get('maxMonthlyUsageUsd', 5.0),
                            }
                            # Include billing cycle dates
                            cycle = limits_data.get('monthlyUsageCycle', {})
                            if cycle:
                                acct['billing_cycle'] = {
                                    'start': cycle.get('startAt', ''),
                                    'end': cycle.get('endAt', ''),
                                }
                    except Exception:
                        # Fallback: basic estimate
                        acct['usage'] = {
                            'monthly_usage_usd': 0,
                            'monthly_limit_usd': 5.0,
                        }
                else:
                    acct['status'] = 'invalid'
            except ImportError:
                acct['status'] = 'error'
                acct['error'] = 'apify-client not installed'
            except Exception as e:
                acct['status'] = 'error'
                acct['error'] = str(e)[:80]

            accounts.append(acct)

        return Response({
            'total_accounts': len(accounts),
            'active_accounts': sum(1 for a in accounts if a['status'] == 'active'),
            'fallback_enabled': fallback_enabled,
            'accounts': accounts,
        })

    def post(self, request):
        denied = self._require_staff(request)
        if denied:
            return denied

        token = request.data.get('token', '').strip()
        if not token:
            return Response({'detail': 'Token is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Check format
        if not token.startswith('apify_api_'):
            return Response(
                {'detail': 'Invalid token format. Apify tokens start with "apify_api_"'},
                status=status.HTTP_400_BAD_REQUEST
            )

        tokens = self._get_tokens()

        # Duplicate detection
        if token in tokens:
            return Response(
                {'detail': 'This token is already added'},
                status=status.HTTP_409_CONFLICT
            )

        # Validate token
        try:
            from apify_client import ApifyClient
            client = ApifyClient(token)
            user_info = client.user().get()
            if not user_info:
                return Response(
                    {'detail': 'Invalid token — could not authenticate with Apify'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            email = user_info.get('email', 'Unknown')
        except ImportError:
            email = 'apify-client not installed — token saved but not validated'
        except Exception as e:
            return Response(
                {'detail': f'Token validation failed: {str(e)[:100]}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        tokens.append(token)
        self._save_tokens(tokens, user=request.user)

        return Response({
            'detail': f'Token added successfully (account: {email})',
            'total_accounts': len(tokens),
        }, status=status.HTTP_201_CREATED)

    def delete(self, request):
        """Remove a token by index"""
        denied = self._require_staff(request)
        if denied:
            return denied

        index = request.data.get('index')
        if index is None:
            return Response({'detail': 'Index is required'}, status=status.HTTP_400_BAD_REQUEST)

        tokens = self._get_tokens()
        try:
            index = int(index)
            if 0 <= index < len(tokens):
                removed = tokens.pop(index)
                self._save_tokens(tokens, user=request.user)
                return Response({
                    'detail': f'Token ...{removed[-8:]} removed',
                    'total_accounts': len(tokens),
                })
            else:
                return Response({'detail': 'Index out of range'}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({'detail': 'Invalid index'}, status=status.HTTP_400_BAD_REQUEST)


class _DSFallbackToggleView(APIView):
    """Toggle legacy fallback connectors on/off"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not request.user.is_staff:
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        enabled = request.data.get('enabled')
        if enabled is None:
            return Response({'detail': '"enabled" field is required'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.admin_dashboard.models import SystemSetting
        SystemSetting.set(
            'apify_fallback_enabled',
            'true' if enabled else 'false',
            category='general',
            description='Enable legacy fallback connectors when Apify fails',
            value_type='bool',
            user=request.user,
        )

        return Response({
            'detail': f'Fallback {"enabled" if enabled else "disabled"}',
            'fallback_enabled': bool(enabled),
        })


class _ASConfigView(APIView):
    """
    Manage YouTube & Gemini API keys with multi-key rotation.
    GET  → list all configured keys with status
    POST → add a new key
    DELETE → remove a key by platform + index
    """
    permission_classes = [permissions.IsAuthenticated]

    PLATFORMS = {
        'youtube': {
            'prefix': 'AIzaSy',
            'min_length': 30,
            'label': 'YouTube Data API v3',
            'test_fn': '_test_youtube_key',
        },
        'gemini': {
            'prefix': 'AIzaSy',
            'min_length': 30,
            'label': 'Google Gemini AI',
            'test_fn': '_test_gemini_key',
        },
    }

    def _require_staff(self, request):
        if not request.user.is_staff:
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def get(self, request):
        denied = self._require_staff(request)
        if denied:
            return denied

        from .api_key_resolver import get_all_keys

        result = {}
        for platform, cfg in self.PLATFORMS.items():
            keys = get_all_keys(platform)
            accounts = []
            for i, key in enumerate(keys):
                acct = {
                    'index': i,
                    'key_preview': f"...{key[-8:]}" if len(key) > 8 else '***',
                    'status': 'unknown',
                    'detail': '',
                }
                # Test key
                test_fn = getattr(self, cfg['test_fn'], None)
                if test_fn:
                    try:
                        test_result = test_fn(key)
                        acct['status'] = test_result.get('status', 'unknown')
                        acct['detail'] = test_result.get('detail', '')
                        if 'quota' in test_result:
                            acct['quota'] = test_result['quota']
                    except Exception as e:
                        acct['status'] = 'error'
                        acct['detail'] = str(e)[:100]

                accounts.append(acct)

            result[platform] = {
                'label': cfg['label'],
                'total_keys': len(accounts),
                'active_keys': sum(1 for a in accounts if a['status'] == 'active'),
                'accounts': accounts,
            }

        return Response(result)

    def post(self, request):
        denied = self._require_staff(request)
        if denied:
            return denied

        platform = request.data.get('platform', '').strip()
        key = request.data.get('key', '').strip()

        if platform not in self.PLATFORMS:
            return Response(
                {'detail': f'Invalid platform. Must be one of: {", ".join(self.PLATFORMS.keys())}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not key:
            return Response({'detail': 'API key is required'}, status=status.HTTP_400_BAD_REQUEST)

        cfg = self.PLATFORMS[platform]
        if not key.startswith(cfg['prefix']) or len(key) < cfg['min_length']:
            return Response(
                {'detail': f'Invalid key format for {cfg["label"]}. Keys should start with "{cfg["prefix"]}" and be at least {cfg["min_length"]} characters.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from .api_key_resolver import get_all_keys, save_all_keys
        keys = get_all_keys(platform)

        # Duplicate check
        if key in keys:
            return Response({'detail': 'This key is already added'}, status=status.HTTP_409_CONFLICT)

        # Validate key
        test_fn = getattr(self, cfg['test_fn'], None)
        if test_fn:
            try:
                test_result = test_fn(key)
                if test_result.get('status') == 'error':
                    return Response(
                        {'detail': f'Key validation failed: {test_result.get("detail", "unknown error")}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except Exception as e:
                return Response(
                    {'detail': f'Key validation failed: {str(e)[:100]}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        keys.append(key)
        save_all_keys(platform, keys, user=request.user)

        return Response({
            'detail': f'{cfg["label"]} key added successfully',
            'total_keys': len(keys),
        }, status=status.HTTP_201_CREATED)

    def delete(self, request):
        denied = self._require_staff(request)
        if denied:
            return denied

        platform = request.data.get('platform', '').strip()
        index = request.data.get('index')

        if platform not in self.PLATFORMS:
            return Response({'detail': 'Invalid platform'}, status=status.HTTP_400_BAD_REQUEST)
        if index is None:
            return Response({'detail': 'Index is required'}, status=status.HTTP_400_BAD_REQUEST)

        from .api_key_resolver import get_all_keys, save_all_keys
        keys = get_all_keys(platform)

        try:
            index = int(index)
            if 0 <= index < len(keys):
                removed = keys.pop(index)
                save_all_keys(platform, keys, user=request.user)
                return Response({
                    'detail': f'Key ...{removed[-8:]} removed',
                    'total_keys': len(keys),
                })
            else:
                return Response({'detail': 'Index out of range'}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({'detail': 'Invalid index'}, status=status.HTTP_400_BAD_REQUEST)

    # ── Key validation helpers ──────────────────────────────────

    def _test_youtube_key(self, key: str) -> dict:
        """Test a YouTube Data API v3 key."""
        try:
            from googleapiclient.discovery import build
            yt = build('youtube', 'v3', developerKey=key)
            resp = yt.videos().list(part='snippet', chart='mostPopular', maxResults=1).execute()
            quota_info = {'used': 'N/A', 'limit': '10,000 units/day'}
            return {'status': 'active', 'detail': 'YouTube API key valid', 'quota': quota_info}
        except Exception as e:
            err = str(e)
            if 'quotaExceeded' in err or '403' in err:
                return {'status': 'exhausted', 'detail': 'Quota exceeded'}
            if 'forbidden' in err.lower() or 'invalid' in err.lower() or '400' in err:
                return {'status': 'error', 'detail': 'Invalid API key'}
            return {'status': 'error', 'detail': err[:100]}

    def _test_gemini_key(self, key: str) -> dict:
        """Test a Gemini API key (metadata call only — no quota consumed)."""
        try:
            import google.generativeai as genai
            genai.configure(api_key=key)
            models = list(genai.list_models())
            return {
                'status': 'active',
                'detail': f'{len(models)} models available',
                'quota': {'limit': '1,500 RPD (free tier)'},
            }
        except Exception as e:
            err = str(e)
            if '429' in err:
                return {'status': 'exhausted', 'detail': 'Rate limited'}
            return {'status': 'error', 'detail': err[:100]}

