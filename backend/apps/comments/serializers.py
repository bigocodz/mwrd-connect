from rest_framework import serializers

from .models import Comment


class CommentSerializer(serializers.ModelSerializer):
    author_email = serializers.CharField(source="author.email", read_only=True)
    author_full_name = serializers.CharField(source="author.full_name", read_only=True)
    author_org_name = serializers.CharField(source="author_org.name", read_only=True, default="")
    author_org_type = serializers.CharField(source="author_org.type", read_only=True, default="")

    class Meta:
        model = Comment
        fields = (
            "id", "author", "author_email", "author_full_name",
            "author_org", "author_org_name", "author_org_type",
            "body", "edited_at", "deleted_at", "created_at",
        )
        read_only_fields = (
            "id", "author", "author_email", "author_full_name",
            "author_org", "author_org_name", "author_org_type",
            "edited_at", "deleted_at", "created_at",
        )


class CreateCommentSerializer(serializers.Serializer):
    body = serializers.CharField(min_length=1, max_length=4000)


class CommentsErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "CommentsError"
