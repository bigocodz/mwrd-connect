from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id", "kind", "title", "body", "payload",
            "read_at", "created_at",
        )
        read_only_fields = fields


class InboxResponseSerializer(serializers.Serializer):
    items = NotificationSerializer(many=True)
    unread = serializers.IntegerField()

    class Meta:
        ref_name = "NotificationsInboxResponse"


class OkResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()

    class Meta:
        ref_name = "NotificationsOkResponse"


class InboxView(APIView):
    """Latest 50 notifications for the current user + unread count."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: InboxResponseSerializer}, tags=["notifications"])
    def get(self, request):
        qs = Notification.objects.filter(user=request.user).order_by("-created_at")[:50]
        unread = Notification.objects.filter(user=request.user, read_at__isnull=True).count()
        return Response({
            "items": NotificationSerializer(qs, many=True).data,
            "unread": unread,
        })


class MarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: NotificationSerializer}, tags=["notifications"])
    def post(self, request, notification_id: int):
        n = get_object_or_404(Notification, id=notification_id, user=request.user)
        if n.read_at is None:
            n.read_at = timezone.now()
            n.save(update_fields=["read_at"])
        return Response(NotificationSerializer(n).data)


class MarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: OkResponseSerializer}, tags=["notifications"])
    def post(self, request):
        Notification.objects.filter(user=request.user, read_at__isnull=True).update(
            read_at=timezone.now(),
        )
        return Response({"ok": True})
