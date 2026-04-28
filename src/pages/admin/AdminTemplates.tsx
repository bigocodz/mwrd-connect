import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  renderTemplatePreview,
  SAMPLE_DOCUMENT_CONTEXTS,
  SAMPLE_NOTIFICATION_CONTEXT,
} from "@/lib/templatePreview";

type DocTemplate = {
  _id: string;
  key: string;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  bilingual_layout: "SIDE_BY_SIDE" | "AR_ONLY" | "EN_ONLY";
  description?: string;
  notes?: string;
};

type NotifTemplate = {
  _id: string;
  event_type: string;
  subject_ar: string;
  subject_en: string;
  body_ar: string;
  body_en: string;
  description?: string;
  notes?: string;
};

const AdminTemplates = () => {
  const { tr } = useLanguage();
  const docTemplates = useQuery(api.documents.listTemplates) as DocTemplate[] | undefined;
  const notifTemplates = useQuery(api.notificationTemplates.list) as NotifTemplate[] | undefined;
  const seedDocs = useMutation(api.documents.seed);
  const seedNotifs = useMutation(api.notificationTemplates.seed);
  const updateDoc = useMutation(api.documents.updateTemplate);
  const updateNotif = useMutation(api.notificationTemplates.update);

  const [editingDoc, setEditingDoc] = useState<DocTemplate | null>(null);
  const [editingNotif, setEditingNotif] = useState<NotifTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSeedDocs = async () => {
    setBusy(true);
    try {
      const r = await seedDocs({});
      toast.success(tr("Seeded {n} document templates", { n: r.inserted }));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleSeedNotifs = async () => {
    setBusy(true);
    try {
      const r = await seedNotifs({});
      toast.success(tr("Seeded {n} notification templates", { n: r.inserted }));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{tr("Templates")}</h1>
          <p className="text-muted-foreground mt-1">
            {tr("Bilingual templates for documents and cross-channel notifications.")}
          </p>
        </div>

        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="documents">
              {tr("Documents")}
              {docTemplates && (
                <Badge variant="secondary" className="ms-2">{docTemplates.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notifications">
              {tr("Notifications")}
              {notifTemplates && (
                <Badge variant="secondary" className="ms-2">{notifTemplates.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents">
            <Card>
              <CardContent className="p-3">
                <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs text-muted-foreground">
                    {tr("Used by the document engine to render POs, invoices, GRNs and quotes.")}
                  </p>
                  <Button size="sm" variant="outline" onClick={handleSeedDocs} disabled={busy}>
                    {tr("Install missing defaults")}
                  </Button>
                </div>
                {docTemplates === undefined ? (
                  <p className="p-4 text-sm text-muted-foreground">{tr("Loading…")}</p>
                ) : docTemplates.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      {tr("No document templates yet.")}
                    </p>
                    <Button size="sm" onClick={handleSeedDocs} disabled={busy}>
                      {tr("Install defaults")}
                    </Button>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {docTemplates.map((t) => (
                      <li key={t._id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{t.key}</span>
                            <Badge variant="outline" className="text-[10px]">{t.bilingual_layout}</Badge>
                          </div>
                          <p className="font-medium mt-0.5">
                            {t.title_en}
                            <span className="ms-2 text-sm text-muted-foreground">{t.title_ar}</span>
                          </p>
                          {t.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                          )}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setEditingDoc(t)}>
                          {tr("Edit")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardContent className="p-3">
                <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs text-muted-foreground">
                    {tr("Used to render emails (and later SMS / WhatsApp) per event type.")}
                  </p>
                  <Button size="sm" variant="outline" onClick={handleSeedNotifs} disabled={busy}>
                    {tr("Install missing defaults")}
                  </Button>
                </div>
                {notifTemplates === undefined ? (
                  <p className="p-4 text-sm text-muted-foreground">{tr("Loading…")}</p>
                ) : notifTemplates.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      {tr("No notification templates yet.")}
                    </p>
                    <Button size="sm" onClick={handleSeedNotifs} disabled={busy}>
                      {tr("Install defaults")}
                    </Button>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {notifTemplates.map((t) => (
                      <li key={t._id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <span className="font-mono text-xs">{t.event_type}</span>
                          <p className="font-medium mt-0.5">
                            {t.subject_en}
                            <span className="ms-2 text-sm text-muted-foreground">{t.subject_ar}</span>
                          </p>
                          {t.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                          )}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setEditingNotif(t)}>
                          {tr("Edit")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {editingDoc && (
        <DocTemplateEditor
          template={editingDoc}
          onClose={() => setEditingDoc(null)}
          onSave={async (patch) => {
            await updateDoc({ id: editingDoc._id as any, ...patch });
          }}
        />
      )}

      {editingNotif && (
        <NotifTemplateEditor
          template={editingNotif}
          onClose={() => setEditingNotif(null)}
          onSave={async (patch) => {
            await updateNotif({ id: editingNotif._id as any, ...patch });
          }}
        />
      )}
    </AdminLayout>
  );
};

// ==================== Document template editor ====================

const DocTemplateEditor = ({
  template,
  onClose,
  onSave,
}: {
  template: DocTemplate;
  onClose: () => void;
  onSave: (patch: any) => Promise<void>;
}) => {
  const { tr } = useLanguage();
  const [titleAr, setTitleAr] = useState(template.title_ar);
  const [titleEn, setTitleEn] = useState(template.title_en);
  const [bodyAr, setBodyAr] = useState(template.body_ar);
  const [bodyEn, setBodyEn] = useState(template.body_en);
  const [layout, setLayout] = useState(template.bilingual_layout);
  const [description, setDescription] = useState(template.description ?? "");
  const [busy, setBusy] = useState(false);
  const [previewLang, setPreviewLang] = useState<"ar" | "en">("en");

  const sample = useMemo(
    () => SAMPLE_DOCUMENT_CONTEXTS[template.key] ?? {},
    [template.key],
  );

  const previewHtml = useMemo(() => {
    try {
      const body = previewLang === "ar" ? bodyAr : bodyEn;
      const title = previewLang === "ar" ? titleAr : titleEn;
      const inner = renderTemplatePreview(body, sample);
      const dir = previewLang === "ar" ? "rtl" : "ltr";
      return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="utf-8"><style>
        body { font-family: -apple-system, system-ui, "IBM Plex Sans", "Tajawal", sans-serif; padding: 16px; color: #1a1a1a; }
        h1, h2, h3 { margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th, td { padding: 6px 10px; border-bottom: 1px solid #ece7e1; text-align: start; }
        th { background: #faf8f5; font-weight: 600; }
        .meta { color: #5f625f; font-size: 12px; }
        .total-row { font-weight: 700; }
      </style></head><body><h2>${title}</h2>${inner}</body></html>`;
    } catch (err: any) {
      return `<pre style="color:#b91c1c;font-family:monospace;padding:12px;">${err.message}</pre>`;
    }
  }, [bodyAr, bodyEn, titleAr, titleEn, previewLang, sample]);

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSave({
        title_ar: titleAr,
        title_en: titleEn,
        body_ar: bodyAr,
        body_en: bodyEn,
        bilingual_layout: layout,
        description: description.trim() || undefined,
      });
      toast.success(tr("Template saved"));
      onClose();
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {tr("Edit template")} · <span className="font-mono text-sm">{template.key}</span>
          </DialogTitle>
          <DialogDescription>
            {tr("Both languages and layout. Variables use {{path}} interpolation.")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{tr("Title (Arabic)")}</Label>
                <Input dir="rtl" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr("Title (English)")}</Label>
                <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Layout")}</Label>
              <Select value={layout} onValueChange={(v) => setLayout(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIDE_BY_SIDE">{tr("Side-by-side")}</SelectItem>
                  <SelectItem value="AR_ONLY">{tr("Arabic only")}</SelectItem>
                  <SelectItem value="EN_ONLY">{tr("English only")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Body (Arabic)")}</Label>
              <Textarea
                dir="rtl"
                rows={10}
                value={bodyAr}
                onChange={(e) => setBodyAr(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Body (English)")}</Label>
              <Textarea
                rows={10}
                value={bodyEn}
                onChange={(e) => setBodyEn(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Description")}</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase text-muted-foreground">{tr("Live preview")}</Label>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={previewLang === "en" ? "default" : "outline"}
                  onClick={() => setPreviewLang("en")}
                >
                  EN
                </Button>
                <Button
                  size="sm"
                  variant={previewLang === "ar" ? "default" : "outline"}
                  onClick={() => setPreviewLang("ar")}
                >
                  AR
                </Button>
              </div>
            </div>
            <iframe
              title="document template preview"
              srcDoc={previewHtml}
              className="h-[500px] w-full rounded border border-border bg-white"
              sandbox="allow-same-origin"
            />
            <p className="text-[11px] text-muted-foreground">
              {tr("Preview uses sample data. Real entities bind their own context at generation time.")}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button>
          <Button onClick={handleSave} disabled={busy}>{tr("Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ==================== Notification template editor ====================

const NotifTemplateEditor = ({
  template,
  onClose,
  onSave,
}: {
  template: NotifTemplate;
  onClose: () => void;
  onSave: (patch: any) => Promise<void>;
}) => {
  const { tr } = useLanguage();
  const [subjectAr, setSubjectAr] = useState(template.subject_ar);
  const [subjectEn, setSubjectEn] = useState(template.subject_en);
  const [bodyAr, setBodyAr] = useState(template.body_ar);
  const [bodyEn, setBodyEn] = useState(template.body_en);
  const [description, setDescription] = useState(template.description ?? "");
  const [busy, setBusy] = useState(false);
  const [previewLang, setPreviewLang] = useState<"ar" | "en">("en");

  const previewHtml = useMemo(() => {
    try {
      const subject = previewLang === "ar" ? subjectAr : subjectEn;
      const body = previewLang === "ar" ? bodyAr : bodyEn;
      const inner = renderTemplatePreview(body, SAMPLE_NOTIFICATION_CONTEXT);
      const dir = previewLang === "ar" ? "rtl" : "ltr";
      const cta = previewLang === "ar" ? "فتح في MWRD" : "Open in MWRD";
      return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="utf-8"><style>
        body { font-family: -apple-system, system-ui, "Tajawal", sans-serif; background: #f5f5f0; padding: 16px; color: #1a1a1a; }
        .shell { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 10px; padding: 20px; }
        h1 { margin: 0 0 10px; font-size: 18px; }
        .cta { display: inline-block; padding: 8px 16px; background: #ff6d43; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 8px; }
      </style></head><body><div class="shell"><p style="color:#8a8a85;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 6px;">MWRD</p><h1>${subject}</h1><div>${inner}</div><p><a class="cta" href="#">${cta}</a></p></div></body></html>`;
    } catch (err: any) {
      return `<pre style="color:#b91c1c;font-family:monospace;padding:12px;">${err.message}</pre>`;
    }
  }, [subjectAr, subjectEn, bodyAr, bodyEn, previewLang]);

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSave({
        subject_ar: subjectAr,
        subject_en: subjectEn,
        body_ar: bodyAr,
        body_en: bodyEn,
        description: description.trim() || undefined,
      });
      toast.success(tr("Template saved"));
      onClose();
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {tr("Edit notification template")} · <span className="font-mono text-sm">{template.event_type}</span>
          </DialogTitle>
          <DialogDescription>
            {tr("Subject and body in both languages. Available variables: {{title}}, {{message}}, {{link}}, {{event_type}}.")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{tr("Subject (Arabic)")}</Label>
                <Input dir="rtl" value={subjectAr} onChange={(e) => setSubjectAr(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr("Subject (English)")}</Label>
                <Input value={subjectEn} onChange={(e) => setSubjectEn(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Body (Arabic)")}</Label>
              <Textarea
                dir="rtl"
                rows={8}
                value={bodyAr}
                onChange={(e) => setBodyAr(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Body (English)")}</Label>
              <Textarea
                rows={8}
                value={bodyEn}
                onChange={(e) => setBodyEn(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Description")}</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase text-muted-foreground">{tr("Live preview")}</Label>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={previewLang === "en" ? "default" : "outline"}
                  onClick={() => setPreviewLang("en")}
                >
                  EN
                </Button>
                <Button
                  size="sm"
                  variant={previewLang === "ar" ? "default" : "outline"}
                  onClick={() => setPreviewLang("ar")}
                >
                  AR
                </Button>
              </div>
            </div>
            <iframe
              title="notification template preview"
              srcDoc={previewHtml}
              className="h-[500px] w-full rounded border border-border bg-white"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tr("Cancel")}</Button>
          <Button onClick={handleSave} disabled={busy}>{tr("Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminTemplates;
