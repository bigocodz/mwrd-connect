from rest_framework import serializers

from apps.organizations.models import Membership, Organization

from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "full_name", "phone", "locale", "must_change_password")
        read_only_fields = fields


class OrganizationBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ("id", "type", "name", "status")
        read_only_fields = fields


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, max_length=200)


class LoginResponseSerializer(serializers.Serializer):
    user = UserSerializer()
    organization = OrganizationBriefSerializer()
    role = serializers.ChoiceField(choices=Membership.Role.choices)


class MeResponseSerializer(serializers.Serializer):
    user = UserSerializer()
    organization = OrganizationBriefSerializer(allow_null=True)
    role = serializers.CharField(allow_null=True)
    scope = serializers.ChoiceField(choices=[("customer", "customer"), ("staff", "staff")])


class StaffLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, max_length=200)
    otp = serializers.CharField(min_length=6, max_length=6)


class StaffLoginResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()


class StaffEnrollStartSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, max_length=200)


class StaffEnrollStartResponseSerializer(serializers.Serializer):
    provisioning_uri = serializers.CharField()
    secret = serializers.CharField()


class StaffEnrollConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, max_length=200)
    otp = serializers.CharField(min_length=6, max_length=6)


class SignupFromInviteSerializer(serializers.Serializer):
    token = serializers.CharField()
    full_name = serializers.CharField(max_length=255)
    password = serializers.CharField(write_only=True, min_length=12, max_length=200)


class ErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "AccountsError"
