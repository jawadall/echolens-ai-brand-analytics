from django.contrib import admin
from .models import SystemSetting, AuditLog


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ['key', 'category', 'value_type', 'is_sensitive', 'updated_at']
    list_filter = ['category', 'value_type', 'is_sensitive']
    search_fields = ['key', 'description']
    readonly_fields = ['updated_at']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'target', 'created_at']
    list_filter = ['action']
    search_fields = ['description', 'target']
    readonly_fields = ['created_at']
