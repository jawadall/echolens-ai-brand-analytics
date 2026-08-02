"""
Unit Tests for Brands App
Tests for brand CRUD, posts, alerts, and comparison
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

from .models import Brand, SocialPost, BrandAlert, FetchLog

User = get_user_model()


class BrandModelTests(TestCase):
    """Tests for the Brand model"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='brand@echolens.com', password='Pass123!',
            first_name='Brand', last_name='Tester'
        )
        self.brand = Brand.objects.create(
            user=self.user,
            name='TestBrand',
            keywords=['test', 'brand'],
            hashtags=['testbrand'],
            platforms=['twitter', 'reddit'],
        )

    def test_brand_creation(self):
        self.assertEqual(self.brand.name, 'TestBrand')
        self.assertEqual(self.brand.status, 'active')
        self.assertEqual(self.brand.user, self.user)

    def test_get_all_keywords(self):
        keywords = self.brand.get_all_keywords()
        self.assertIn('testbrand', keywords)
        self.assertIn('test', keywords)

    def test_get_all_hashtags(self):
        hashtags = self.brand.get_all_hashtags()
        self.assertIn('#testbrand', hashtags)

    def test_string_representation(self):
        self.assertEqual(str(self.brand), 'TestBrand')

    def test_unique_together(self):
        with self.assertRaises(Exception):
            Brand.objects.create(
                user=self.user, name='TestBrand', platforms=['twitter']
            )

    def test_update_stats(self):
        # Create a processed post
        SocialPost.objects.create(
            brand=self.brand, platform='twitter',
            platform_id='t1', content='Great brand!',
            sentiment='positive', sentiment_score=0.8,
            is_processed=True, posted_at=timezone.now()
        )
        self.brand.update_stats()
        self.brand.refresh_from_db()
        self.assertEqual(self.brand.total_posts, 1)
        self.assertAlmostEqual(self.brand.avg_sentiment, 0.8)


class SocialPostModelTests(TestCase):
    """Tests for SocialPost model"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='post@echolens.com', password='Pass123!',
            first_name='A', last_name='B'
        )
        self.brand = Brand.objects.create(
            user=self.user, name='PostBrand', platforms=['twitter']
        )
        self.post = SocialPost.objects.create(
            brand=self.brand, platform='twitter', platform_id='tw123',
            content='I love this brand!', likes=10, shares=5, comments=3,
            posted_at=timezone.now()
        )

    def test_engagement_score(self):
        # likes + shares*2 + comments*3 = 10 + 10 + 9 = 29
        self.assertEqual(self.post.engagement_score, 29)

    def test_unique_together(self):
        with self.assertRaises(Exception):
            SocialPost.objects.create(
                brand=self.brand, platform='twitter', platform_id='tw123',
                content='duplicate', posted_at=timezone.now()
            )


class BrandAPITests(APITestCase):
    """Tests for brand API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='api@echolens.com', password='Pass123!',
            first_name='API', last_name='Tester'
        )
        self.client.force_authenticate(user=self.user)

    def test_create_brand(self):
        data = {
            'name': 'NewBrand',
            'keywords': ['new', 'brand'],
            'platforms': ['twitter'],
        }
        response = self.client.post(reverse('brands:brand_list'), data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Brand.objects.filter(name='NewBrand').exists())

    def test_list_brands(self):
        Brand.objects.create(
            user=self.user, name='B1', platforms=['twitter']
        )
        response = self.client.get(reverse('brands:brand_list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_brand_detail(self):
        brand = Brand.objects.create(
            user=self.user, name='Detail', platforms=['twitter']
        )
        response = self.client.get(
            reverse('brands:brand_detail', kwargs={'pk': brand.id})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Detail')

    def test_update_brand(self):
        brand = Brand.objects.create(
            user=self.user, name='Update', platforms=['twitter']
        )
        response = self.client.patch(
            reverse('brands:brand_detail', kwargs={'pk': brand.id}),
            {'description': 'Updated description'}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        brand.refresh_from_db()
        self.assertEqual(brand.description, 'Updated description')

    def test_delete_brand(self):
        brand = Brand.objects.create(
            user=self.user, name='Delete', platforms=['twitter']
        )
        response = self.client.delete(
            reverse('brands:brand_detail', kwargs={'pk': brand.id})
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Brand.objects.filter(id=brand.id).exists())

    def test_brand_limit_enforcement(self):
        # Free plan allows 1 brand
        Brand.objects.create(user=self.user, name='First', platforms=['twitter'])
        data = {
            'name': 'Second',
            'keywords': ['x'],
            'platforms': ['twitter'],
        }
        response = self.client.post(reverse('brands:brand_list'), data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_access_other_users_brand(self):
        other_user = User.objects.create_user(
            email='other@echolens.com', password='Pass123!',
            first_name='O', last_name='U'
        )
        brand = Brand.objects.create(
            user=other_user, name='Private', platforms=['twitter']
        )
        response = self.client.get(
            reverse('brands:brand_detail', kwargs={'pk': brand.id})
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class AlertModelTests(TestCase):
    """Tests for BrandAlert model"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='alert@echolens.com', password='Pass123!',
            first_name='A', last_name='B'
        )
        self.brand = Brand.objects.create(
            user=self.user, name='AlertBrand', platforms=['twitter']
        )

    def test_create_alert(self):
        alert = BrandAlert.objects.create(
            brand=self.brand,
            alert_type='negative_spike',
            severity='high',
            title='Test Alert',
            description='Negative sentiment spike detected',
        )
        self.assertEqual(str(alert), 'AlertBrand - Test Alert')
        self.assertFalse(alert.is_acknowledged)
        self.assertFalse(alert.is_resolved)
