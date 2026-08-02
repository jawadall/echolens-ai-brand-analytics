"""
User Models for Echo Lens
Custom User model with role-based access control
"""
from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils import timezone


class UserManager(BaseUserManager):
    """Custom user manager for Echo Lens"""
    
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Custom User model for Echo Lens"""
    
    ROLE_CHOICES = [
        ('admin', 'Administrator'),
        ('analyst', 'Analyst'),
        ('viewer', 'Viewer'),
    ]
    
    username = None  # Remove username field
    email = models.EmailField('Email Address', unique=True)
    first_name = models.CharField('First Name', max_length=100)
    last_name = models.CharField('Last Name', max_length=100)
    company = models.CharField('Company/Organization', max_length=200, blank=True)
    company_ref = models.ForeignKey(
        'admin_dashboard.Company', verbose_name='Company',
        null=True, blank=True, on_delete=models.SET_NULL,
        related_name='members'
    )
    role = models.CharField('User Role', max_length=20, choices=ROLE_CHOICES, default='analyst')
    phone = models.CharField('Phone Number', max_length=20, blank=True)
    avatar = models.ImageField('Profile Picture', upload_to='avatars/', null=True, blank=True)
    
    # Subscription info
    subscription_plan = models.CharField(max_length=50, default='free')
    subscription_expires = models.DateTimeField(null=True, blank=True)
    
    # API Keys storage (encrypted in production)
    api_keys = models.JSONField('API Keys', default=dict, blank=True)
    
    # Preferences
    preferences = models.JSONField('User Preferences', default=dict, blank=True)
    timezone = models.CharField('Timezone', max_length=50, default='Asia/Karachi')
    
    # Activity tracking
    last_activity = models.DateTimeField('Last Activity', null=True, blank=True)
    login_count = models.PositiveIntegerField('Login Count', default=0)
    
    # Status
    is_verified = models.BooleanField('Email Verified', default=False)
    is_active = models.BooleanField('Active', default=True)
    
    # Timestamps
    created_at = models.DateTimeField('Created At', auto_now_add=True)
    updated_at = models.DateTimeField('Updated At', auto_now=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']
    
    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.email
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    def update_last_activity(self):
        self.last_activity = timezone.now()
        self.save(update_fields=['last_activity'])
    
    def increment_login_count(self):
        self.login_count += 1
        self.save(update_fields=['login_count'])
    
    def has_active_subscription(self):
        if self.subscription_plan == 'free':
            return True
        if self.subscription_expires:
            return self.subscription_expires > timezone.now()
        return False
    
    def get_max_brands(self):
        from django.conf import settings
        limits = settings.ECHOLENS_SETTINGS.get('MAX_BRANDS_PER_USER', {})
        return limits.get(self.subscription_plan, 1)


class UserActivity(models.Model):
    """Track user activities for audit logs"""
    
    ACTION_TYPES = [
        ('login', 'User Login'),
        ('logout', 'User Logout'),
        ('brand_create', 'Brand Created'),
        ('brand_update', 'Brand Updated'),
        ('brand_delete', 'Brand Deleted'),
        ('export', 'Data Exported'),
        ('settings_change', 'Settings Changed'),
        ('api_key_update', 'API Key Updated'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activities')
    action = models.CharField('Action', max_length=50, choices=ACTION_TYPES)
    description = models.TextField('Description', blank=True)
    ip_address = models.GenericIPAddressField('IP Address', null=True, blank=True)
    user_agent = models.CharField('User Agent', max_length=500, blank=True)
    metadata = models.JSONField('Additional Data', default=dict, blank=True)
    created_at = models.DateTimeField('Timestamp', auto_now_add=True)
    
    class Meta:
        verbose_name = 'User Activity'
        verbose_name_plural = 'User Activities'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.email} - {self.action}"


class Notification(models.Model):
    """User notifications"""
    
    NOTIFICATION_TYPES = [
        ('alert', 'Alert'),
        ('info', 'Information'),
        ('warning', 'Warning'),
        ('success', 'Success'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField('Type', max_length=20, choices=NOTIFICATION_TYPES, default='info')
    title = models.CharField('Title', max_length=200)
    message = models.TextField('Message')
    link = models.URLField('Link', blank=True)
    is_read = models.BooleanField('Read', default=False)
    created_at = models.DateTimeField('Created At', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.email} - {self.title}"

