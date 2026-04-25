import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash01, Upload01 } from "@untitledui/icons";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  KYC_DOCUMENT_TYPES,
  KYC_STATUS_COLOR,
  KYC_STATUS_LABEL,
  KYC_TYPE_LABEL,
  PROFILE_KYC_COLOR,
  PROFILE_KYC_LABEL,
} from "@/components/kyc/kycLabels";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

const SupplierKyc = () => {
  const { tr } = useLanguage();
  const docsData = useQuery(api.kyc.listMine);
  const submit = useMutation(api.kyc.submit);
  const remove = useMutation(api.kyc.remove);
  const generateUploadUrl = useMutation(api.kyc.generateUploadUrl);
  const { profile } = useAuth();
  const loading = docsData === undefined;
  const docs = docsData ?? [];

  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState<string>("CR_CERTIFICATE");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [storageId, setStorageId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | undefined>(undefined);
  const [size, setSize] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reset = () => {
    setDocType("CR_CERTIFICATE"); setName(""); setExpiry(""); setNotes("");
    setStorageId(null); setUploadedFileName(null); setContentType(undefined); setSize(undefined);
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error(tr("Upload failed"));
      const { storageId: id } = await res.json();
      setStorageId(id);
      setUploadedFileName(file.name);
      setContentType(file.type);
      setSize(file.size);
      if (!name) setName(file.name);
      toast.success(tr("File uploaded"));
    } catch (err: any) {
      toast.error(err.message || tr("Upload failed"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!storageId || !name.trim()) {
      toast.error(tr("Upload a file and provide a name"));
      return;
    }
    setBusy(true);
    try {
      await submit({
        document_type: docType as any,
        name: name.trim(),
        storage_id: storageId as any,
        content_type: contentType,
        size,
        expiry_date: expiry || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(tr("Document submitted"));
      setOpen(false);
      reset();
    } catch (err: any) {
      toast.error(err.message || tr("Submission failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr("Remove this document?"))) return;
    try {
      await remove({ id: id as any });
      toast.success(tr("Document removed"));
    } catch (err: any) {
      toast.error(err.message || tr("Could not remove"));
    }
  };

  const profileStatus = profile?.kyc_status ?? "INCOMPLETE";

  return (
    <SupplierLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{tr("KYC Documents")}</h1>
            <p className="text-muted-foreground mt-1">{tr("Upload onboarding documents for MWRD verification.")}</p>
            <Badge variant="outline" className={`mt-2 ${PROFILE_KYC_COLOR[profileStatus] || ""}`}>
              {tr("Account: {status}", { status: tr(PROFILE_KYC_LABEL[profileStatus] ?? profileStatus) })}
            </Badge>
          </div>
          <Button onClick={() => { reset(); setOpen(true); }}>
            <Plus className="w-4 h-4 me-2" /> {tr("Upload Document")}
          </Button>
        </div>

        {loading ? <TableSkeleton rows={4} cols={5} /> : docs.length === 0 ? (
          <Card><CardContent className="p-0">
            <EmptyState
              icon="audit"
              title={tr("No documents uploaded yet")}
              description={tr("Upload your CR, VAT certificate, bank letter, and signatory documents to verify your supplier account.")}
            />
          </CardContent></Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr("Document")}</TableHead>
                <TableHead>{tr("Type")}</TableHead>
                <TableHead>{tr("Status")}</TableHead>
                <TableHead>{tr("Expiry")}</TableHead>
                <TableHead>{tr("File")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc: any) => (
                <TableRow key={doc._id}>
                  <TableCell>
                    <div className="font-medium">{doc.name}</div>
                    {doc.notes && <p className="text-xs text-muted-foreground">{doc.notes}</p>}
                  </TableCell>
                  <TableCell className="text-sm">{tr(KYC_TYPE_LABEL[doc.document_type] ?? doc.document_type)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={KYC_STATUS_COLOR[doc.status] || ""}>
                      {tr(KYC_STATUS_LABEL[doc.status] ?? doc.status)}
                    </Badge>
                    {doc.status === "REJECTED" && doc.rejection_reason && (
                      <p className="text-xs text-muted-foreground mt-1">{doc.rejection_reason}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{doc.expiry_date ?? "—"}</TableCell>
                  <TableCell>
                    {doc.url ? (
                      <a className="underline text-sm" href={doc.url} target="_blank" rel="noreferrer">{tr("View")}</a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {doc.status !== "APPROVED" && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(doc._id)}>
                        <Trash01 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{tr("Upload KYC document")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{tr("Document type")}</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KYC_DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{tr(t.label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{tr("Name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("e.g. CR Certificate 2026")} /></div>
            <div><Label>{tr("Expiry Date (optional)")}</Label><Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></div>
            <div>
              <Label>{tr("File")}</Label>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
                  <Upload01 className="w-4 h-4 me-2" /> {uploadedFileName ? tr("Replace file") : tr("Upload file")}
                </Button>
                {uploadedFileName && <span className="text-sm text-muted-foreground">{uploadedFileName}</span>}
              </div>
            </div>
            <div><Label>{tr("Notes (optional)")}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{tr("Cancel")}</Button>
            <Button onClick={handleSubmit} disabled={busy || !storageId}>{tr("Submit Document")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SupplierLayout>
  );
};

export default SupplierKyc;
