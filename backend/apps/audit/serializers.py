from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source="actor.email", read_only=True, default=None)
    target_type = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            "id", "action", "actor_email", "organization",
            "target_type", "target_id",
            "payload", "request_id", "created_at",
        )
        read_only_fields = fields

    def get_target_type(self, obj) -> str:
        return obj.target_ct.model if obj.target_ct_id else ""
