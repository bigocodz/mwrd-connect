import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Percent } from "lucide-react";

const AdminMarginSettings = () => {
  const marginsData = useQuery(api.margins.listAll);
  const upsertGlobal = useMutation(api.margins.upsertGlobal);
  const upsertCategory = useMutation(api.margins.upsertCategory);
  const deleteById = useMutation(api.margins.deleteById);

  const loading = marginsData === undefined;
  const margins = marginsData ?? [];

  const globalMargin = margins.find((m) => m.type === "GLOBAL");
  const categoryMargins = margins.filter((m) => m.type === "CATEGORY");

  const [globalValue, setGlobalValue] = useState("");
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryValue, setCategoryValue] = useState("");

  const currentGlobalValue = globalValue || String(globalMargin?.margin_percent ?? 15);

  const saveGlobalMargin = async () => {
    setSaving(true);
    try {
      await upsertGlobal({ margin_percent: parseFloat(currentGlobalValue) });
      toast.success("Global margin updated");
      setGlobalValue("");
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openCategoryDialog = (item?: any) => {
    if (item) {
      setEditingCategory(item);
      setCategoryName(item.category || "");
      setCategoryValue(String(item.margin_percent));
    } else {
      setEditingCategory(null);
      setCategoryName("");
      setCategoryValue("");
    }
    setDialogOpen(true);
  };

  const saveCategoryMargin = async () => {
    if (!categoryName.trim() || !categoryValue.trim()) return;
    setSaving(true);
    try {
      await upsertCategory({ category: categoryName.trim(), margin_percent: parseFloat(categoryValue) });
      toast.success(editingCategory ? "Category margin updated" : "Category margin added");
      setDialogOpen(false);
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCategoryMargin = async (id: string) => {
    try {
      await deleteById({ id: id as any });
      toast.success("Category margin removed");
    } catch (err: any) {
      toast.error("Error: " + err.message);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Margin Settings</h1>
          <p className="text-muted-foreground mt-1">Configure pricing margins applied to supplier cost prices.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary" /> Global Default Margin
            </CardTitle>
            <CardDescription>Applied when no client-specific or category-specific margin is set.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="flex-1 max-w-xs">
                <Label htmlFor="global-margin">Margin Percentage (%)</Label>
                <Input
                  id="global-margin"
                  type="number"
                  min="0"
                  step="0.1"
                  value={globalValue || String(globalMargin?.margin_percent ?? 15)}
                  onChange={(e) => setGlobalValue(e.target.value)}
                />
              </div>
              <Button onClick={saveGlobalMargin} disabled={saving}>Save</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Formula: Final Price = Supplier Cost × (1 + {currentGlobalValue}%) &nbsp;|&nbsp; VAT-inclusive = Final Price × 1.15
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Category Margins</CardTitle>
              <CardDescription>Override the global margin for specific product categories.</CardDescription>
            </div>
            <Button size="sm" onClick={() => openCategoryDialog()}>
              <Plus className="w-4 h-4 me-1" /> Add Category
            </Button>
          </CardHeader>
          <CardContent>
            {categoryMargins.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No category-specific margins configured. The global margin will be used for all categories.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Margin %</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryMargins.map((item) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium">{item.category}</TableCell>
                      <TableCell>{item.margin_percent}%</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openCategoryDialog(item)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteCategoryMargin(item._id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Margin Hierarchy</CardTitle></CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Quote item override</strong> — set per line item when creating a quote</li>
              <li><strong className="text-foreground">Client margin</strong> — set on the client's profile (User Detail page)</li>
              <li><strong className="text-foreground">Category margin</strong> — configured above per product category</li>
              <li><strong className="text-foreground">Global default</strong> — the fallback margin shown above</li>
            </ol>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category Margin" : "Add Category Margin"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="cat-name">Category Name</Label>
              <Input id="cat-name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="e.g. Office Supplies" />
            </div>
            <div>
              <Label htmlFor="cat-margin">Margin Percentage (%)</Label>
              <Input id="cat-margin" type="number" min="0" step="0.1" value={categoryValue} onChange={(e) => setCategoryValue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveCategoryMargin} disabled={saving || !categoryName.trim() || !categoryValue.trim()}>
              {editingCategory ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminMarginSettings;
