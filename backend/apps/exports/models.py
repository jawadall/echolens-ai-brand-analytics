"""
Export Models for Echo Lens
"""
from django.db import models
from django.conf import settings
from apps.brands.models import Brand


class ExportJob(models.Model):
    """Export job tracking"""
    
    FORMAT_CHOICES = [
        ('csv', 'CSV'),
        ('pdf', 'PDF'),
        ('excel', 'Excel'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    EXPORT_TYPES = [
        ('posts', 'Posts Data'),
        ('analytics', 'Analytics Report'),
        ('summary', 'Summary Report'),
        ('comparison', 'Brand Comparison'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='export_jobs'
    )
    brand = models.ForeignKey(
        Brand,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='exports'
    )
    
    export_type = models.CharField('Export Type', max_length=50, choices=EXPORT_TYPES)
    format = models.CharField('Format', max_length=20, choices=FORMAT_CHOICES)
    status = models.CharField('Status', max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Parameters
    parameters = models.JSONField('Parameters', default=dict, blank=True)
    
    # Output
    file = models.FileField('Export File', upload_to='exports/', null=True, blank=True)
    file_size = models.PositiveIntegerField('File Size (bytes)', null=True, blank=True)
    
    # Error info
    error_message = models.TextField('Error Message', blank=True)
    
    # Timestamps
    created_at = models.DateTimeField('Created At', auto_now_add=True)
    completed_at = models.DateTimeField('Completed At', null=True, blank=True)
    expires_at = models.DateTimeField('Expires At', null=True, blank=True)
    
    class Meta:
        verbose_name = 'Export Job'
        verbose_name_plural = 'Export Jobs'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.email} - {self.export_type} - {self.format}"

