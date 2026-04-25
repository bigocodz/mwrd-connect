export const KYC_DOCUMENT_TYPES = [
  { value: "CR_CERTIFICATE", label: "Commercial Registration" },
  { value: "VAT_CERTIFICATE", label: "VAT Certificate" },
  { value: "NATIONAL_ADDRESS", label: "National Address" },
  { value: "BANK_LETTER", label: "Bank Letter / IBAN" },
  { value: "AUTHORIZED_SIGNATORY", label: "Authorized Signatory" },
  { value: "ID_DOCUMENT", label: "ID / Iqama" },
  { value: "OTHER", label: "Other" },
] as const;

export const KYC_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  KYC_DOCUMENT_TYPES.map((t) => [t.value, t.label]),
);

export const KYC_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const KYC_STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export const PROFILE_KYC_LABEL: Record<string, string> = {
  INCOMPLETE: "Incomplete",
  IN_REVIEW: "In review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export const PROFILE_KYC_COLOR: Record<string, string> = {
  INCOMPLETE: "bg-muted text-muted-foreground",
  IN_REVIEW: "bg-amber-100 text-amber-800",
  VERIFIED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};
