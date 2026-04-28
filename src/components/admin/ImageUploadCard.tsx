import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import type { Id } from "@cvx/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { Upload01, Trash01 } from "@untitledui/icons";
import { Loader2 } from "lucide-react";

export type ImageUploadKind = "stamp" | "signature";

interface ImageUploadCardProps {
  profileId: Id<"profiles">;
  kind: ImageUploadKind;
}

const ASPECT_HINT: Record<ImageUploadKind, string> = {
  stamp: "PNG/SVG, transparent background recommended, ~400×400 px",
  signature: "PNG, transparent background, ~400×120 px",
};

/**
 * Stamp + signature upload widget for a profile (PRD §6.5, §6.6.3).
 * Used inside LegalEntityPanel; same component renders both kinds.
 */
export const ImageUploadCard = ({ profileId, kind }: ImageUploadCardProps) => {
  const { tr } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const setStamp = useMutation(api.users.setStamp);
  const setSignature = useMutation(api.users.setSignature);
  const clearStamp = useMutation(api.users.clearStamp);
  const clearSignature = useMutation(api.users.clearSignature);

  const url = useQuery(
    kind === "stamp" ? api.users.getStampUrl : api.users.getSignatureUrl,
    { profile_id: profileId },
  );

  const handlePick = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(tr("Please select an image file"));
      return;
    }
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: string };
      if (kind === "stamp") {
        await setStamp({ profile_id: profileId, storage_id: storageId as any });
      } else {
        await setSignature({ profile_id: profileId, storage_id: storageId as any });
      }
      toast.success(
        kind === "stamp" ? tr("Stamp uploaded") : tr("Signature uploaded"),
      );
    } catch (err: any) {
      toast.error(err.message || tr("Upload failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    try {
      if (kind === "stamp") {
        await clearStamp({ profile_id: profileId });
      } else {
        await clearSignature({ profile_id: profileId });
      }
      toast.success(
        kind === "stamp" ? tr("Stamp removed") : tr("Signature removed"),
      );
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const labelKey = kind === "stamp" ? "Company stamp" : "Personal signature";
  const helperKey =
    kind === "stamp"
      ? "Rendered on generated POs and other client-facing documents."
      : "Rendered next to your name when you sign approval steps. Snapshotted at sign time.";

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div>
        <Label className="text-sm font-medium">{tr(labelKey)}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{tr(helperKey)}</p>
      </div>
      <div className="flex items-center gap-3">
        <div
          className={`h-20 w-32 flex items-center justify-center rounded border border-dashed border-border bg-muted/40 overflow-hidden ${
            url ? "border-solid bg-white" : ""
          }`}
        >
          {url ? (
            <img src={url} alt={tr(labelKey)} className="max-h-full max-w-full object-contain" />
          ) : (
            <p className="text-[10px] text-muted-foreground text-center px-2">{tr("No image")}</p>
          )}
        </div>
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePick(file);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 me-1 animate-spin" />
              ) : (
                <Upload01 className="w-3.5 h-3.5 me-1" />
              )}
              {url ? tr("Replace") : tr("Upload")}
            </Button>
            {url && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={handleClear}
              >
                <Trash01 className="w-3.5 h-3.5 me-1" /> {tr("Remove")}
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">{ASPECT_HINT[kind]}</p>
        </div>
      </div>
    </div>
  );
};
