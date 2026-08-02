"""
Views for Analytics and KPIs
"""
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.db.models import Count, Avg, Sum, Q
from django.db.models.functions import TruncDate, TruncHour
from datetime import timedelta
from collections import Counter
import re

from .models import DailyAnalytics, HourlyAnalytics, TopicTrend, SentimentSummary, PlatformAnalytics
from .serializers import (
    DailyAnalyticsSerializer, HourlyAnalyticsSerializer,
    TopicTrendSerializer, SentimentSummarySerializer, PlatformAnalyticsSerializer
)
from apps.brands.models import Brand, SocialPost, BrandAlert
from apps.brands.views import get_brand_for_user, get_company_brands


class BrandOverviewView(APIView):
    """Get overview statistics for a brand"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, pk):
        try:
            brand = get_brand_for_user(pk, request.user)
            if not brand:
                raise Brand.DoesNotExist
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)
        
        days = int(request.query_params.get('days', 30))
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        posts = brand.posts.filter(
            posted_at__gte=start_date,
            posted_at__lte=end_date,
            is_spam=False
        )
        
        total_posts = posts.count()
        
        # Sentiment counts (handle null sentiments)
        sentiment_counts = posts.filter(is_processed=True).exclude(sentiment__isnull=True).values('sentiment').annotate(count=Count('id'))
        sentiment_dict = {item['sentiment']: item['count'] for item in sentiment_counts}
        # Ensure all sentiment types are present
        for sentiment_type in ['positive', 'neutral', 'negative']:
            if sentiment_type not in sentiment_dict:
                sentiment_dict[sentiment_type] = 0
        
        # Average sentiment
        avg_sentiment = posts.filter(is_processed=True).aggregate(avg=Avg('sentiment_score'))['avg'] or 0
        
        # Engagement
        engagement = posts.aggregate(
            likes=Sum('likes'),
            shares=Sum('shares'),
            comments=Sum('comments'),
            views=Sum('views')
        )
        
        # Recent alerts
        recent_alerts = BrandAlert.objects.filter(
            brand=brand,
            created_at__gte=start_date,
            is_resolved=False
        ).count()
        
        # Top topics
        all_topics = []
        for post in posts.exclude(topics=[]):
            all_topics.extend(post.topics)
        topic_counts = Counter(all_topics).most_common(10)
        
        # Sentiment change (comparing to previous period)
        prev_start = start_date - timedelta(days=days)
        prev_posts = brand.posts.filter(
            posted_at__gte=prev_start,
            posted_at__lt=start_date,
            is_spam=False,
            is_processed=True
        )
        prev_sentiment = prev_posts.aggregate(avg=Avg('sentiment_score'))['avg'] or 0
        sentiment_change = avg_sentiment - prev_sentiment
        
        # Total all-time posts (not filtered by date)
        total_all_time = brand.posts.filter(is_spam=False).count()
        
        # Platform breakdown from DB (accurate counts)
        platform_counts = posts.values('platform').annotate(count=Count('id')).order_by('-count')
        platform_breakdown = {item['platform']: item['count'] for item in platform_counts}
        
        # All-time platform breakdown
        all_time_platform = brand.posts.filter(is_spam=False).values('platform').annotate(count=Count('id')).order_by('-count')
        all_time_platform_breakdown = {item['platform']: item['count'] for item in all_time_platform}
        
        return Response({
            'brand_id': brand.id,
            'brand_name': brand.name,
            'period': {
                'start': start_date,
                'end': end_date,
                'days': days
            },
            'total_posts': total_posts,
            'total_all_time': total_all_time,
            'platform_breakdown': platform_breakdown,
            'all_time_platform_breakdown': all_time_platform_breakdown,
            'sentiment': {
                'positive': sentiment_dict.get('positive', 0),
                'neutral': sentiment_dict.get('neutral', 0),
                'negative': sentiment_dict.get('negative', 0),
                'average_score': round(avg_sentiment, 3),
                'change': round(sentiment_change, 3)
            },
            'engagement': {
                'total_likes': engagement['likes'] or 0,
                'total_shares': engagement['shares'] or 0,
                'total_comments': engagement['comments'] or 0,
                'total_views': engagement['views'] or 0
            },
            'trending_topics': [{'topic': t[0], 'count': t[1]} for t in topic_counts],
            'recent_alerts': recent_alerts
        })


class SentimentTrendsView(APIView):
    """Get sentiment trends over time"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, pk):
        try:
            brand = get_brand_for_user(pk, request.user)
            if not brand:
                raise Brand.DoesNotExist
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)
        
        days = int(request.query_params.get('days', 30))
        granularity = request.query_params.get('granularity', 'daily')  # daily or hourly
        
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        posts = brand.posts.filter(
            posted_at__gte=start_date,
            posted_at__lte=end_date,
            is_spam=False,
            is_processed=True
        )
        
        if granularity == 'hourly' and days <= 7:
            # Hourly data for short periods
            data = posts.annotate(
                period=TruncHour('posted_at')
            ).values('period').annotate(
                total=Count('id'),
                positive=Count('id', filter=Q(sentiment='positive')),
                neutral=Count('id', filter=Q(sentiment='neutral')),
                negative=Count('id', filter=Q(sentiment='negative')),
                avg_sentiment=Avg('sentiment_score')
            ).order_by('period')
        else:
            # Daily data
            data = posts.annotate(
                period=TruncDate('posted_at')
            ).values('period').annotate(
                total=Count('id'),
                positive=Count('id', filter=Q(sentiment='positive')),
                neutral=Count('id', filter=Q(sentiment='neutral')),
                negative=Count('id', filter=Q(sentiment='negative')),
                avg_sentiment=Avg('sentiment_score')
            ).order_by('period')
        
        # Format for charts
        labels = []
        datasets = {
            'total': [],
            'positive': [],
            'neutral': [],
            'negative': [],
            'sentiment_score': []
        }
        
        for item in data:
            labels.append(item['period'].isoformat() if item['period'] else '')
            datasets['total'].append(item['total'])
            datasets['positive'].append(item['positive'])
            datasets['neutral'].append(item['neutral'])
            datasets['negative'].append(item['negative'])
            datasets['sentiment_score'].append(round(item['avg_sentiment'] or 0, 3))
        
        return Response({
            'brand_id': brand.id,
            'period': {'start': start_date, 'end': end_date, 'days': days},
            'granularity': granularity,
            'labels': labels,
            'datasets': datasets
        })


class PlatformBreakdownView(APIView):
    """Get analytics breakdown by platform"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, pk):
        try:
            brand = get_brand_for_user(pk, request.user)
            if not brand:
                raise Brand.DoesNotExist
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)
        
        days = int(request.query_params.get('days', 30))
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        posts = brand.posts.filter(
            posted_at__gte=start_date,
            posted_at__lte=end_date,
            is_spam=False
        )
        
        # Aggregate by platform
        platform_data = posts.values('platform').annotate(
            total=Count('id'),
            positive=Count('id', filter=Q(sentiment='positive', is_processed=True)),
            neutral=Count('id', filter=Q(sentiment='neutral', is_processed=True)),
            negative=Count('id', filter=Q(sentiment='negative', is_processed=True)),
            avg_sentiment=Avg('sentiment_score'),
            total_likes=Sum('likes'),
            total_shares=Sum('shares'),
            total_comments=Sum('comments')
        )
        
        return Response({
            'brand_id': brand.id,
            'period': {'start': start_date, 'end': end_date, 'days': days},
            'platforms': list(platform_data)
        })


class TopPostsView(APIView):
    """Get top performing posts"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, pk):
        try:
            brand = get_brand_for_user(pk, request.user)
            if not brand:
                raise Brand.DoesNotExist
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)
        
        days = int(request.query_params.get('days', 30))
        limit = int(request.query_params.get('limit', 50))
        sort_by = request.query_params.get('sort_by', 'engagement')  # engagement, likes, shares, sentiment
        sentiment_filter = request.query_params.get('sentiment')
        platform_filter = request.query_params.get('platform')
        
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        posts = brand.posts.filter(
            posted_at__gte=start_date,
            posted_at__lte=end_date,
            is_spam=False
        )
        
        if sentiment_filter:
            posts = posts.filter(sentiment=sentiment_filter)
        
        if platform_filter and platform_filter != 'all':
            posts = posts.filter(platform=platform_filter)
        
        # Sort
        if sort_by == 'likes':
            posts = posts.order_by('-likes')
        elif sort_by == 'shares':
            posts = posts.order_by('-shares')
        elif sort_by == 'sentiment':
            posts = posts.order_by('-sentiment_score')
        elif sort_by == 'recent':
            posts = posts.order_by('-posted_at')
        else:  # engagement — prioritise verifiable platforms first
            from django.db.models import Case, When, IntegerField, Value
            platform_priority = Case(
                When(platform='reddit', then=Value(1)),
                When(platform='news', then=Value(2)),
                When(platform='youtube', then=Value(3)),
                When(platform='facebook', then=Value(4)),
                When(platform='twitter', then=Value(5)),
                default=Value(6),
                output_field=IntegerField(),
            )
            posts = posts.annotate(platform_rank=platform_priority).order_by('platform_rank', '-posted_at')
        
        total_count = posts.count()
        posts = posts[:limit]
        
        # Return flat objects matching frontend Post type exactly
        result = []
        for post in posts:
            result.append({
                'id': post.id,
                'platform': post.platform,
                'url': post.url,
                'content': post.content[:500] if post.content else '',
                'author_name': post.author_name,
                'author_username': post.author_username,
                'author_verified': post.author_verified,
                'sentiment': post.sentiment,
                'sentiment_score': post.sentiment_score,
                'likes': post.likes,
                'shares': post.shares,
                'comments': post.comments,
                'engagement_score': (post.likes or 0) + (post.shares or 0) * 2 + (post.comments or 0) * 3,
                'topics': post.topics or [],
                'posted_at': post.posted_at.isoformat() if post.posted_at else None,
            })
        
        return Response({
            'brand_id': brand.id,
            'period': {'start': start_date, 'end': end_date, 'days': days},
            'sort_by': sort_by,
            'total_count': total_count,
            'posts': result
        })


class WordCloudDataView(APIView):
    """Get word cloud data from posts"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, pk):
        try:
            brand = get_brand_for_user(pk, request.user)
            if not brand:
                raise Brand.DoesNotExist
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)
        
        days = int(request.query_params.get('days', 30))
        sentiment_filter = request.query_params.get('sentiment')
        
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        posts = brand.posts.filter(
            posted_at__gte=start_date,
            posted_at__lte=end_date,
            is_spam=False,
            is_processed=True
        )
        
        if sentiment_filter:
            posts = posts.filter(sentiment=sentiment_filter)
        
        # Collect all topics
        all_words = []
        word_sentiments = {}
        
        for post in posts:
            for topic in post.topics:
                all_words.append(topic.lower())
                if topic.lower() not in word_sentiments:
                    word_sentiments[topic.lower()] = []
                word_sentiments[topic.lower()].append(post.sentiment_score or 0)
        
        # Count words
        word_counts = Counter(all_words)
        
        # Create word cloud data
        words = []
        for word, count in word_counts.most_common(100):
            avg_sentiment = sum(word_sentiments[word]) / len(word_sentiments[word]) if word_sentiments[word] else 0
            sentiment = 'positive' if avg_sentiment > 0.1 else ('negative' if avg_sentiment < -0.1 else 'neutral')
            
            words.append({
                'text': word,
                'value': count,
                'sentiment': sentiment,
                'sentiment_score': round(avg_sentiment, 3)
            })
        
        return Response({
            'brand_id': brand.id,
            'period': {'start': start_date, 'end': end_date, 'days': days},
            'words': words
        })


class EmotionAnalysisView(APIView):
    """Get emotion distribution analysis"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, pk):
        try:
            brand = get_brand_for_user(pk, request.user)
            if not brand:
                raise Brand.DoesNotExist
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)
        
        days = int(request.query_params.get('days', 30))
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        posts = brand.posts.filter(
            posted_at__gte=start_date,
            posted_at__lte=end_date,
            is_spam=False,
            is_processed=True
        ).exclude(emotions={})
        
        # Aggregate emotions
        emotion_totals = Counter()
        for post in posts:
            for emotion, score in post.emotions.items():
                emotion_totals[emotion] += score
        
        # Normalize
        total = sum(emotion_totals.values())
        emotions = {}
        if total > 0:
            for emotion, score in emotion_totals.items():
                emotions[emotion] = round(score / total, 3)
        
        return Response({
            'brand_id': brand.id,
            'period': {'start': start_date, 'end': end_date, 'days': days},
            'emotions': emotions,
            'total_analyzed': posts.count()
        })


class SentimentSummaryListView(generics.ListAPIView):
    """List AI-generated sentiment summaries"""
    serializer_class = SentimentSummarySerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        brand_id = self.kwargs.get('pk')
        user = self.request.user
        if user.company_ref_id:
            return SentimentSummary.objects.filter(brand_id=brand_id, brand__company=user.company_ref)
        return SentimentSummary.objects.filter(brand_id=brand_id, brand__user=user)


class GenerateSummaryView(APIView):
    """Generate AI summary for a brand"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        try:
            brand = get_brand_for_user(pk, request.user)
            if not brand:
                raise Brand.DoesNotExist
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)
        
        days = int(request.data.get('days', 7))
        
        # Import and trigger the task
        from apps.nlp_engine.tasks import generate_brand_summary
        task = generate_brand_summary.delay(brand.id, days)
        
        return Response({
            'message': f'Summary generation initiated for {brand.name}',
            'task_id': task.id
        })


class TopicTrendsView(generics.ListAPIView):
    """List topic trends for a brand"""
    serializer_class = TopicTrendSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        brand_id = self.kwargs.get('pk')
        days = int(self.request.query_params.get('days', 30))
        
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days)
        
        user = self.request.user
        if user.company_ref_id:
            q = Q(brand_id=brand_id, brand__company=user.company_ref)
        else:
            q = Q(brand_id=brand_id, brand__user=user)
        return TopicTrend.objects.filter(q, date__gte=start_date).order_by('-mention_count')[:50]


class DashboardOverviewView(APIView):
    """Get complete dashboard data for all user's brands"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        brands = get_company_brands(request.user).filter(status='active')
        days = int(request.query_params.get('days', 30))
        
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        overview = {
            'total_brands': brands.count(),
            'total_posts': 0,
            'total_alerts': 0,
            'overall_sentiment': 0,
            'brands': []
        }
        
        all_sentiments = []
        
        for brand in brands:
            # Count posts in selected date range (for filtered view)
            posts_in_range = brand.posts.filter(
                posted_at__gte=start_date,
                is_spam=False
            )
            post_count = posts_in_range.count()
            
            # Total across all time
            total_all_time = brand.total_posts if brand.total_posts > 0 else brand.posts.filter(is_spam=False).count()
            
            # Calculate sentiment from processed posts in date range
            processed_in_range = posts_in_range.filter(is_processed=True)
            if processed_in_range.exists():
                avg_sentiment = processed_in_range.aggregate(avg=Avg('sentiment_score'))['avg'] or 0
            else:
                avg_sentiment = brand.avg_sentiment or 0
            
            alerts = BrandAlert.objects.filter(
                brand=brand,
                is_resolved=False
            ).count()
            
            overview['total_posts'] += post_count
            overview['total_alerts'] += alerts
            all_sentiments.append(avg_sentiment)
            
            overview['brands'].append({
                'id': brand.id,
                'name': brand.name,
                'logo': brand.logo.url if brand.logo else None,
                'posts': post_count,
                'total_all_time': total_all_time,
                'sentiment': round(avg_sentiment, 3),
                'alerts': alerts,
                'last_fetch': brand.last_fetch
            })
        
        # Calculate overall sentiment from all brands
        if all_sentiments:
            # Filter out zeros to get more accurate average
            non_zero_sentiments = [s for s in all_sentiments if s != 0]
            if non_zero_sentiments:
                overview['overall_sentiment'] = round(sum(non_zero_sentiments) / len(non_zero_sentiments), 3)
            else:
                overview['overall_sentiment'] = 0.0
        else:
            overview['overall_sentiment'] = 0.0
        
        return Response(overview)

