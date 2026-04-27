import { useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@cvx/api";
import type { Id } from "@cvx/dataModel";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { Save, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

interface LegalEntityPanelProps {
  profile: any;
}

const KSA_VAT_REGEX = /^3\d{14}$/; // 15 digits, starts with 3 (Saudi format)
const KSA_CR_REGEX = /^\d{10}$/;   // 10-digit CR

/**
 * Admin panel for legal-entity fields on a profile (PRD §3.2.1, §11.1, §8.3).
 * Captures bilingual legal name, CR, VAT, National Address (SPL fields),
 * and supplier banking. Used by Wafeq's `ensureContact` payload and ZATCA
 * tax invoice clearance.
 *
 * Self-contained: owns its own form state + save mutation. Sits on
 * AdminUserDetail without touching the existing "Save Changes" flow.
 */
export const LegalEntityPanel = ({ profile }: LegalEntityPanelProps) => {
  const { tr } = useLanguage();
  const updateProfile = useMutation(api.users.updateProfile);
  const submitToWafeq = useAction(api.wafeq.ensureContact);
  const verifyByCR = useAction(api.wathq.verifyByCR);

  const isSupplier = profile?.role === "SUPPLIER";

  const [legalNameAr, setLegalNameAr] = useState("");
  const [legalNameEn, setLegalNameEn] = useState("");
  const [crNumber, setCrNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [addr, setAddr] = useState({
    building_number: "",
    street: "",
    district: "",
    city: "",
    postal_code: "",
    additional_number: "",
  });
  const [iban, setIban] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankHolder, setBankHolder] = useState("");

  const [saving, setSaving] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setLegalNameAr(profile.legal_name_ar ?? "");
    setLegalNameEn(profile.legal_name_en ?? "");
    setCrNumber(profile.cr_number ?? "");
    setVatNumber(profile.vat_number ?? "");
    setAddr({
      building_number: profile.national_address?.building_number ?? "",
      street: profile.national_address?.street ?? "",
      district: profile.national_address?.district ?? "",
      city: profile.national_address?.city ?? "",
      postal_code: profile.national_address?.postal_code ?? "",
      additional_number: profile.national_address?.additional_number ?? "",
    });
    setIban(profile.iban ?? "");
    setBankName(profile.bank_name ?? "");
    setBankHolder(profile.bank_account_holder ?? "");
  }, [profile?._id]);

  const validate = () => {
    if (vatNumber && !KSA_VAT_REGEX.test(vatNumber)) {
      toast.error(tr("VAT number must be 15 digits starting with 3"));
      return false;
    }
    if (crNumber && !KSA_CR_REGEX.test(crNumber)) {
      toast.error(tr("CR number must be 10 digits"));
      return false;
    }
    return true;
  };

  const buildPayload = () => {
    const trimAddr = Object.fromEntries(
      Object.entries(addr).map(([k, v]) => [k, v.trim() || undefined]),
    );
    const hasAddr = Object.values(trimAddr).some(Boolean);
    return {
      id: profile._id as Id<"profiles">,
      legal_name_ar: legalNameAr.trim() || null,
      legal_name_en: legalNameEn.trim() || null,
      cr_number: crNumber.trim() || null,
      vat_number: vatNumber.trim() || null,
      national_address: hasAddr ? (trimAddr as any) : null,
      iban: iban.trim() || null,
      bank_name: bankName.trim() || null,
      bank_account_holder: bankHolder.trim() || null,
    };
  };

  const handleSave = async () => {
    if (!profile) return;
    if (!validate()) return;
    setSaving(true);
    try {
      await updateProfile(buildPayload() as any);
      toast.success(tr("Legal entity saved"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyWathq = async () => {
    if (!profile) return;
    const cr = crNumber.trim();
    if (!cr) {
      toast.error(tr("Enter a CR number first"));
      return;
    }
    if (!KSA_CR_REGEX.test(cr)) {
      toast.error(tr("CR number must be 10 digits"));
      return;
    }
    setVerifying(true);
    try {
      // Save the entered CR first so the action reads from a consistent store
      // (lets admin verify newly-typed CR numbers without first hitting Save).
      if (cr !== (profile.cr_number ?? "")) {
        await updateProfile({ id: profile._id, cr_number: cr } as any);
      }
      const result = await verifyByCR({ profile_id: profile._id, cr_number: cr });
      if (result.status === "VERIFIED") {
        toast.success(
          result.environment === "mock"
            ? tr("Verified (mock mode)")
            : tr("Verified with Wathq"),
        );
      } else if (result.status === "MISMATCH") {
        toast.error(
          tr("Wathq returned a different legal name: {name}", {
            name: result.legalNameAr ?? "—",
          }),
        );
      } else if (result.status === "NOT_FOUND") {
        toast.error(tr("CR not found in Wathq"));
      } else {
        toast.error(result.errorMessage ?? tr("Verification failed"));
      }
    } catch (err: any) {
      toast.error(err.message || tr("Verification failed"));
    } finally {
      setVerifying(false);
    }
  };

  const handleResyncWafeq = async () => {
    if (!profile) return;
    setResyncing(true);
    try {
      const result = await submitToWafeq({ profile_id: profile._id });
      if (result.ok) {
        toast.success(tr("Wafeq contact synced"));
      } else {
        toast.error(result.errorMessage || tr("Wafeq submission failed"));
      }
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setResyncing(false);
    }
  };

  if (!profile) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>{tr("Legal Entity")}</CardTitle>
            <CardDescription>
              {tr("Used for ZATCA tax invoices, Wafeq contact, and KYC verification.")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {profile.wathq_status && (
              <Badge
                variant="outline"
                className={
                  profile.wathq_status === "VERIFIED"
                    ? "bg-green-100 text-green-800"
                    : profile.wathq_status === "MISMATCH"
                      ? "bg-red-100 text-red-800"
                      : ""
                }
              >
                {tr("Wathq")}: {tr(profile.wathq_status)}
              </Badge>
            )}
            {profile.wafeq_contact_id ? (
              <Badge variant="outline" className="bg-green-100 text-green-800">
                {tr("Wafeq linked")}
              </Badge>
            ) : (
              <Badge variant="outline">{tr("Wafeq not linked")}</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{tr("Legal name (Arabic)")}</Label>
            <Input dir="rtl" value={legalNameAr} onChange={(e) => setLegalNameAr(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("Legal name (English)")}</Label>
            <Input value={legalNameEn} onChange={(e) => setLegalNameEn(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{tr("Commercial Registration (CR)")}</Label>
            <Input
              value={crNumber}
              onChange={(e) => setCrNumber(e.target.value.replace(/\s/g, ""))}
              placeholder="1010XXXXXX"
              maxLength={10}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("VAT number")}</Label>
            <Input
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value.replace(/\s/g, ""))}
              placeholder="3XXXXXXXXXXXXX1"
              maxLength={15}
              inputMode="numeric"
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">{tr("National Address")}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{tr("Building #")}</Label>
              <Input value={addr.building_number} onChange={(e) => setAddr({ ...addr, building_number: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">{tr("Street")}</Label>
              <Input value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tr("District")}</Label>
              <Input value={addr.district} onChange={(e) => setAddr({ ...addr, district: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tr("City")}</Label>
              <Input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tr("Postal code")}</Label>
              <Input value={addr.postal_code} onChange={(e) => setAddr({ ...addr, postal_code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tr("Additional #")}</Label>
              <Input value={addr.additional_number} onChange={(e) => setAddr({ ...addr, additional_number: e.target.value })} />
            </div>
          </div>
        </div>

        {isSupplier && (
          <div>
            <p className="text-sm font-medium mb-2">{tr("Banking (supplier KYC)")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">{tr("IBAN")}</Label>
                <Input
                  value={iban}
                  onChange={(e) => setIban(e.target.value.toUpperCase().replace(/\s/g, ""))}
                  placeholder="SA00 0000 0000 0000 0000 0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{tr("Bank name")}</Label>
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label className="text-xs">{tr("Account holder")}</Label>
                <Input value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : <Save className="w-4 h-4 me-1.5" />}
            {tr("Save legal entity")}
          </Button>
          <Button variant="outline" onClick={handleVerifyWathq} disabled={verifying || !crNumber}>
            {verifying ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : <ShieldCheck className="w-4 h-4 me-1.5" />}
            {tr("Verify with Wathq")}
          </Button>
          <Button variant="outline" onClick={handleResyncWafeq} disabled={resyncing}>
            {resyncing ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : <RefreshCw className="w-4 h-4 me-1.5" />}
            {profile.wafeq_contact_id ? tr("Re-sync to Wafeq") : tr("Sync to Wafeq")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
