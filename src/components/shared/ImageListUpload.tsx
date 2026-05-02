import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@cvx/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Trash2, Upload } from "lucide-react";

interface ImageListUploadProps {
  label?: string;
  images: string[];
  onChange: (next: string[]) => void;
  /** Max number of images allowed (default 8). */
  max?: number;
  /** Accept attribute for the file input (default `image/*`). */
  accept?: string;
}

/**
 * Reusable image-list field. Each upload pushes a permanent signed URL onto
 * the `images` array. Used by AdminMasterCatalog, AdminBundles, and
 * SupplierProductRequest. Replaces the URL-paste affordance.
 */
export const ImageListUpload = ({
  label,
  images,
  onChange,
  max = 8,
  accept = "image/*",
}: ImageListUploadProps) => {
  const { tr } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const generateUploadUrl = useMutation(api.uploads.generateImageUploadUrl);
  const resolveStorageUrl = useMutation(api.uploads.resolveStorageUrl);

  const handleFile = async (file: File) => {
    if (images.length >= max) {
      toast.error(tr("Image limit reached"));
      return;
    }
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) throw new Error(tr("Upload failed"));
      const { storageId } = await response.json();
      const url = await resolveStorageUrl({ storage_id: storageId });
      if (!url) throw new Error(tr("Could not resolve uploaded image URL"));
      onChange([...images, url]);
    } catch (e: any) {
      toast.error(e?.message ?? tr("Upload failed"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}
      <div className="flex flex-wrap gap-2">
        {images.map((url, i) => (
          <div key={`${url}-${i}`} className="relative">
            <img
              src={url}
              alt=""
              className="w-16 h-16 rounded-lg object-cover border border-border"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <button
              type="button"
              className="absolute -top-1.5 -end-1.5 bg-background border border-border rounded-full p-0.5"
              onClick={() => onChange(images.filter((_, idx) => idx !== i))}
              aria-label={tr("Remove image")}
            >
              <Trash2 className="w-3 h-3 text-destructive" />
            </button>
          </div>
        ))}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy || images.length >= max}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin me-1.5" />
          ) : (
            <Upload className="w-4 h-4 me-1.5" />
          )}
          {tr("Upload image")}
        </Button>
        <span className="ms-2 text-xs text-muted-foreground">
          {images.length}/{max}
        </span>
      </div>
    </div>
  );
};
