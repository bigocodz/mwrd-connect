import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, FileSearch01 } from "@untitledui/icons";

interface DocumentsPanelProps {
  targetType: "order" | "quote" | "client_invoice" | "grn";
  targetId: string;
}

type Lang = "bilingual" | "ar" | "en";

/**
 * Generate + browse document artifacts for any target. Today wired only
 * for orders (client_po template); the same component handles other types
 * once their templates land.
 */
export const DocumentsPanel = ({ targetType, targetId }: DocumentsPanelProps) => {
  const { tr, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-SA" : "en-SA";

  const docs = useQuery(api.documents.listForTarget, {
    target_type: targetType,
    target_id: targetId,
  }) as any[] | undefined;
  const generateForOrder = useMutation(api.documents.generateForOrder);
  const generateForInvoice = useMutation(api.documents.generateForInvoice);
  const generateForGrn = useMutation(api.documents.generateForGrn);
  const generateForQuote = useMutation(api.documents.generateForQuote);

  const [language, setLanguage] = useState<Lang>("bilingual");
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState<any | null>(null);

  const handleGenerate = async () => {
    setBusy(true);
    try {
      let r: { version: number };
      if (targetType === "order") {
        r = await generateForOrder({ order_id: targetId as any, language });
      } else if (targetType === "client_invoice") {
        r = await generateForInvoice({ invoice_id: targetId as any, language });
      } else if (targetType === "grn") {
        r = await generateForGrn({ grn_id: targetId as any, language });
      } else if (targetType === "quote") {
        r = await generateForQuote({ quote_id: targetId as any, language });
      } else {
        toast.error(tr("Document generation isn't wired for this entity yet"));
        return;
      }
      toast.success(tr("Document v{n} generated", { n: r.version }));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>{tr("Documents")}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {tr("Versioned, hash-stamped artifacts. Each regeneration creates a new version.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={language} onValueChange={(v) => setLanguage(v as Lang)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bilingual">{tr("Bilingual")}</SelectItem>
              <SelectItem value="ar">{tr("Arabic only")}</SelectItem>
              <SelectItem value="en">{tr("English only")}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleGenerate} disabled={busy}>
            <Plus className="w-3.5 h-3.5 me-1" /> {tr("Generate")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {docs === undefined ? (
          <p className="text-sm text-muted-foreground">{tr("Loading…")}</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {tr("No documents generated yet.")}
          </p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d: any) => (
              <li
                key={d._id}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{d.title}</span>
                    <Badge variant="outline">v{d.version}</Badge>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {d.language}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[10px]" title={d.content_hash}>
                      {d.content_hash.slice(0, 8)}…
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tr("Generated")} {new Date(d._creationTime).toLocaleString(locale)}
                  </p>
                  {d.notes && <p className="text-xs mt-1">{d.notes}</p>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPreviewing(d)}
                >
                  <FileSearch01 className="w-3.5 h-3.5 me-1" /> {tr("Preview")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={previewing !== null} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {previewing?.title} · v{previewing?.version}
            </DialogTitle>
          </DialogHeader>
          {previewing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="font-mono" title={previewing.content_hash}>
                  SHA-256: {previewing.content_hash.slice(0, 16)}…
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const blob = new Blob([previewing.content_html], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank", "noopener");
                    setTimeout(() => URL.revokeObjectURL(url), 60_000);
                  }}
                >
                  {tr("Open in new tab")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const blob = new Blob([previewing.content_html], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${previewing.title}-v${previewing.version}.html`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 60_000);
                  }}
                >
                  {tr("Download")}
                </Button>
              </div>
              <iframe
                title="document preview"
                srcDoc={previewing.content_html}
                className="h-[70vh] w-full rounded border border-border"
                sandbox="allow-same-origin"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
