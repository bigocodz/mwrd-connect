import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, Package } from "lucide-react";
import { toast } from "sonner";

const AdminPendingProducts = () => {
  const productsData = useQuery(api.products.listPending);
  const approve = useMutation(api.products.approve);
  const reject = useMutation(api.products.reject);
  const logAudit = useMutation(api.auditLog.insert);

  const loading = productsData === undefined;
  const products = productsData ?? [];

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);

  const handleApprove = async (productId: string) => {
    setActing(true);
    try {
      await approve({ id: productId as any });
      const product = products.find((p) => p._id === productId);
      await logAudit({ action: "APPROVE_PRODUCT", target_user_id: product?.supplier_id as any, details: { product_id: productId } });
      toast.success("Product approved");
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    setActing(true);
    try {
      await reject({ id: rejectId as any, rejection_reason: rejectReason });
      const product = products.find((p) => p._id === rejectId);
      await logAudit({ action: "REJECT_PRODUCT", target_user_id: product?.supplier_id as any, details: { product_id: rejectId, reason: rejectReason } });
      toast.success("Product rejected");
      setRejectOpen(false);
      setRejectReason("");
      setRejectId(null);
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setActing(false);
    }
  };

  return (
    <AdminLayout>
      <h1 className="font-display text-3xl font-bold text-foreground mb-6">Pending Product Approvals</h1>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No pending products to review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((p) => (
            <Card key={p._id}>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {p.images.length > 0 && (
                    <div className="flex gap-2 flex-shrink-0">
                      {p.images.slice(0, 3).map((url, i) => (
                        <img key={i} src={url} alt="" className="w-20 h-20 rounded-lg object-cover border border-border" onError={(e) => (e.currentTarget.style.display = "none")} />
                      ))}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-display text-lg font-bold text-foreground">{p.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{p.category}{p.subcategory ? ` / ${p.subcategory}` : ""}</p>
                      </div>
                      <Badge variant="outline" className="flex-shrink-0">{(p as any).supplier_public_id}</Badge>
                    </div>
                    {p.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{p.description}</p>}
                    <div className="flex gap-4 mt-3 text-sm">
                      <span className="text-muted-foreground">Cost: <strong className="text-foreground font-mono">{Number(p.cost_price).toLocaleString()} SAR</strong></span>
                      <span className="text-muted-foreground">Lead: <strong className="text-foreground">{p.lead_time_days} days</strong></span>
                    </div>
                  </div>
                  <div className="flex md:flex-col gap-2 flex-shrink-0">
                    <Button size="sm" onClick={() => handleApprove(p._id)} disabled={acting}>
                      <Check className="w-4 h-4 me-1" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { setRejectId(p._id); setRejectOpen(true); }} disabled={acting}>
                      <X className="w-4 h-4 me-1" /> Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Product</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Provide a reason for rejecting this product. The supplier will see this.</p>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g., Insufficient product description..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={acting || !rejectReason.trim()}>
              {acting ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminPendingProducts;
