from rest_framework import serializers

from .models import Payment, Payout


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = (
            "id", "invoice", "client_org", "amount", "method",
            "reference", "paid_at", "created_at",
        )
        read_only_fields = ("id", "client_org", "created_at")


class PayoutSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payout
        fields = (
            "id", "invoice", "supplier_org", "amount", "method",
            "reference", "paid_at", "created_at",
        )
        read_only_fields = ("id", "supplier_org", "created_at")


class RecordPaymentSerializer(serializers.Serializer):
    invoice_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    method = serializers.ChoiceField(choices=Payment.Method.choices, default=Payment.Method.BANK_TRANSFER)  # noqa: E501
    reference = serializers.CharField(allow_blank=True, default="")


class RecordPayoutSerializer(serializers.Serializer):
    invoice_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    method = serializers.ChoiceField(choices=Payout.Method.choices, default=Payout.Method.BANK_TRANSFER)  # noqa: E501
    reference = serializers.CharField(allow_blank=True, default="")


class PaymentsErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()

    class Meta:
        ref_name = "PaymentsError"


class StatementSerializer(serializers.Serializer):
    type = serializers.CharField()
    org_id = serializers.IntegerField()
    invoices = serializers.ListField(child=serializers.DictField())
    payments = serializers.ListField(child=serializers.DictField(), required=False)
    payouts = serializers.ListField(child=serializers.DictField(), required=False)
