"""
Views for Export Functionality
"""
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import HttpResponse
from django.utils import timezone
from datetime import timedelta

from apps.brands.models import Brand, SocialPost
from apps.analytics.models import SentimentSummary
from .models import ExportJob
from .generators import CSVGenerator, PDFGenerator, ExcelGenerator
from apps.accounts.models import UserActivity


class ExportPostsView(APIView):
    """Export posts data"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        try:
            brand = Brand.objects.get(id=pk, user=request.user)
        except Brand.DoesNotExist:
            return Response(
                {'error': 'Brand not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        export_format = request.data.get('format', 'csv')
        days = int(request.data.get('days', 30))
        sentiment_filter = request.data.get('sentiment')
        platform_filter = request.data.get('platform')
        
        # Get posts
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        posts = brand.posts.filter(
            posted_at__gte=start_date,
            posted_at__lte=end_date,
            is_spam=False
        )
        
        if sentiment_filter:
            posts = posts.filter(sentiment=sentiment_filter)
        if platform_filter:
            posts = posts.filter(platform=platform_filter)
        
        # Convert to list of dicts
        posts_data = list(posts.values(
            'id', 'platform', 'author_name', 'author_username',
            'content', 'sentiment', 'sentiment_score',
            'likes', 'shares', 'comments', 'views',
            'topics', 'posted_at', 'url'
        ))
        
        # Create export job
        export_job = ExportJob.objects.create(
            user=request.user,
            brand=brand,
            export_type='posts',
            format=export_format,
            parameters={
                'days': days,
                'sentiment_filter': sentiment_filter,
                'platform_filter': platform_filter,
                'posts_count': len(posts_data)
            }
        )
        
        try:
            if export_format == 'csv':
                content = CSVGenerator.generate_posts_csv(posts_data)
                response = HttpResponse(content, content_type='text/csv')
                filename = f"{brand.name}_posts_{timezone.now().strftime('%Y%m%d')}.csv"
                response['Content-Disposition'] = f'attachment; filename="{filename}"'
                
            elif export_format == 'excel':
                content = ExcelGenerator.generate_posts_excel(posts_data)
                response = HttpResponse(
                    content,
                    content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                )
                filename = f"{brand.name}_posts_{timezone.now().strftime('%Y%m%d')}.xlsx"
                response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            else:
                return Response(
                    {'error': 'Unsupported format'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            export_job.status = 'completed'
            export_job.completed_at = timezone.now()
            export_job.save()
            
            # Log activity
            UserActivity.objects.create(
                user=request.user,
                action='export',
                description=f'Exported {len(posts_data)} posts for {brand.name}',
                metadata={'brand_id': brand.id, 'format': export_format, 'posts_count': len(posts_data)}
            )
            
            return response
            
        except Exception as e:
            export_job.status = 'failed'
            export_job.error_message = str(e)
            export_job.save()
            
            return Response(
                {'error': f'Export failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ExportAnalyticsView(APIView):
    """Export analytics data"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        try:
            brand = Brand.objects.get(id=pk, user=request.user)
        except Brand.DoesNotExist:
            return Response(
                {'error': 'Brand not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        export_format = request.data.get('format', 'csv')
        days = int(request.data.get('days', 30))
        
        # Get analytics data
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        posts = brand.posts.filter(
            posted_at__gte=start_date,
            posted_at__lte=end_date,
            is_spam=False,
            is_processed=True
        )
        
        total = posts.count()
        positive = posts.filter(sentiment='positive').count()
        neutral = posts.filter(sentiment='neutral').count()
        negative = posts.filter(sentiment='negative').count()
        
        from django.db.models import Avg
        avg_sentiment = posts.aggregate(avg=Avg('sentiment_score'))['avg'] or 0
        
        analytics_data = {
            'total_posts': total,
            'positive': positive,
            'neutral': neutral,
            'negative': negative,
            'positive_pct': positive / total * 100 if total > 0 else 0,
            'neutral_pct': neutral / total * 100 if total > 0 else 0,
            'negative_pct': negative / total * 100 if total > 0 else 0,
            'avg_sentiment': avg_sentiment,
        }
        
        # Get daily breakdown
        from django.db.models.functions import TruncDate
        from django.db.models import Count, Q
        
        daily_data = posts.annotate(
            date=TruncDate('posted_at')
        ).values('date').annotate(
            total=Count('id'),
            positive=Count('id', filter=Q(sentiment='positive')),
            neutral=Count('id', filter=Q(sentiment='neutral')),
            negative=Count('id', filter=Q(sentiment='negative')),
            avg_sentiment=Avg('sentiment_score')
        ).order_by('date')
        
        analytics_data['daily_data'] = list(daily_data)
        
        # Get top topics
        from collections import Counter
        all_topics = []
        for post in posts.exclude(topics=[]):
            all_topics.extend(post.topics)
        topic_counts = Counter(all_topics).most_common(20)
        analytics_data['top_topics'] = [{'topic': t[0], 'count': t[1]} for t in topic_counts]
        
        # Create export job
        export_job = ExportJob.objects.create(
            user=request.user,
            brand=brand,
            export_type='analytics',
            format=export_format,
            parameters={'days': days}
        )
        
        try:
            if export_format == 'csv':
                content = CSVGenerator.generate_analytics_csv(analytics_data)
                response = HttpResponse(content, content_type='text/csv')
                filename = f"{brand.name}_analytics_{timezone.now().strftime('%Y%m%d')}.csv"
                response['Content-Disposition'] = f'attachment; filename="{filename}"'
                
            else:
                return Response(
                    {'error': 'Unsupported format'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            export_job.status = 'completed'
            export_job.completed_at = timezone.now()
            export_job.save()
            
            return response
            
        except Exception as e:
            export_job.status = 'failed'
            export_job.error_message = str(e)
            export_job.save()
            
            return Response(
                {'error': f'Export failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ExportPDFReportView(APIView):
    """Generate PDF report"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        try:
            brand = Brand.objects.get(id=pk, user=request.user)
        except Brand.DoesNotExist:
            return Response(
                {'error': 'Brand not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        days = int(request.data.get('days', 30))
        
        # Get analytics data
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        posts = brand.posts.filter(
            posted_at__gte=start_date,
            posted_at__lte=end_date,
            is_spam=False,
            is_processed=True
        )
        
        total = posts.count()
        positive = posts.filter(sentiment='positive').count()
        neutral = posts.filter(sentiment='neutral').count()
        negative = posts.filter(sentiment='negative').count()
        
        from django.db.models import Avg
        avg_sentiment = posts.aggregate(avg=Avg('sentiment_score'))['avg'] or 0
        
        # Get top topics
        from collections import Counter
        all_topics = []
        for post in posts.exclude(topics=[]):
            all_topics.extend(post.topics)
        topic_counts = Counter(all_topics).most_common(10)
        
        analytics_data = {
            'total_posts': total,
            'positive': positive,
            'neutral': neutral,
            'negative': negative,
            'positive_pct': positive / total * 100 if total > 0 else 0,
            'neutral_pct': neutral / total * 100 if total > 0 else 0,
            'negative_pct': negative / total * 100 if total > 0 else 0,
            'avg_sentiment': avg_sentiment,
            'top_topics': [{'topic': t[0], 'count': t[1]} for t in topic_counts]
        }
        
        # Get latest summary
        summary_data = None
        latest_summary = SentimentSummary.objects.filter(brand=brand).first()
        if latest_summary:
            summary_data = {
                'summary': latest_summary.summary_text,
                'key_insights': latest_summary.key_insights,
                'what_users_like': latest_summary.what_users_like,
                'what_users_dislike': latest_summary.what_users_dislike,
                'platform_analysis': getattr(latest_summary, 'platform_analysis', ''),
                'recommendations': latest_summary.recommendations,
            }
        
        # Add per-platform breakdown for the PDF
        from django.db.models import Count, Q
        platform_stats = posts.values('platform').annotate(
            total=Count('id'),
            positive=Count('id', filter=Q(sentiment='positive')),
            negative=Count('id', filter=Q(sentiment='negative')),
            avg_sentiment=Avg('sentiment_score'),
        ).order_by('-total')
        analytics_data['platform_data'] = list(platform_stats)
        analytics_data['days'] = days
        
        # Create export job
        export_job = ExportJob.objects.create(
            user=request.user,
            brand=brand,
            export_type='summary',
            format='pdf',
            parameters={'days': days}
        )
        
        try:
            content = PDFGenerator.generate_summary_pdf(
                brand.name,
                analytics_data,
                summary_data
            )
            
            response = HttpResponse(content, content_type='application/pdf')
            filename = f"{brand.name}_report_{timezone.now().strftime('%Y%m%d')}.pdf"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            export_job.status = 'completed'
            export_job.completed_at = timezone.now()
            export_job.save()
            
            # Log activity
            UserActivity.objects.create(
                user=request.user,
                action='export',
                description=f'Generated PDF report for {brand.name}',
                metadata={'brand_id': brand.id, 'format': 'pdf'}
            )
            
            return response
            
        except Exception as e:
            export_job.status = 'failed'
            export_job.error_message = str(e)
            export_job.save()
            
            return Response(
                {'error': f'Export failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ExportHistoryView(generics.ListAPIView):
    """List export history"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return ExportJob.objects.filter(user=self.request.user)
    
    def get(self, request):
        exports = self.get_queryset()[:20]
        
        data = []
        for export in exports:
            data.append({
                'id': export.id,
                'brand': export.brand.name if export.brand else None,
                'export_type': export.export_type,
                'format': export.format,
                'status': export.status,
                'parameters': export.parameters,
                'created_at': export.created_at,
                'completed_at': export.completed_at,
            })
        
        return Response(data)

