# Echo Lens - Brand Monitoring Tool
# FYP Project by Syed Jawad Ali & Saad Shahzad
# Supervised by Dr. Faisal Azam

from __future__ import absolute_import, unicode_literals

# This will make sure the app is always imported when Django starts
from .celery import app as celery_app

__all__ = ('celery_app',)

