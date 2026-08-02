"""
URL patterns for brands app
"""
from django.urls import path
from . import views

app_name = 'brands'

urlpatterns = [
    # Brands CRUD
    path('', views.BrandListCreateView.as_view(), name='brand_list'),
    path('<int:pk>/', views.BrandDetailView.as_view(), name='brand_detail'),
    
    # Brand posts
    path('<int:pk>/posts/', views.BrandPostsView.as_view(), name='brand_posts'),
    
    # Alerts
    path('<int:pk>/alerts/', views.BrandAlertsView.as_view(), name='brand_alerts'),
    path('alerts/', views.AllAlertsView.as_view(), name='all_alerts'),
    path('alerts/<int:pk>/acknowledge/', views.AlertAcknowledgeView.as_view(), name='alert_acknowledge'),
    path('alerts/<int:pk>/resolve/', views.AlertResolveView.as_view(), name='alert_resolve'),
    
    # Fetch logs
    path('<int:pk>/fetch-logs/', views.BrandFetchLogsView.as_view(), name='brand_fetch_logs'),
    
    # Post details
    path('posts/<int:pk>/', views.PostDetailView.as_view(), name='post_detail'),
    path('posts/<int:pk>/comments/', views.PostCommentsView.as_view(), name='post_comments'),
    
    # Comparison
    path('compare/', views.BrandComparisonView.as_view(), name='brand_comparison'),
    
    # Manual fetch trigger
    path('<int:pk>/fetch/', views.TriggerDataFetchView.as_view(), name='trigger_fetch'),
]

