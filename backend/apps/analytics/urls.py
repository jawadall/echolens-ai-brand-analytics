"""
URL patterns for analytics app
"""
from django.urls import path
from . import views

app_name = 'analytics'

urlpatterns = [
    # Dashboard
    path('dashboard/', views.DashboardOverviewView.as_view(), name='dashboard'),
    
    # Brand-specific analytics
    path('brands/<int:pk>/overview/', views.BrandOverviewView.as_view(), name='brand_overview'),
    path('brands/<int:pk>/trends/', views.SentimentTrendsView.as_view(), name='sentiment_trends'),
    path('brands/<int:pk>/platforms/', views.PlatformBreakdownView.as_view(), name='platform_breakdown'),
    path('brands/<int:pk>/top-posts/', views.TopPostsView.as_view(), name='top_posts'),
    path('brands/<int:pk>/wordcloud/', views.WordCloudDataView.as_view(), name='wordcloud'),
    path('brands/<int:pk>/emotions/', views.EmotionAnalysisView.as_view(), name='emotions'),
    path('brands/<int:pk>/topics/', views.TopicTrendsView.as_view(), name='topic_trends'),
    
    # Summaries
    path('brands/<int:pk>/summaries/', views.SentimentSummaryListView.as_view(), name='summaries'),
    path('brands/<int:pk>/generate-summary/', views.GenerateSummaryView.as_view(), name='generate_summary'),
]

