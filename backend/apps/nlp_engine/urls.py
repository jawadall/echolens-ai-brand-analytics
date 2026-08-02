"""
URL patterns for NLP engine app
"""
from django.urls import path
from . import views

app_name = 'nlp_engine'

urlpatterns = [
    # Analysis endpoints
    path('analyze/', views.AnalyzeTextView.as_view(), name='analyze_text'),
    path('batch-analyze/', views.BatchAnalyzeView.as_view(), name='batch_analyze'),
    
    # Post processing
    path('process-post/<int:pk>/', views.ProcessPostView.as_view(), name='process_post'),
    
    # AI Summaries
    path('brands/<int:pk>/summary/', views.GenerateSummaryView.as_view(), name='generate_summary'),
    path('compare/', views.CompareBrandsView.as_view(), name='compare_brands'),
    
    # Status
    path('status/', views.GeminiStatusView.as_view(), name='gemini_status'),
]

