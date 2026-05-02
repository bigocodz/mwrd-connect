import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import type { Id } from "@cvx/dataModel";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EmptyMessage, PageHeader, Panel } from "@/components/app/AppSurface";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Percent } from "lucide-react";

type MarginSetting = {
  _id: Id<"margin_settings">;
  type: "GLOBAL" | "CATEGORY";
  category?: string;
  margin_percent: number;
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const AdminMarginSettings = () => {
  const { tr } = useLanguage();
  const marginsData = useQuery(api.margins.listAll) as MarginSetting[] | undefined;
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
  const [editingCategory, setEditingCategory] = useState<MarginSetting | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryValue, setCategoryValue] = useState("");

  const currentGlobalValue = globalValue || String(globalMargin?.margin_percent ?? 15);

  const saveGlobalMargin = async () => {
    setSaving(true);
    try {
      await upsertGlobal({ margin_percent: parseFloat(currentGlobalValue) });
      toast.success(tr("Global margin updated"));
      setGlobalValue("");
    } catch (err) {
      toast.error(tr("Error: {message}", { message: getErrorMessage(err) }));
    } finally {
      setSaving(false);
    }
  };

  const openCategoryDialog = (item?: MarginSetting) => {
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
      toast.success(editingCategory ? tr("Category margin updated") : tr("Category margin added"));
      setDialogOpen(false);
    } catch (err) {
      toast.error(tr("Error: {message}", { message: getErrorMessage(err) }));
    } finally {
      setSaving(false);
    }
  };

  const deleteCategoryMargin = async (id: Id<"margin_settings">) => {
    try {
      await deleteById({ id });
      toast.success(tr("Category margin removed"));
    } catch (err) {
      toast.error(tr("Error: {message}", { message: getErrorMessage(err) }));
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20 text-[#5f625f]">{tr("Loading...")}</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <PageHeader
        title={tr("Margin Settings")}
        description={tr("Configure pricing margins applied to supplier cost prices.")}
      />

      <div className="space-y-6">
        <Panel
          title={tr("Global Default Margin")}
          description={tr("Applied when no client-specific or category-specific margin is set.")}
          icon={Percent}
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-sm">
              <Label htmlFor="global-margin">{tr("Margin Percentage (%)")}</Label>
              <div className="relative mt-2">
                <Input
                  id="global-margin"
                  type="number"
                  min="0"
                  step="0.1"
                  value={globalValue || String(globalMargin?.margin_percent ?? 15)}
                  onChange={(e) => setGlobalValue(e.target.value)}
                  className="pe-10"
                />
                <Percent className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8a85]" />
              </div>
            </div>
            <Button onClick={saveGlobalMargin} disabled={saving} className="w-full lg:w-auto">
              {tr("Save")}
            </Button>
          </div>
          <div className="mt-5 rounded-md bg-[#f7f8f7] px-4 py-3 text-sm leading-relaxed text-[#5f625f] shadow-[inset_0_0_0_1px_rgba(190,184,174,0.36)]">
            {tr("Formula: Final Price = Supplier Cost x (1 + {margin}%) | VAT-inclusive = Final Price x 1.15", {
              margin: currentGlobalValue,
            })}
          </div>
        </Panel>

        <Panel
          title={tr("Category Margins")}
          description={tr("Override the global margin for specific product categories.")}
          actions={
            <Button size="sm" onClick={() => openCategoryDialog()}>
              <Plus className="h-4 w-4" /> {tr("Add Category")}
            </Button>
          }
        >
            {categoryMargins.length === 0 ? (
              <EmptyMessage>{tr("No category-specific margins configured. The global margin will be used for all categories.")}</EmptyMessage>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr("Category")}</TableHead>
                    <TableHead>{tr("Margin %")}</TableHead>
                    <TableHead className="w-28">{tr("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryMargins.map((item) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium">{item.category}</TableCell>
                      <TableCell>{item.margin_percent}%</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openCategoryDialog(item)} aria-label={tr("Edit")}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteCategoryMargin(item._id)} aria-label={tr("Delete")}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </Panel>

        <Panel title={tr("Margin Hierarchy")}>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["01", tr("Quote item override"), tr("Set per line item when creating a quote.")],
              ["02", tr("Client margin"), tr("Set on the client's profile in user detail.")],
              ["03", tr("Category margin"), tr("Configured above per product category.")],
              ["04", tr("Global default"), tr("The fallback margin shown above.")],
            ].map(([step, title, description]) => (
              <div key={step} className="rounded-md bg-[#f7f8f7] p-4 shadow-[inset_0_0_0_1px_rgba(190,184,174,0.36)]">
                <p className="text-xs font-semibold text-[#ff6d43]">{step}</p>
                <p className="mt-2 font-semibold text-[#1a1a1a]">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#5f625f]">{description}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? tr("Edit Category Margin") : tr("Add Category Margin")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="cat-name">{tr("Category Name")}</Label>
              <Input id="cat-name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder={tr("e.g. Office Supplies")} />
            </div>
            <div>
              <Label htmlFor="cat-margin">{tr("Margin Percentage (%)")}</Label>
              <Input id="cat-margin" type="number" min="0" step="0.1" value={categoryValue} onChange={(e) => setCategoryValue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{tr("Cancel")}</Button>
            <Button onClick={saveCategoryMargin} disabled={saving || !categoryName.trim() || !categoryValue.trim()}>
              {editingCategory ? tr("Update") : tr("Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminMarginSettings;
