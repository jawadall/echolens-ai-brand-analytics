"""
Views for User Authentication and Management
"""
import logging
import random
import string
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.utils import timezone

from .serializers import (
    CustomTokenObtainPairSerializer,
    UserRegistrationSerializer,
    UserSerializer,
    UserUpdateSerializer,
    ChangePasswordSerializer,
    UserActivitySerializer,
    NotificationSerializer,
    APIKeySerializer
)
from .models import UserActivity, Notification

User = get_user_model()
logger = logging.getLogger(__name__)


def _generate_otp(length=6):
    """Generate a random numeric OTP"""
    return ''.join(random.choices(string.digits, k=length))


def _is_smtp_enabled():
    """Check if SMTP is enabled in SuperAdmin settings"""
    try:
        from apps.admin_dashboard.models import SystemSetting
        return SystemSetting.get('smtp_enabled', 'false').lower() == 'true'
    except Exception:
        return False


class LoginView(TokenObtainPairView):
    """Custom login view with JWT tokens"""
    serializer_class = CustomTokenObtainPairSerializer
    
    def post(self, request, *args, **kwargs):
        # Check if user needs email verification
        email = request.data.get('email', '').lower().strip()
        if email and _is_smtp_enabled():
            try:
                user = User.objects.get(email=email)
                if not user.is_verified:
                    return Response({
                        'detail': 'Please verify your email address before logging in.',
                        'requires_verification': True,
                        'email': email,
                    }, status=status.HTTP_403_FORBIDDEN)
            except User.DoesNotExist:
                pass  # Let the parent handle invalid credentials

        response = super().post(request, *args, **kwargs)
        
        # Log activity
        if response.status_code == 200:
            try:
                user = User.objects.get(email=email)
                UserActivity.objects.create(
                    user=user,
                    action='login',
                    description='User logged in successfully',
                    ip_address=self.get_client_ip(request),
                    user_agent=request.META.get('HTTP_USER_AGENT', '')[:500]
                )
                # Clear invite_pending on first login
                if user.preferences and user.preferences.get('invite_pending'):
                    user.preferences['invite_pending'] = False
                    user.save(update_fields=['preferences'])
            except User.DoesNotExist:
                pass
        
        return response
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class RegisterView(generics.CreateAPIView):
    """User registration endpoint"""
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = UserRegistrationSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        smtp_enabled = _is_smtp_enabled()
        
        if smtp_enabled:
            # Send verification OTP email instead of auto-login
            otp = _generate_otp()
            user.preferences = user.preferences or {}
            user.preferences['email_otp'] = otp
            user.preferences['email_otp_created'] = timezone.now().isoformat()
            user.save(update_fields=['preferences'])
            
            email_sent = False
            try:
                from .emails import send_verification_otp_email
                result = send_verification_otp_email(user, otp)
                email_sent = result is not False
                if email_sent:
                    logger.info(f'Verification OTP sent to {user.email}')
                else:
                    logger.warning(f'Verification OTP not sent to {user.email} (SMTP disabled or failed)')
            except Exception as e:
                logger.error(f'Failed to send verification OTP to {user.email}: {e}')
            
            return Response({
                'message': 'Registration successful! Please check your email for the verification code.',
                'requires_verification': True,
                'email': user.email,
            }, status=status.HTTP_201_CREATED)
        else:
            # No SMTP — auto-verify and auto-login
            user.is_verified = True
            user.save(update_fields=['is_verified'])
            
            # Send welcome email (best effort)
            try:
                from .emails import send_welcome_email
                send_welcome_email(user)
            except Exception:
                pass
            
            refresh = RefreshToken.for_user(user)
            return Response({
                'message': 'Registration successful',
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }, status=status.HTTP_201_CREATED)


class LogoutView(APIView):
    """Logout and blacklist refresh token"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            # Log activity
            UserActivity.objects.create(
                user=request.user,
                action='logout',
                description='User logged out'
            )
            
            return Response({'message': 'Logged out successfully'})
        except Exception as e:
            return Response(
                {'error': 'Invalid token'},
                status=status.HTTP_400_BAD_REQUEST
            )


class UserProfileView(generics.RetrieveUpdateAPIView):
    """Get and update user profile"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserSerializer
    
    def get_object(self):
        return self.request.user
    
    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        
        # Log activity
        UserActivity.objects.create(
            user=request.user,
            action='settings_change',
            description='Profile updated'
        )
        
        return response


class ChangePasswordView(APIView):
    """Change user password"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        
        if not user.check_password(serializer.validated_data['old_password']):
            return Response(
                {'old_password': 'Wrong password'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        
        # Log activity
        UserActivity.objects.create(
            user=user,
            action='settings_change',
            description='Password changed'
        )
        
        return Response({'message': 'Password changed successfully'})


class UserActivityListView(generics.ListAPIView):
    """List user activities"""
    serializer_class = UserActivitySerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return UserActivity.objects.filter(user=self.request.user)[:100]


class NotificationListView(generics.ListAPIView):
    """List user notifications"""
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class NotificationMarkReadView(APIView):
    """Mark notifications as read"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        notification_ids = request.data.get('ids', [])
        
        if notification_ids:
            Notification.objects.filter(
                user=request.user,
                id__in=notification_ids
            ).update(is_read=True)
        else:
            # Mark all as read
            Notification.objects.filter(user=request.user).update(is_read=True)
        
        return Response({'message': 'Notifications marked as read'})


class APIKeyManagementView(APIView):
    """Manage user API keys"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        # Return masked API keys
        api_keys = request.user.api_keys or {}
        masked_keys = {}
        for key, value in api_keys.items():
            if value:
                masked_keys[key] = f"{value[:4]}...{value[-4:]}" if len(value) > 8 else "****"
            else:
                masked_keys[key] = ""
        return Response(masked_keys)
    
    def post(self, request):
        serializer = APIKeySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        api_keys = user.api_keys or {}
        
        for key, value in serializer.validated_data.items():
            if value:  # Only update if value provided
                api_keys[key] = value
        
        user.api_keys = api_keys
        user.save()
        
        # Log activity
        UserActivity.objects.create(
            user=user,
            action='api_key_update',
            description='API keys updated'
        )
        
        return Response({'message': 'API keys updated successfully'})


class DashboardStatsView(APIView):
    """Get dashboard statistics for current user"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        # Get brand stats
        brands = user.brands.all() if hasattr(user, 'brands') else []
        
        # Get recent activity
        recent_activity = UserActivity.objects.filter(user=user)[:5]
        
        # Get unread notifications count
        unread_notifications = Notification.objects.filter(
            user=user, is_read=False
        ).count()
        
        return Response({
            'user': UserSerializer(user).data,
            'brands_count': len(brands),
            'max_brands': user.get_max_brands(),
            'subscription': {
                'plan': user.subscription_plan,
                'is_active': user.has_active_subscription(),
                'expires': user.subscription_expires,
            },
            'unread_notifications': unread_notifications,
            'recent_activity': UserActivitySerializer(recent_activity, many=True).data,
        })


# ─── FORGOT PASSWORD (OTP-based) ──────────────────────────────────

class ForgotPasswordView(APIView):
    """Send OTP to user's email for password reset"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'No account found with this email address.'}, status=status.HTTP_404_NOT_FOUND)

        # Generate OTP
        otp = _generate_otp()
        user.preferences = user.preferences or {}
        user.preferences['reset_otp'] = otp
        user.preferences['reset_otp_created'] = timezone.now().isoformat()
        user.save(update_fields=['preferences'])

        # Send OTP email
        try:
            from .emails import send_password_reset_otp_email
            send_password_reset_otp_email(user, otp)
        except Exception:
            pass

        return Response({'message': 'A 6-digit code has been sent to your email.'})


class VerifyResetOTPView(APIView):
    """Verify OTP for password reset"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        otp = request.data.get('otp', '').strip()

        if not email or not otp:
            return Response({'error': 'Email and OTP are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'Invalid email'}, status=status.HTTP_400_BAD_REQUEST)

        prefs = user.preferences or {}
        stored_otp = prefs.get('reset_otp', '')
        otp_created = prefs.get('reset_otp_created', '')

        if not stored_otp or stored_otp != otp:
            return Response({'error': 'Invalid OTP code'}, status=status.HTTP_400_BAD_REQUEST)

        # Check expiry (15 minutes)
        if otp_created:
            from datetime import datetime, timedelta
            try:
                created_time = datetime.fromisoformat(otp_created)
                if timezone.is_naive(created_time):
                    created_time = timezone.make_aware(created_time)
                if timezone.now() - created_time > timedelta(minutes=15):
                    return Response({'error': 'OTP has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)
            except Exception:
                pass

        return Response({'message': 'OTP verified successfully', 'valid': True})


class ResetPasswordWithOTPView(APIView):
    """Reset password after OTP verification"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        otp = request.data.get('otp', '').strip()
        new_password = request.data.get('new_password', '')
        confirm_password = request.data.get('confirm_password', '')

        if not all([email, otp, new_password]):
            return Response({'error': 'All fields are required'}, status=status.HTTP_400_BAD_REQUEST)

        if new_password != confirm_password:
            return Response({'error': 'Passwords do not match'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 8:
            return Response({'error': 'Password must be at least 8 characters'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'Invalid email'}, status=status.HTTP_400_BAD_REQUEST)

        prefs = user.preferences or {}
        stored_otp = prefs.get('reset_otp', '')

        if not stored_otp or stored_otp != otp:
            return Response({'error': 'Invalid OTP'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        # Clear OTP
        prefs.pop('reset_otp', None)
        prefs.pop('reset_otp_created', None)
        user.preferences = prefs
        user.save()

        UserActivity.objects.create(
            user=user, action='password_reset',
            description='Password was reset via OTP',
        )

        return Response({'message': 'Password has been reset successfully. You can now log in.'})


# ─── EMAIL VERIFICATION (OTP-based) ──────────────────────────────

class VerifyEmailView(APIView):
    """Verify email address using OTP"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        otp = request.data.get('otp', '').strip()

        if not email or not otp:
            return Response({'error': 'Email and OTP are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'Invalid email'}, status=status.HTTP_400_BAD_REQUEST)

        if user.is_verified:
            return Response({'message': 'Email is already verified'})

        prefs = user.preferences or {}
        stored_otp = prefs.get('email_otp', '')

        if not stored_otp or stored_otp != otp:
            return Response({'error': 'Invalid verification code'}, status=status.HTTP_400_BAD_REQUEST)

        # Check expiry (30 minutes)
        otp_created = prefs.get('email_otp_created', '')
        if otp_created:
            from datetime import datetime, timedelta
            try:
                created_time = datetime.fromisoformat(otp_created)
                if timezone.is_naive(created_time):
                    created_time = timezone.make_aware(created_time)
                if timezone.now() - created_time > timedelta(minutes=30):
                    return Response({'error': 'Verification code has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)
            except Exception:
                pass

        user.is_verified = True
        prefs.pop('email_otp', None)
        prefs.pop('email_otp_created', None)
        user.preferences = prefs
        user.save()

        # Generate tokens for auto-login after verification
        refresh = RefreshToken.for_user(user)

        # Send welcome email
        try:
            from .emails import send_welcome_email
            send_welcome_email(user)
        except Exception:
            pass

        return Response({
            'message': 'Email verified successfully!',
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })


class ResendVerificationView(APIView):
    """Resend email verification OTP"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'message': 'If the email exists, a new code has been sent.'})

        if user.is_verified:
            return Response({'message': 'Email is already verified'})

        otp = _generate_otp()
        user.preferences = user.preferences or {}
        user.preferences['email_otp'] = otp
        user.preferences['email_otp_created'] = timezone.now().isoformat()
        user.save(update_fields=['preferences'])

        try:
            from .emails import send_verification_otp_email
            send_verification_otp_email(user, otp)
        except Exception:
            pass

        return Response({'message': 'A new verification code has been sent to your email.'})


# ─── GOOGLE OAUTH ──────────────────────────────────────────────────

class GoogleAuthView(APIView):
    """Handle Google Sign-In via ID token (popup) or authorization code (redirect)"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        credential = request.data.get('credential', '')
        code = request.data.get('code', '')
        redirect_uri = request.data.get('redirect_uri', '')

        if not credential and not code:
            return Response({'error': 'Google credential or authorization code is required'}, status=status.HTTP_400_BAD_REQUEST)

        import os
        client_id = os.environ.get('GOOGLE_CLIENT_ID', '')
        if not client_id:
            try:
                from apps.admin_dashboard.models import SystemSetting
                client_id = SystemSetting.get('google_client_id', '')
            except Exception:
                pass

        if not client_id:
            return Response({'error': 'Google OAuth is not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # ── Authorization code flow (redirect) ──
        if code:
            try:
                import requests as http_requests

                client_secret = os.environ.get('GOOGLE_CLIENT_SECRET', '')
                if not client_secret:
                    try:
                        from apps.admin_dashboard.models import SystemSetting
                        client_secret = SystemSetting.get('google_client_secret', '')
                    except Exception:
                        pass

                if not client_secret:
                    return Response({'error': 'Google OAuth client secret is not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

                # Exchange authorization code for tokens
                token_response = http_requests.post('https://oauth2.googleapis.com/token', data={
                    'code': code,
                    'client_id': client_id,
                    'client_secret': client_secret,
                    'redirect_uri': redirect_uri,
                    'grant_type': 'authorization_code',
                }, timeout=10)

                if token_response.status_code != 200:
                    logger.warning(f"Google token exchange failed: {token_response.text[:200]}")
                    return Response({'error': 'Failed to exchange Google authorization code'}, status=status.HTTP_400_BAD_REQUEST)

                token_data = token_response.json()
                credential = token_data.get('id_token', '')
                if not credential:
                    return Response({'error': 'No ID token received from Google'}, status=status.HTTP_400_BAD_REQUEST)

            except Exception as e:
                logger.error(f"Google code exchange error: {e}")
                return Response({'error': f'Google authentication failed: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        # ── Verify ID token (works for both flows) ──
        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests as google_requests

            idinfo = id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)

            email = idinfo.get('email', '').lower()
            first_name = idinfo.get('given_name', '')
            last_name = idinfo.get('family_name', '')

            if not email:
                return Response({'error': 'Unable to get email from Google'}, status=status.HTTP_400_BAD_REQUEST)

        except ImportError:
            return Response({
                'error': 'Google auth library not installed. Run: pip install google-auth'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except ValueError as e:
            return Response({'error': f'Invalid Google token: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        # Find or create user
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            user = User.objects.create_user(
                email=email,
                first_name=first_name or email.split('@')[0],
                last_name=last_name or '',
                password=None,  # No password for Google users
            )
            user.is_verified = True

            # Auto-create Company — same logic as regular registration
            company_name = f"{first_name or email.split('@')[0]}'s Business"
            try:
                from apps.admin_dashboard.models import Company, PLAN_LIMITS
                company_obj = Company.objects.filter(name__iexact=company_name).first()
                if not company_obj:
                    limits = PLAN_LIMITS.get('free', {})
                    company_obj = Company.objects.create(
                        name=company_name,
                        plan='free',
                        max_brands=limits.get('max_brands', 1),
                        max_users=limits.get('max_users', 2),
                        owner=user,
                    )
                user.role = 'admin'  # Business creator becomes admin
                user.company_ref = company_obj
            except Exception as comp_err:
                import logging
                logging.getLogger(__name__).warning(f"Could not create company for Google user: {comp_err}")
                user.role = 'admin'

            user.save()

            UserActivity.objects.create(
                user=user,
                action='login',
                description='Account created via Google Sign-In',
            )

        # Mark as verified (Google-verified email)
        if not user.is_verified:
            user.is_verified = True
            user.save(update_fields=['is_verified'])

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        UserActivity.objects.create(
            user=user,
            action='login',
            description='Signed in with Google',
        )

        # Build user data with company_info
        user_data = UserSerializer(user).data

        return Response({
            'message': 'Google sign-in successful',
            'user': user_data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })


# ─── LEGACY RESET PASSWORD (link-based, kept for backwards compat) ─

class ResetPasswordView(APIView):
    """Reset password using token (legacy link-based)"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_decode

        uid = request.data.get('uid', '')
        token = request.data.get('token', '')
        new_password = request.data.get('new_password', '')
        confirm_password = request.data.get('confirm_password', '')

        if not all([uid, token, new_password]):
            return Response({'error': 'All fields are required'}, status=status.HTTP_400_BAD_REQUEST)

        if new_password != confirm_password:
            return Response({'error': 'Passwords do not match'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_id = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Invalid reset link'}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({'error': 'Reset link has expired or is invalid'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        UserActivity.objects.create(
            user=user, action='password_reset',
            description='Password was reset via email link',
        )



        return Response({'message': 'Password has been reset successfully. You can now log in.'})