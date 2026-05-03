from django.urls import path

from .views import (
    CreateOrgWithInviteView,
    OrgArchiveView,
    OrgDetailView,
    OrgListView,
    OrgSuspendView,
    OrgUnsuspendView,
    StaffCompleteCallbackView,
    StaffLeadsListView,
    StaffRejectLeadView,
)

urlpatterns = [
    path("orgs", OrgListView.as_view()),
    path("orgs/create", CreateOrgWithInviteView.as_view()),
    path("orgs/<int:org_id>", OrgDetailView.as_view()),
    path("orgs/<int:org_id>/suspend", OrgSuspendView.as_view()),
    path("orgs/<int:org_id>/unsuspend", OrgUnsuspendView.as_view()),
    path("orgs/<int:org_id>/archive", OrgArchiveView.as_view()),
    # R2 — leads queue
    path("leads", StaffLeadsListView.as_view()),
    path("leads/<int:lead_id>/complete-callback", StaffCompleteCallbackView.as_view()),
    path("leads/<int:lead_id>/reject", StaffRejectLeadView.as_view()),
]
