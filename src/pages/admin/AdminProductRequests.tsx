import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Id } from "@cvx/dataModel";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCategoryNames } from "@/components/categories/useCategoryNames";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Check, X, Inbox } from "lucide-react";

type PackType = {
  code: string;
  label_en: string;
  label_ar: string;
  base_qty: number;
  uom?: string;
};

type Request = {
  _id: Id<"product_addition_requests">;
  supplier_id: Id<"profiles">;
  supplier_public_id: string;
  proposed_name_en: string;
  proposed_name_ar: string;
  proposed_description_en?: string;
  proposed_description_ar?: string;
  category_id: Id<"categories">;
  proposed_sku?: string;
  proposed_brand?: string;
  images: string[];
  proposed_pack_types: PackType[];
  justification?: string;
};

const AdminProductRequests = () => {
  const { tr, lang } = useLanguage();
  const { localize } = useCategoryNames();

  const data = useQuery(api.productAdditionRequests.listPending) as
    | Request[]
    | undefined;
  const approve = useMutation(api.productAdditionRequests.approve);
  const reject = useMutation(api.productAdditionRequests.reject);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [activeId, setActiveId] = useState<Id<"product_addition_requests"> | null>(
    null,
  );
  const [publish, setPublish] = useState(true);
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [acting, setActing] = useState(false);

  const rows = data ?? [];
  const loading = data === undefined;

  const handleApprove = async () => {
    if (!activeId) return;
    setActing(true);
    try {
      await approve({
        id: activeId,
        publish,
        admin_notes: adminNotes.trim() || undefined,
      });
      toast.success(tr("Approved & master product created"));
      setApproveOpen(false);
      setAdminNotes("");
      setActiveId(null);
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!activeId) return;
    if (!rejectionReason.trim()) {
      toast.error(tr("Reason is required"));
      return;
    }
    setActing(true);
    try {
      await reject({
        id: activeId,
        rejection_reason: rejectionReason.trim(),
        admin_notes: adminNotes.trim() || undefined,
      });
      toast.success(tr("Rejected"));
      setRejectOpen(false);
      setRejectionReason("");
      setAdminNotes("");
      setActiveId(null);
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    } finally {
      setActing(false);
    }
  };

  return (
    <AdminLayout>
      <h1 className="font-display text-3xl font-bold text-foreground mb-6">
        {tr("Product Addition Requests")}
      </h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Inbox className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{tr("No pending product proposals.")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <Card key={r._id}>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {r.images.length > 0 && (
                    <div className="flex gap-2 flex-shrink-0">
                      {r.images.slice(0, 3).map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt=""
                          className="w-20 h-20 rounded-lg object-cover border border-border"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-display text-lg font-bold text-foreground">
                          {lang === "ar" ? r.proposed_name_ar : r.proposed_name_en}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {lang === "ar" ? r.proposed_name_en : r.proposed_name_ar}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {localize(r.category_id)}
                          {r.proposed_brand ? ` · ${r.proposed_brand}` : ""}
                          {r.proposed_sku ? ` · SKU ${r.proposed_sku}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="flex-shrink-0">
                        {r.supplier_public_id}
                      </Badge>
                    </div>
                    {r.proposed_description_en && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {lang === "ar" && r.proposed_description_ar
                          ? r.proposed_description_ar
                          : r.proposed_description_en}
                      </p>
                    )}
                    {r.justification && (
                      <p className="text-sm mt-2 italic text-muted-foreground">
                        {tr("Supplier note:")} “{r.justification}”
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {r.proposed_pack_types.map((p) => (
                        <Badge key={p.code} variant="secondary" className="font-mono text-xs">
                          {p.code} · {p.base_qty}
                          {p.uom ? ` ${p.uom}` : ""}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex md:flex-col gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => {
                        setActiveId(r._id);
                        setPublish(true);
                        setApproveOpen(true);
                      }}
                    >
                      <Check className="w-4 h-4 me-1" /> {tr("Approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setActiveId(r._id);
                        setRejectOpen(true);
                      }}
                    >
                      <X className="w-4 h-4 me-1" /> {tr("Reject")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Approve product proposal")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {tr(
                "Approving creates a new master product with the proposed details. You can edit it later in the Master Catalog.",
              )}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={publish ? "default" : "outline"}
                onClick={() => setPublish(true)}
              >
                {tr("Publish (ACTIVE)")}
              </Button>
              <Button
                size="sm"
                variant={!publish ? "default" : "outline"}
                onClick={() => setPublish(false)}
              >
                {tr("Save as DRAFT")}
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Internal notes (optional)")}</Label>
              <Textarea
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              {tr("Cancel")}
            </Button>
            <Button onClick={handleApprove} disabled={acting}>
              {acting ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : null}
              {tr("Approve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Reject proposal")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{tr("Reason (visible to supplier)")} *</Label>
              <Textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Internal notes (optional)")}</Label>
              <Textarea
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              {tr("Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={acting || !rejectionReason.trim()}
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : null}
              {tr("Reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminProductRequests;
