from dataclasses import asdict

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .providers import get_provider


class WathqRecordSerializer(serializers.Serializer):
    cr_number = serializers.CharField()
    legal_name_ar = serializers.CharField()
    legal_name_en = serializers.CharField()
    status = serializers.CharField()
    issue_date = serializers.CharField()
    expiry_date = serializers.CharField(allow_null=True)
    activities = serializers.ListField(child=serializers.CharField())


class WathqErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "WathqError"


class CrLookupView(APIView):
    """Look up a Saudi CR number. Used by the KYC wizard to pre-fill legal
    name etc."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[OpenApiParameter("cr_number", str, OpenApiParameter.QUERY, required=True)],
        responses={
            200: WathqRecordSerializer,
            404: OpenApiResponse(response=WathqErrorSerializer),
        },
        tags=["wathq"],
    )
    def get(self, request):
        cr = request.query_params.get("cr_number") or ""
        record = get_provider().lookup_cr(cr)
        if record is None:
            return Response({"detail": "CR not found"}, status=404)
        return Response(asdict(record))
