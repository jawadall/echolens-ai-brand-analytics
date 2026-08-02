"""
Echo Lens URL Configuration
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API Endpoints
    path('api/auth/', include('apps.accounts.urls')),
    path('api/brands/', include('apps.brands.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('api/subscriptions/', include('apps.subscriptions.urls')),
    path('api/exports/', include('apps.exports.urls')),
    path('api/nlp/', include('apps.nlp_engine.urls')),
    path('api/connectors/', include('apps.data_connectors.urls')),
    path('api/admin-dashboard/', include('apps.admin_dashboard.urls')),
    
    # JWT Token Refresh
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

