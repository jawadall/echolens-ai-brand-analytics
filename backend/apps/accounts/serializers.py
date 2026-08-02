"""
Serializers for User Authentication and Management
"""
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import UserActivity, Notification

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT token serializer with additional user info"""
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Add custom claims
        token['email'] = user.email
        token['name'] = user.full_name
        token['role'] = user.role
        token['subscription'] = user.subscription_plan
        
        return token
    
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Add user info to response
        data['user'] = {
            'id': self.user.id,
            'email': self.user.email,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'full_name': self.user.full_name,
            'role': self.user.role,
            'is_staff': self.user.is_staff,
            'subscription_plan': self.user.subscription_plan,
            'company': self.user.company,
            'avatar': self.user.avatar.url if self.user.avatar else None,
        }
        
        # Add company_info if user belongs to a company
        if self.user.company_ref:
            co = self.user.company_ref
            limits = co.get_plan_limits()
            data['user']['company_info'] = {
                'id': co.id,
                'name': co.name,
                'plan': co.plan,
                'status': co.status,
                'is_owner': co.owner_id == self.user.id,
                'brands_used': co.brands_count,
                'brands_limit': limits['max_brands'],
                'users_used': co.users_count,
                'users_limit': limits['max_users'],
            }
        else:
            data['user']['company_info'] = None
        
        # Update login stats
        self.user.increment_login_count()
        self.user.update_last_activity()

        # Clear invite_pending on first login after invitation
        prefs = self.user.preferences or {}
        if prefs.get('invite_pending'):
            prefs['invite_pending'] = False
            self.user.preferences = prefs
            self.user.save(update_fields=['preferences'])
        
        return data


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""
    
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = [
            'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'company', 'phone'
        ]
    
    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password_confirm'):
            raise serializers.ValidationError({
                'password_confirm': 'Passwords do not match.'
            })
        return attrs
    
    def create(self, validated_data):
        company_name = validated_data.get('company', '').strip()
        user = User.objects.create_user(**validated_data)
        
        # Auto-create or link to Business — mandatory for all users
        if not company_name:
            first = user.first_name or user.email.split('@')[0]
            company_name = f"{first}'s Business"

        from apps.admin_dashboard.models import Company, PLAN_LIMITS
        # Try to find existing company by exact name
        company_obj = Company.objects.filter(name__iexact=company_name).first()
        if not company_obj:
            # Create new company, user becomes owner + admin
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
        user.save(update_fields=['company_ref', 'role'])
        
        return user


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user details"""
    
    full_name = serializers.ReadOnlyField()
    max_brands = serializers.SerializerMethodField()
    brands_count = serializers.SerializerMethodField()
    company_info = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'company', 'company_info', 'role', 'is_staff', 'phone', 'avatar', 'timezone',
            'subscription_plan', 'subscription_expires', 'preferences',
            'is_verified', 'last_activity', 'login_count',
            'max_brands', 'brands_count', 'created_at'
        ]
        read_only_fields = [
            'id', 'email', 'role', 'is_staff', 'subscription_plan',
            'subscription_expires', 'is_verified', 'last_activity',
            'login_count', 'created_at'
        ]
    
    def get_max_brands(self, obj):
        # Use company plan limits if user belongs to a company
        if obj.company_ref:
            return obj.company_ref.get_plan_limits().get('max_brands', 1)
        return obj.get_max_brands()
    
    def get_brands_count(self, obj):
        return obj.brands.count() if hasattr(obj, 'brands') else 0
    
    def get_company_info(self, obj):
        if obj.company_ref:
            co = obj.company_ref
            limits = co.get_plan_limits()
            return {
                'id': co.id,
                'name': co.name,
                'plan': co.plan,
                'status': co.status,
                'is_owner': co.owner_id == obj.id,
                'brands_used': co.brands_count,
                'brands_limit': limits['max_brands'],
                'users_used': co.users_count,
                'users_limit': limits['max_users'],
            }
        return None


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile"""
    
    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'company',
            'phone', 'avatar', 'timezone', 'preferences'
        ]


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for password change"""
    
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password_confirm': 'New passwords do not match.'
            })
        return attrs


class UserActivitySerializer(serializers.ModelSerializer):
    """Serializer for user activity logs"""
    
    class Meta:
        model = UserActivity
        fields = ['id', 'action', 'description', 'ip_address', 'created_at', 'metadata']


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for user notifications"""
    
    class Meta:
        model = Notification
        fields = ['id', 'type', 'title', 'message', 'link', 'is_read', 'created_at']
        read_only_fields = ['id', 'type', 'title', 'message', 'link', 'created_at']


class APIKeySerializer(serializers.Serializer):
    """Serializer for API key management"""
    
    reddit_client_id = serializers.CharField(required=False, allow_blank=True)
    reddit_client_secret = serializers.CharField(required=False, allow_blank=True)
    twitter_api_key = serializers.CharField(required=False, allow_blank=True)
    twitter_api_secret = serializers.CharField(required=False, allow_blank=True)
    twitter_bearer_token = serializers.CharField(required=False, allow_blank=True)
    gemini_api_key = serializers.CharField(required=False, allow_blank=True)

