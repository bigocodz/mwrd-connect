from rest_framework import serializers

from .models import KycDocument, KycSubmission


class KycDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = KycDocument
        fields = (
            "id", "kind", "storage_key", "original_filename",
            "content_type", "size_bytes", "uploaded_at",
        )
        read_only_fields = ("id", "uploaded_at")


class KycSubmissionSerializer(serializers.ModelSerializer):
    documents = KycDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = KycSubmission
        fields = (
            "id", "organization", "status",
            "legal_name", "legal_name_ar", "cr_number", "vat_number",
            "address_line1", "address_line2", "city", "country",
            "submitted_at", "reviewed_at", "review_notes",
            "documents",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "organization", "status",
            "submitted_at", "reviewed_at", "review_notes",
            "documents", "created_at", "updated_at",
        )


class SignedUploadRequestSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=KycDocument.Kind.choices)
    filename = serializers.CharField(max_length=255)
    content_type = serializers.CharField(max_length=128)


class SignedUploadResponseSerializer(serializers.Serializer):
    upload = serializers.DictField()
    storage_key = serializers.CharField()


class AttachDocumentSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=KycDocument.Kind.choices)
    storage_key = serializers.CharField(max_length=512)
    original_filename = serializers.CharField(max_length=255)
    content_type = serializers.CharField(max_length=128)
    size_bytes = serializers.IntegerField(min_value=0, default=0)


class ReviewActionSerializer(serializers.Serializer):
    notes = serializers.CharField(max_length=2000, allow_blank=True, default="")


class ErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "KycError"
