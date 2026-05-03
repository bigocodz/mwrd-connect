from django.urls import path

from .views.auth import CustomerLoginView, LogoutView, MeView, RefreshView
from .views.leads import ActivateView, OnboardingView, RegisterView
from .views.signup import SignupFromInviteView
from .views.staff_auth import StaffEnrollConfirmView, StaffEnrollStartView, StaffLoginView

urlpatterns = [
    path("login", CustomerLoginView.as_view()),
    path("logout", LogoutView.as_view()),
    path("refresh", RefreshView.as_view()),
    path("me", MeView.as_view()),
    # R2 — public lead/callback signup pipeline
    path("register", RegisterView.as_view()),
    path("activate", ActivateView.as_view()),
    path("onboarding", OnboardingView.as_view()),
    # Legacy invite-based signup (kept for staff-initiated orgs)
    path("signup-from-invite", SignupFromInviteView.as_view()),
    path("staff/login", StaffLoginView.as_view()),
    path("staff/enroll/start", StaffEnrollStartView.as_view()),
    path("staff/enroll/confirm", StaffEnrollConfirmView.as_view()),
]
