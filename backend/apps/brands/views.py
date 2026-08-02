"""
Views for Brand Management
"""
from rest_framework import generics, status, permissions, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Count, Avg, Q
from datetime import timedelta

from .models import Brand, SocialPost, PostComment, BrandAlert, FetchLog
from .serializers import (
    BrandSerializer, BrandCreateSerializer,
    SocialPostSerializer, SocialPostListSerializer,
    PostCommentSerializer, BrandAlertSerializer, FetchLogSerializer
)
from apps.accounts.models import UserActivity
from .permissions import IsCompanyAdmin, IsAnalystOrAbove, IsReadOnlyOrAnalyst


def get_company_brands(user):
    """Get all brands accessible to this user via their company."""
    if user.company_ref_id:
        return Brand.objects.filter(company=user.company_ref)
    return Brand.objects.filter(user=user)


def get_brand_for_user(pk, user):
    """Get a single brand accessible to this user."""
    if user.company_ref_id:
        return Brand.objects.filter(id=pk, company=user.company_ref).first()
    return Brand.objects.filter(id=pk, user=user).first()


def brand_access_q(user):
    """Return a Q filter for brand access."""
    if user.company_ref_id:
        return Q(brand__company=user.company_ref)
    return Q(brand__user=user)


class FlexiblePagination(PageNumberPagination):
    """Allows frontend to control page size via ?page_size= query param"""
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class BrandListCreateView(generics.ListCreateAPIView):
    """List and create brands"""
    permission_classes = [IsReadOnlyOrAnalyst]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description', 'industry']
    ordering_fields = ['name', 'created_at', 'total_posts', 'avg_sentiment']
    ordering = ['-created_at']
    
    def get_queryset(self):
        return get_company_brands(self.request.user)
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return BrandCreateSerializer
        return BrandSerializer
    
    def perform_create(self, serializer):
        user = self.request.user

        # ── Plan enforcement: check brand limits ──────────────
        current_brands = get_company_brands(user).count()

        if user.company_ref:
            company = user.company_ref
            limits = company.get_plan_limits()
            max_brands = limits['max_brands']
            plan_name = company.plan
        else:
            max_brands = user.get_max_brands()
            plan_name = user.subscription_plan

        if current_brands >= max_brands:
            from rest_framework.response import Response
            from rest_framework import status as http_status
            return Response({
                'error': 'brand_limit_reached',
                'message': f'Your {plan_name.title()} plan allows a maximum of {max_brands} brand{"s" if max_brands != 1 else ""}. '
                           f'You currently have {current_brands}. Please upgrade your plan to add more brands.',
                'limit': max_brands,
                'current': current_brands,
                'plan': plan_name,
            }, status=http_status.HTTP_403_FORBIDDEN)

        brand = serializer.save(company=user.company_ref)
        
        # Log activity
        UserActivity.objects.create(
            user=user,
            action='brand_create',
            description=f'Created brand: {brand.name}',
            metadata={'brand_id': brand.id, 'brand_name': brand.name}
        )


class BrandDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, and delete brands"""
    permission_classes = [IsReadOnlyOrAnalyst]
    serializer_class = BrandSerializer
    
    def get_queryset(self):
        return get_company_brands(self.request.user)
    
    def perform_update(self, serializer):
        brand = serializer.save()
        UserActivity.objects.create(
            user=self.request.user,
            action='brand_update',
            description=f'Updated brand: {brand.name}',
            metadata={'brand_id': brand.id}
        )
    
    def perform_destroy(self, instance):
        brand_name = instance.name
        brand_id = instance.id
        instance.delete()
        UserActivity.objects.create(
            user=self.request.user,
            action='brand_delete',
            description=f'Deleted brand: {brand_name}',
            metadata={'brand_id': brand_id, 'brand_name': brand_name}
        )


class BrandPostsView(generics.ListAPIView):
    """List posts for a specific brand with flexible pagination"""
    serializer_class = SocialPostListSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = FlexiblePagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['platform', 'sentiment', 'is_spam']
    search_fields = ['content', 'author_name', 'author_username']
    ordering_fields = ['posted_at', 'likes', 'shares', 'sentiment_score']
    ordering = ['-posted_at']
    
    def get_queryset(self):
        brand_id = self.kwargs.get('pk')
        brand = get_brand_for_user(brand_id, self.request.user)
        
        if not brand:
            return SocialPost.objects.none()
        
        queryset = brand.posts.filter(is_spam=False)
        
        # Date range filtering
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(posted_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(posted_at__lte=end_date)
        
        # Priority ordering: reddit/news/youtube first, then twitter/facebook
        from django.db.models import Case, When, IntegerField, Value
        queryset = queryset.annotate(
            platform_priority=Case(
                When(platform='reddit', then=Value(1)),
                When(platform='news', then=Value(1)),
                When(platform='youtube', then=Value(1)),
                When(platform='twitter', then=Value(2)),
                When(platform='facebook', then=Value(2)),
                default=Value(3),
                output_field=IntegerField(),
            )
        ).order_by('platform_priority', '-posted_at')
        
        return queryset


class PostDetailView(generics.RetrieveAPIView):
    """Get details of a specific post"""
    serializer_class = SocialPostSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return SocialPost.objects.filter(brand_access_q(self.request.user))


class PostCommentsView(generics.ListAPIView):
    """List comments for a specific post"""
    serializer_class = PostCommentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        post_id = self.kwargs.get('pk')
        user = self.request.user
        if user.company_ref_id:
            return PostComment.objects.filter(post_id=post_id, post__brand__company=user.company_ref)
        return PostComment.objects.filter(post_id=post_id, post__brand__user=user)


class BrandAlertsView(generics.ListAPIView):
    """List alerts for a brand"""
    serializer_class = BrandAlertSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['alert_type', 'severity', 'is_acknowledged', 'is_resolved']
    ordering = ['-created_at']
    
    def get_queryset(self):
        brand_id = self.kwargs.get('pk')
        return BrandAlert.objects.filter(brand_id=brand_id).filter(brand_access_q(self.request.user))


class AlertAcknowledgeView(APIView):
    """Acknowledge an alert"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        try:
            alert = BrandAlert.objects.filter(brand_access_q(request.user)).get(id=pk)
            alert.is_acknowledged = True
            alert.acknowledged_by = request.user
            alert.acknowledged_at = timezone.now()
            alert.save()
            
            return Response({'message': 'Alert acknowledged'})
        except BrandAlert.DoesNotExist:
            return Response(
                {'error': 'Alert not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class AlertResolveView(APIView):
    """Resolve an alert"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        try:
            alert = BrandAlert.objects.filter(brand_access_q(request.user)).get(id=pk)
            alert.is_resolved = True
            alert.resolution_notes = request.data.get('notes', '')
            alert.resolved_at = timezone.now()
            alert.save()
            
            return Response({'message': 'Alert resolved'})
        except BrandAlert.DoesNotExist:
            return Response(
                {'error': 'Alert not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class AllAlertsView(generics.ListAPIView):
    """List all alerts for user's brands"""
    serializer_class = BrandAlertSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['alert_type', 'severity', 'is_acknowledged', 'is_resolved']
    ordering = ['-created_at']
    
    def get_queryset(self):
        return BrandAlert.objects.filter(brand_access_q(self.request.user))


class BrandFetchLogsView(generics.ListAPIView):
    """List fetch logs for a brand"""
    serializer_class = FetchLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    ordering = ['-started_at']
    
    def get_queryset(self):
        brand_id = self.kwargs.get('pk')
        return FetchLog.objects.filter(brand_id=brand_id).filter(brand_access_q(self.request.user))[:50]


class BrandComparisonView(APIView):
    """Compare two brands"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        brand_a_id = request.query_params.get('brand_a')
        brand_b_id = request.query_params.get('brand_b')
        days = int(request.query_params.get('days', 30))
        
        if not brand_a_id or not brand_b_id:
            return Response(
                {'error': 'Both brand_a and brand_b are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            brand_a_obj = get_brand_for_user(brand_a_id, request.user)
            brand_b_obj = get_brand_for_user(brand_b_id, request.user)
            if not brand_a_obj or not brand_b_obj:
                raise Brand.DoesNotExist
            brand_a = brand_a_obj
            brand_b = brand_b_obj
        except Brand.DoesNotExist:
            return Response(
                {'error': 'Brand not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Time range
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        # Get posts for both brands
        posts_a = brand_a.posts.filter(
            posted_at__gte=start_date,
            posted_at__lte=end_date,
            is_spam=False
        )
        posts_b = brand_b.posts.filter(
            posted_at__gte=start_date,
            posted_at__lte=end_date,
            is_spam=False
        )
        
        # Calculate metrics
        def get_metrics(posts):
            total = posts.count()
            processed = posts.filter(is_processed=True)
            processed_count = processed.count()
            
            if processed_count == 0:
                return {
                    'total_posts': total,
                    'positive_ratio': 0,
                    'neutral_ratio': 0,
                    'negative_ratio': 0,
                    'avg_sentiment': 0,
                    'total_engagement': 0,
                }
            
            return {
                'total_posts': total,
                'positive_ratio': processed.filter(sentiment='positive').count() / processed_count,
                'neutral_ratio': processed.filter(sentiment='neutral').count() / processed_count,
                'negative_ratio': processed.filter(sentiment='negative').count() / processed_count,
                'avg_sentiment': processed.aggregate(Avg('sentiment_score'))['sentiment_score__avg'] or 0,
                'total_engagement': sum([
                    posts.aggregate(
                        total=Count('id')
                    ).get('total', 0) for p in ['likes', 'shares', 'comments']
                ]),
            }
        
        metrics_a = get_metrics(posts_a)
        metrics_b = get_metrics(posts_b)
        
        # Share of voice
        total_posts = metrics_a['total_posts'] + metrics_b['total_posts']
        share_of_voice = {
            'brand_a': metrics_a['total_posts'] / total_posts if total_posts > 0 else 0,
            'brand_b': metrics_b['total_posts'] / total_posts if total_posts > 0 else 0,
        }
        
        return Response({
            'brand_a': BrandSerializer(brand_a).data,
            'brand_b': BrandSerializer(brand_b).data,
            'comparison_data': {
                'period': {'start': start_date, 'end': end_date, 'days': days},
                'metrics_a': metrics_a,
                'metrics_b': metrics_b,
                'share_of_voice': share_of_voice,
            }
        })


class TriggerDataFetchView(APIView):
    """Manually trigger data fetch for a brand"""
    permission_classes = [IsAnalystOrAbove]
    
    def post(self, request, pk):
        try:
            brand = get_brand_for_user(pk, request.user)
            if not brand:
                raise Brand.DoesNotExist
            
            # Import and trigger the task
            from apps.data_connectors.tasks import fetch_brand_data
            fetch_brand_data.delay(brand.id)
            
            return Response({
                'message': f'Data fetch initiated for {brand.name}',
                'brand_id': brand.id
            })
        except Brand.DoesNotExist:
            return Response(
                {'error': 'Brand not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

