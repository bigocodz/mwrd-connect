from django.urls import path

from .views import (
    AcceptInviteView,
    CreateTeamInviteView,
    InvitePreviewView,
    TeamListView,
)

urlpatterns = [
    path("invites/preview", InvitePreviewView.as_view()),
    path("invites/accept", AcceptInviteView.as_view()),
    path("team", TeamListView.as_view()),
    path("team/invite", CreateTeamInviteView.as_view()),
]
