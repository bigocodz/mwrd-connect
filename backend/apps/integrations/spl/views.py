from dataclasses import asdict

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .providers import get_provider


class SplAddressSerializer(serializers.Serializer):
    short_code = serializers.CharField()
    building_number = serializers.CharField()
    street = serializers.CharField()
    district = serializers.CharField()
    city = serializers.CharField()
    region = serializers.CharField()
    postal_code = serializers.CharField()
    additional_number = serializers.CharField()
    latitude = serializers.FloatField(allow_null=True)
    longitude = serializers.FloatField(allow_null=True)


class SplErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "SplError"


class ShortCodeLookupView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[OpenApiParameter("code", str, OpenApiParameter.QUERY, required=True)],
        responses={
            200: SplAddressSerializer,
            404: OpenApiResponse(response=SplErrorSerializer),
        },
        tags=["spl"],
    )
    def get(self, request):
        code = request.query_params.get("code") or ""
        addr = get_provider().resolve_short_code(code)
        if addr is None:
            return Response({"detail": "Address not found"}, status=404)
        return Response(asdict(addr))
