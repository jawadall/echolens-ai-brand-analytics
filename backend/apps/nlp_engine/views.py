"""
Views for NLP Engine API
"""
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from datetime import timedelta

from apps.brands.models import Brand, SocialPost
from apps.brands.views import get_brand_for_user, brand_access_q
from apps.analytics.models import SentimentSummary
from .processor import nlp_processor
from .gemini_client import gemini_client


class AnalyzeTextView(APIView):
    """Analyze text using NLP pipeline"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        text = request.data.get('text')
        brand_keywords = request.data.get('brand_keywords', [])
        
        if not text:
            return Response(
                {'error': 'Text is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        result = nlp_processor.process(text, brand_keywords)
        
        return Response({
            'original_text': text,
            'analysis': result
        })


class BatchAnalyzeView(APIView):
    """Batch analyze multiple texts"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        texts = request.data.get('texts', [])
        brand_keywords = request.data.get('brand_keywords', [])
        
        if not texts:
            return Response(
                {'error': 'Texts array is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        results = []
        for text in texts[:50]:  # Limit to 50
            result = nlp_processor.process(text, brand_keywords)
            results.append({
                'original_text': text[:200],
                'analysis': result
            })
        
        return Response({
            'count': len(results),
            'results': results
        })


class GenerateSummaryView(APIView):
    """Generate AI-powered brand summary"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        brand = get_brand_for_user(pk, request.user)
        if not brand:
            return Response(
                {'error': 'Brand not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        days = int(request.data.get('days', 7))
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        # Get posts
        posts = brand.posts.filter(
            posted_at__gte=start_date,
            posted_at__lte=end_date,
            is_spam=False,
            is_processed=True
        )
        
        if posts.count() == 0:
            return Response(
                {'error': 'No processed posts found for the specified period'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Prepare posts data with all necessary fields
        posts_data = []
        for post in posts:
            posts_data.append({
                'content': post.content,
                'sentiment': post.sentiment,
                'sentiment_score': post.sentiment_score or 0.0,
                'topics': post.topics or [],
                'emotions': post.emotions or {},
                'likes': post.likes or 0,
                'shares': post.shares or 0,
                'comments': post.comments or 0,
                'views': post.views or 0,
                'platform': post.platform,
                'author_username': post.author_username or '',
                'posted_at': post.posted_at.isoformat() if post.posted_at else None,
            })
        
        # Generate summary — ensure Gemini is available by re-resolving key
        gemini_client.ensure_initialized()
        
        summary_data = gemini_client.generate_brand_summary(
            brand.name,
            posts_data,
            days
        )
        
        # Save summary
        summary = SentimentSummary.objects.create(
            brand=brand,
            summary_type='custom',
            start_date=start_date.date(),
            end_date=end_date.date(),
            summary_text=summary_data.get('summary', ''),
            key_insights=summary_data.get('key_insights', []),
            what_users_like=summary_data.get('what_users_like', ''),
            what_users_dislike=summary_data.get('what_users_dislike', ''),
            platform_analysis=summary_data.get('platform_analysis', ''),
            recommendations=summary_data.get('recommendations', []),
            metrics_snapshot={
                'total_posts': posts.count(),
                'positive': posts.filter(sentiment='positive').count(),
                'neutral': posts.filter(sentiment='neutral').count(),
                'negative': posts.filter(sentiment='negative').count(),
                'gemini_available': gemini_client.is_available(),
            }
        )
        
        return Response({
            'id': summary.id,
            'brand': brand.name,
            'period': {'start': start_date, 'end': end_date, 'days': days},
            'summary': summary_data
        })


class CompareBrandsView(APIView):
    """Compare two brands using AI"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        brand_a_id = request.data.get('brand_a')
        brand_b_id = request.data.get('brand_b')
        days = int(request.data.get('days', 30))
        
        if not brand_a_id or not brand_b_id:
            return Response(
                {'error': 'Both brand_a and brand_b are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            brand_a = get_brand_for_user(brand_a_id, request.user)
            brand_b = get_brand_for_user(brand_b_id, request.user)
            if not brand_a or not brand_b:
                raise Brand.DoesNotExist
        except Brand.DoesNotExist:
            return Response(
                {'error': 'Brand not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        # Get posts for both brands
        posts_a = list(brand_a.posts.filter(
            posted_at__gte=start_date,
            is_spam=False,
            is_processed=True
        ).values('content', 'sentiment', 'sentiment_score', 'topics'))
        
        posts_b = list(brand_b.posts.filter(
            posted_at__gte=start_date,
            is_spam=False,
            is_processed=True
        ).values('content', 'sentiment', 'sentiment_score', 'topics'))
        
        # Generate comparison
        comparison = gemini_client.compare_brands(
            brand_a.name,
            brand_b.name,
            posts_a,
            posts_b
        )
        
        return Response({
            'brand_a': {'id': brand_a.id, 'name': brand_a.name, 'posts_count': len(posts_a)},
            'brand_b': {'id': brand_b.id, 'name': brand_b.name, 'posts_count': len(posts_b)},
            'period': {'start': start_date, 'end': end_date, 'days': days},
            'comparison': comparison
        })


class ProcessPostView(APIView):
    """Process a single post through NLP"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        try:
            post = SocialPost.objects.filter(brand_access_q(request.user)).get(id=pk)
        except SocialPost.DoesNotExist:
            return Response(
                {'error': 'Post not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Process through NLP
        brand_keywords = post.brand.get_all_keywords()
        result = nlp_processor.process(post.content, brand_keywords)
        
        # Update post
        post.content_cleaned = result['cleaned_text']
        post.language = result['language']
        post.sentiment = result['sentiment']
        post.sentiment_score = result['sentiment_score']
        post.sentiment_confidence = result['sentiment_confidence']
        post.emotions = result['emotions']
        post.topics = result['topics']
        post.aspects = result['aspects']
        post.is_spam = result['is_spam']
        post.is_processed = True
        post.processed_at = timezone.now()
        post.save()
        
        return Response({
            'post_id': post.id,
            'analysis': result
        })


class GeminiStatusView(APIView):
    """Check Gemini API status and test connection"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        is_available = gemini_client.is_available()
        status_info = {
            'available': is_available,
            'api_key_configured': bool(gemini_client.api_key),
            'model_initialized': gemini_client._initialized,
        }
        
        # Validate key without consuming generation quota
        if is_available and hasattr(gemini_client, '_genai'):
            try:
                models = list(gemini_client._genai.list_models())
                status_info['test_successful'] = True
                status_info['test_response'] = f'API key valid — {len(models)} models available'
            except Exception as e:
                status_info['test_successful'] = False
                status_info['test_error'] = str(e)
        
        return Response(status_info)

