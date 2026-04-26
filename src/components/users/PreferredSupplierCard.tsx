import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@cvx/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Star01 } from "@untitledui/icons";
import { useLanguage } from "@/contexts/LanguageContext";

type Props = {
  profile: {
    _id: string;
    is_preferred?: boolean;
    preferred_note?: string;
    preferred_at?: number;
  };
};

export const PreferredSupplierCard = ({ profile }: Props) => {
  const { tr } = useLanguage();
  const setPreferred = useMutation(api.users.setPreferredSupplier);
  const [enabled, setEnabled] = useState(!!profile.is_preferred);
  const [note, setNote] = useState(profile.preferred_note ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnabled(!!profile.is_preferred);
    setNote(profile.preferred_note ?? "");
  }, [profile._id, profile.is_preferred, profile.preferred_note]);

  const handleToggle = async (next: boolean) => {
    setEnabled(next);
    setBusy(true);
    try {
      await setPreferred({ id: profile._id as any, is_preferred: next, note: next ? note.trim() || undefined : undefined });
      toast.success(next ? tr("Marked as preferred") : tr("Removed from preferred"));
    } catch (err: any) {
      setEnabled(!next);
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveNote = async () => {
    setBusy(true);
    try {
      await setPreferred({ id: profile._id as any, is_preferred: true, note: note.trim() || undefined });
      toast.success(tr("Note saved"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Star01 className="w-4 h-4" /> {tr("Preferred Supplier")}
          </CardTitle>
          {profile.is_preferred && (
            <Badge variant="outline" className="bg-amber-100 text-amber-800">{tr("Preferred")}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Switch checked={enabled} onCheckedChange={handleToggle} disabled={busy} />
          <span className="text-sm text-muted-foreground">
            {tr("Preferred suppliers are surfaced first in client suggestions and admin leaderboards.")}
          </span>
        </div>
        {enabled && (
          <>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tr("Optional context (why preferred, categories, terms)…")}
            />
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={handleSaveNote} disabled={busy}>{tr("Save note")}</Button>
              {profile.preferred_at && (
                <span className="text-xs text-muted-foreground">
                  {tr("Marked")} {new Date(profile.preferred_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
