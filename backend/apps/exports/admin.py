"""
Admin configuration for exports app
"""
from django.contrib import admin
from .models import ExportJob


@admin.register(ExportJob)
class ExportJobAdmin(admin.ModelAdmin):
    list_display = ['user', 'brand', 'export_type', 'format', 'status', 'created_at', 'completed_at']
    list_filter = ['status', 'format', 'export_type', 'created_at']
    search_fields = ['user__email', 'brand__name']
    readonly_fields = ['created_at', 'completed_at']

