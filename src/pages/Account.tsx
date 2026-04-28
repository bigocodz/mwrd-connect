import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import AppShell from "@/components/app/AppShell";
import { ImageUploadCard } from "@/components/admin/ImageUploadCard";
import { NotificationPrefsCard } from "@/components/account/NotificationPrefsCard";
import { Save01 as Save, ArrowLeft, ArrowRight, HomeLine, User01 } from "@untitledui/icons";
import { Loader2 } from "lucide-react";

const navItems = [
  { label: "Account", href: "/account", icon: User01 },
];

const Account = () => {
  const { tr, lang, setLang, dir } = useLanguage();
  const { profile } = useAuth();
  const me = useQuery(api.users.getMyProfile);
  const updateMyPreferences = useMutation(api.users.updateMyPreferences);

  const [language, setLanguagePref] = useState<"ar" | "en">("ar");
  const [showHijri, setShowHijri] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (me) {
      setLanguagePref((me as any).preferred_language ?? "ar");
      setShowHijri((me as any).show_hijri ?? true);
    }
  }, [me?._id]);

  const dirty =
    me &&
    (language !== ((me as any).preferred_language ?? "ar") ||
      showHijri !== ((me as any).show_hijri ?? true));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMyPreferences({
        preferred_language: language,
        show_hijri: showHijri,
      });
      // Also flip the live UI to match the new preference so the change is
      // immediate, not next-login.
      if (language !== lang) setLang(language);
      toast.success(tr("Preferences saved"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setSaving(false);
    }
  };

  // Pick a sensible portal label based on role. AUDITOR (PRD §13.4) shares
  // the admin shell so we surface that here.
  const portalLabel =
    profile?.role === "AUDITOR"
      ? "Audit Portal (read-only)"
      : profile?.role === "ADMIN"
        ? "Admin Portal"
        : profile?.role === "SUPPLIER"
          ? "Supplier Portal"
          : "Client Portal";

  // Where does "back" go? Each portal has its own dashboard.
  const backHref =
    profile?.role === "ADMIN" || profile?.role === "AUDITOR"
      ? "/admin/dashboard"
      : profile?.role === "SUPPLIER"
        ? "/supplier/dashboard"
        : "/client/dashboard";

  return (
    <AppShell navItems={navItems} portalLabel={portalLabel} portalTone="client">
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={backHref}>
              {dir === "rtl" ? <ArrowRight className="w-4 h-4 me-1" /> : <ArrowLeft className="w-4 h-4 me-1" />}
              {tr("Back")}
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{tr("My account")}</h1>
          <p className="text-muted-foreground mt-1">
            {tr("Personal preferences. Stamp + legal entity stay admin-managed.")}
          </p>
        </div>

        {me && (
          <Card>
            <CardHeader>
              <CardTitle>{tr("Profile")}</CardTitle>
              <CardDescription>
                {tr("Read-only summary of your account.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p>
                <span className="text-muted-foreground">{tr("Public ID")}:</span>{" "}
                <span className="font-mono">{(me as any).public_id ?? "—"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">{tr("Role")}:</span>{" "}
                <span className="capitalize">{(me as any).role?.toLowerCase()}</span>
              </p>
              {(me as any).company_name && (
                <p>
                  <span className="text-muted-foreground">{tr("Company")}:</span>{" "}
                  {(me as any).company_name}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{tr("Preferences")}</CardTitle>
            <CardDescription>
              {tr("Choose how the platform looks and how dates are presented.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{tr("Language")}</Label>
              <Select value={language} onValueChange={(v) => setLanguagePref(v as "ar" | "en")}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {tr("Drives both the app interface and outgoing notifications.")}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{tr("Show Hijri dates")}</p>
                <p className="text-xs text-muted-foreground">
                  {tr("Render Hijri alongside Gregorian throughout the app.")}
                </p>
              </div>
              <Switch checked={showHijri} onCheckedChange={setShowHijri} />
            </div>

            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin me-1.5" />
              ) : (
                <Save className="w-4 h-4 me-1.5" />
              )}
              {tr("Save preferences")}
            </Button>
          </CardContent>
        </Card>

        {profile && (
          <Card>
            <CardHeader>
              <CardTitle>{tr("Personal signature")}</CardTitle>
              <CardDescription>
                {tr("Used when you sign approval steps. Snapshotted at sign time so historical documents don't change.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUploadCard profileId={profile._id as any} kind="signature" />
            </CardContent>
          </Card>
        )}

        <NotificationPrefsCard />
      </div>
    </AppShell>
  );
};

export default Account;
