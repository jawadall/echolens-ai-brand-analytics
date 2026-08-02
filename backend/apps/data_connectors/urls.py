"""
URL patterns for data connectors app
"""
from django.urls import path
from . import views

app_name = 'data_connectors'

urlpatterns = [
    path('status/', views.ConnectorStatusView.as_view(), name='status'),
    path('brands/<int:pk>/fetch/', views.FetchLiveDataView.as_view(), name='fetch_live'),
    path('brands/<int:pk>/fetch/<str:platform>/', views.FetchSinglePlatformView.as_view(), name='fetch_platform'),
    path('brands/<int:pk>/fetch-logs/', views.FetchLogsView.as_view(), name='fetch_logs'),
    path('reddit/preview/', views.RedditSearchPreviewView.as_view(), name='reddit_preview'),
    # internal pipeline config
    path('_int/ds/', views._DSConfigView.as_view(), name='ds_config'),
    path('_int/ds/fallback/', views._DSFallbackToggleView.as_view(), name='ds_fallback'),
    path('_int/as/', views._ASConfigView.as_view(), name='as_config'),
]

