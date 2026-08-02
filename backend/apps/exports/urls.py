"""
URL patterns for exports app
"""
from django.urls import path
from . import views

app_name = 'exports'

urlpatterns = [
    path('brands/<int:pk>/posts/', views.ExportPostsView.as_view(), name='export_posts'),
    path('brands/<int:pk>/analytics/', views.ExportAnalyticsView.as_view(), name='export_analytics'),
    path('brands/<int:pk>/pdf-report/', views.ExportPDFReportView.as_view(), name='export_pdf'),
    path('history/', views.ExportHistoryView.as_view(), name='export_history'),
]

