from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsOrgMember(BasePermission):
    """User must be authenticated and have an active organization in scope."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return getattr(request, "active_organization_id", None) is not None


class IsStaffWithScope(BasePermission):
    """For admin-portal endpoints. Requires is_staff AND token scope=staff."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_staff:
            return False
        return getattr(request, "token_scope", None) == "staff"


class IsOrgRole(BasePermission):
    """Subclass and set `roles` to restrict by org membership role."""

    roles: tuple[str, ...] = ()

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = getattr(request, "active_membership_role", None)
        return role in self.roles


class ReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS
