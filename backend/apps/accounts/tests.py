"""
Unit Tests for Accounts App
Tests for user registration, login, profile, notifications, and activities
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model

from .models import UserActivity, Notification

User = get_user_model()


class UserModelTests(TestCase):
    """Tests for the custom User model"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='test@echolens.com',
            password='TestPass123!',
            first_name='Test',
            last_name='User',
            company='Test Corp'
        )

    def test_create_user(self):
        self.assertEqual(self.user.email, 'test@echolens.com')
        self.assertTrue(self.user.check_password('TestPass123!'))
        self.assertFalse(self.user.is_staff)
        self.assertFalse(self.user.is_superuser)

    def test_create_superuser(self):
        admin = User.objects.create_superuser(
            email='admin@echolens.com',
            password='AdminPass123!',
            first_name='Admin',
            last_name='User'
        )
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)
        self.assertEqual(admin.role, 'admin')

    def test_full_name_property(self):
        self.assertEqual(self.user.full_name, 'Test User')

    def test_email_required(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(email='', password='pass123')

    def test_has_active_subscription_free(self):
        self.assertTrue(self.user.has_active_subscription())

    def test_get_max_brands_free(self):
        self.assertEqual(self.user.get_max_brands(), 1)

    def test_increment_login_count(self):
        self.assertEqual(self.user.login_count, 0)
        self.user.increment_login_count()
        self.user.refresh_from_db()
        self.assertEqual(self.user.login_count, 1)

    def test_update_last_activity(self):
        self.assertIsNone(self.user.last_activity)
        self.user.update_last_activity()
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.last_activity)

    def test_string_representation(self):
        self.assertEqual(str(self.user), 'test@echolens.com')


class RegistrationAPITests(APITestCase):
    """Tests for user registration endpoint"""

    def test_register_success(self):
        data = {
            'email': 'newuser@echolens.com',
            'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
            'first_name': 'New',
            'last_name': 'User',
        }
        response = self.client.post(reverse('accounts:register'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])
        self.assertTrue(User.objects.filter(email='newuser@echolens.com').exists())

    def test_register_password_mismatch(self):
        data = {
            'email': 'user@echolens.com',
            'password': 'StrongPass123!',
            'password_confirm': 'DifferentPass123!',
            'first_name': 'Test',
            'last_name': 'User',
        }
        response = self.client.post(reverse('accounts:register'), data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_duplicate_email(self):
        User.objects.create_user(
            email='existing@echolens.com', password='Pass123!',
            first_name='A', last_name='B'
        )
        data = {
            'email': 'existing@echolens.com',
            'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
            'first_name': 'Test',
            'last_name': 'User',
        }
        response = self.client.post(reverse('accounts:register'), data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginAPITests(APITestCase):
    """Tests for login endpoint"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='login@echolens.com',
            password='TestPass123!',
            first_name='Login',
            last_name='User'
        )

    def test_login_success(self):
        data = {'email': 'login@echolens.com', 'password': 'TestPass123!'}
        response = self.client.post(reverse('accounts:login'), data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)

    def test_login_wrong_password(self):
        data = {'email': 'login@echolens.com', 'password': 'WrongPass!'}
        response = self.client.post(reverse('accounts:login'), data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_creates_activity(self):
        data = {'email': 'login@echolens.com', 'password': 'TestPass123!'}
        self.client.post(reverse('accounts:login'), data)
        self.assertTrue(
            UserActivity.objects.filter(user=self.user, action='login').exists()
        )


class ProfileAPITests(APITestCase):
    """Tests for profile endpoint"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='profile@echolens.com',
            password='TestPass123!',
            first_name='Profile',
            last_name='User'
        )
        self.client.force_authenticate(user=self.user)

    def test_get_profile(self):
        response = self.client.get(reverse('accounts:profile'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'profile@echolens.com')

    def test_update_profile(self):
        data = {'first_name': 'Updated', 'company': 'New Corp'}
        response = self.client.patch(reverse('accounts:profile'), data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Updated')
        self.assertEqual(self.user.company, 'New Corp')

    def test_profile_unauthenticated(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(reverse('accounts:profile'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ChangePasswordTests(APITestCase):
    """Tests for password change"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='pwd@echolens.com', password='OldPass123!',
            first_name='A', last_name='B'
        )
        self.client.force_authenticate(user=self.user)

    def test_change_password_success(self):
        data = {
            'old_password': 'OldPass123!',
            'new_password': 'NewPass456!',
            'new_password_confirm': 'NewPass456!',
        }
        response = self.client.post(reverse('accounts:change_password'), data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewPass456!'))

    def test_change_password_wrong_old(self):
        data = {
            'old_password': 'WrongOld!',
            'new_password': 'NewPass456!',
            'new_password_confirm': 'NewPass456!',
        }
        response = self.client.post(reverse('accounts:change_password'), data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class NotificationTests(APITestCase):
    """Tests for notifications"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='notify@echolens.com', password='Pass123!',
            first_name='A', last_name='B'
        )
        self.client.force_authenticate(user=self.user)
        self.notif = Notification.objects.create(
            user=self.user, type='info', title='Test', message='Hello'
        )

    def test_list_notifications(self):
        response = self.client.get(reverse('accounts:notifications'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_mark_read(self):
        response = self.client.post(
            reverse('accounts:mark_notifications_read'),
            {'ids': [self.notif.id]}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.notif.refresh_from_db()
        self.assertTrue(self.notif.is_read)
