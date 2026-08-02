"""
Role-Based Access Control Permissions for Echo Lens

Roles:
  - admin: Full access (business settings, users, brands, data)
  - analyst: Can create/edit brands, fetch data, manage alerts
  - viewer: Read-only access to dashboards and analytics
"""
from rest_framework.permissions import BasePermission


class IsCompanyAdmin(BasePermission):
    """Only business admins can access this resource"""
    message = 'You need admin privileges to perform this action.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Superadmins always have access
        if request.user.is_staff or request.user.is_superuser:
            return True
        return request.user.role == 'admin'


class IsAnalystOrAbove(BasePermission):
    """Analysts and admins can access this resource (not viewers)"""
    message = 'You need analyst or admin privileges to perform this action.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff or request.user.is_superuser:
            return True
        return request.user.role in ('admin', 'analyst')


class IsReadOnlyOrAnalyst(BasePermission):
    """
    Allow read (GET, HEAD, OPTIONS) for any authenticated user.
    Write operations require analyst or above.
    """
    message = 'Viewers have read-only access.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Safe methods are allowed for everyone
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        # Write methods require analyst+
        if request.user.is_staff or request.user.is_superuser:
            return True
        return request.user.role in ('admin', 'analyst')
