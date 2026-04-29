import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import ClientLayout from "@/components/client/ClientLayout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, EmptyMessage } from "@/components/app/AppSurface";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  Package,
  Star,
  StarOff,
  Pin,
  EyeOff,
  Eye,
  Trash2,
  ShoppingCart,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCategoryNames } from "@/components/categories/useCategoryNames";

type Tab = "ALL" | "MINE";

const ClientCatalog = () => {
  const { tr } = useLanguage();
  const { localize } = useCategoryNames();
  const productsData = useQuery(api.products.listApproved);
  const myEntriesData = useQuery(api.clientCatalog.listMine);
  const myMeta = useQuery(api.clientCatalog.myProductIds);
  const addProduct = useMutation(api.clientCatalog.addProduct);
  const updateEntry = useMutation(api.clientCatalog.updateEntry);
  const removeEntry = useMutation(api.clientCatalog.remove);
  const addToCart = useMutation(api.clientCatalog.addToCart);

  const loading = productsData === undefined;
  const products = productsData ?? [];
  const myEntries = myEntriesData ?? [];
  const meta = myMeta ?? [];
  const metaByProduct = new Map(meta.map((m: any) => [m.product_id, m]));

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [subFilter, setSubFilter] = useState("ALL");
  const [tab, setTab] = useState<Tab>("ALL");

  const [editEntry, setEditEntry] = useState<any | null>(null);
  const [alias, setAlias] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products]);
  const subcategories = useMemo(() => {
    const filtered = catFilter === "ALL" ? products : products.filter((p) => p.category === catFilter);
    return [...new Set(filtered.map((p) => p.subcategory).filter(Boolean))].sort() as string[];
  }, [products, catFilter]);

  const applyFilters = (items: any[]) =>
    items.filter((p) => {
      if (catFilter !== "ALL" && p.category !== catFilter) return false;
      if (subFilter !== "ALL" && p.subcategory !== subFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return p.name?.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s);
      }
      return true;
    });

  const allFiltered = applyFilters(products);
  const myFiltered = applyFilters(
    myEntries.map((e: any) => ({ ...e.product, _entry: e })),
  ).sort((a, b) => Number(!!b._entry?.pinned) - Number(!!a._entry?.pinned));

  const handleAdd = async (productId: string) => {
    setBusy(true);
    try {
      await addProduct({ product_id: productId as any });
      toast.success(tr("Added to your catalog"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleAddToCart = async (productId: string) => {
    setBusy(true);
    try {
      await addToCart({ product_id: productId as any, quantity: 1 });
      toast.success(tr("Added to cart"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const cartCount = meta.reduce((sum: number, m: any) => sum + (m.cart_quantity ?? 0), 0);

  const togglePinned = async (entryId: string, next: boolean) => {
    try {
      await updateEntry({ id: entryId as any, pinned: next });
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    }
  };

  const toggleHidden = async (entryId: string, next: boolean) => {
    try {
      await updateEntry({ id: entryId as any, hidden: next });
      toast.success(next ? tr("Hidden") : tr("Restored"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    }
  };

  const handleRemove = async (entryId: string) => {
    if (!confirm(tr("Remove this product from your catalog?"))) return;
    try {
      await removeEntry({ id: entryId as any });
      toast.success(tr("Removed"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    }
  };

  const openEdit = (entry: any) => {
    setEditEntry(entry);
    setAlias(entry.alias ?? "");
    setNotes(entry.notes ?? "");
  };

  const saveEdit = async () => {
    if (!editEntry) return;
    setBusy(true);
    try {
      await updateEntry({
        id: editEntry._id,
        alias: alias.trim() || "",
        notes: notes.trim() || "",
      });
      toast.success(tr("Saved"));
      setEditEntry(null);
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    } finally {
      setBusy(false);
    }
  };

  const renderProductCard = (p: any) => {
    const entryMeta = metaByProduct.get(p._id);
    const inMine = !!entryMeta && !entryMeta.hidden;
    return (
      <Card
        key={p._id}
        className="group flex flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-regular-sm)]"
      >
        {p.images?.length > 0 ? (
          <div className="aspect-[4/3] overflow-hidden bg-bg-weak-50">
            <img
              src={p.images[0]}
              alt={p.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center bg-bg-weak-50">
            <Package className="h-9 w-9 text-disabled-300" />
          </div>
        )}
        <CardContent className="flex flex-1 flex-col gap-3 p-4">
          <div className="min-w-0">
            <h3 className="font-display text-[15px] font-semibold leading-tight tracking-[-0.01em] text-strong-950 line-clamp-1">
              {entryMeta?.alias || p.name}
            </h3>
            {entryMeta?.alias && p.name !== entryMeta.alias && (
              <p className="mt-0.5 text-xs text-soft-400 line-clamp-1">{p.name}</p>
            )}
            <p className="mt-1 text-sm leading-5 text-sub-600 line-clamp-2">
              {p.description || tr("No description")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{localize((p as any).category_id, p.category)}</Badge>
            <Badge variant="outline">{tr("Lead: {days} d", { days: p.lead_time_days })}</Badge>
            {p.availability_status === "LIMITED_STOCK" && (
              <Badge variant="warning">{tr("Limited Stock")}</Badge>
            )}
          </div>
          <div className="mt-auto flex items-center justify-end gap-1.5 pt-1">
            {inMine ? (
              <Badge variant="success">
                <Star className="h-3 w-3 fill-current" /> {tr("Saved")}
              </Badge>
            ) : (
              <Button size="xs" variant="ghost" onClick={() => handleAdd(p._id)} disabled={busy}>
                <Star className="h-3 w-3" /> {tr("Save")}
              </Button>
            )}
            <Button size="sm" onClick={() => handleAddToCart(p._id)} disabled={busy}>
              <ShoppingCart className="h-3.5 w-3.5" /> {tr("Add to cart")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderMyCard = (p: any) => {
    const entry = p._entry;
    return (
      <Card
        key={entry._id}
        className={`group flex flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-regular-sm)] ${entry.hidden ? "opacity-60" : ""}`}
      >
        {p.images?.length > 0 ? (
          <div className="aspect-[4/3] overflow-hidden bg-bg-weak-50">
            <img
              src={p.images[0]}
              alt={p.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center bg-bg-weak-50">
            <Package className="h-9 w-9 text-disabled-300" />
          </div>
        )}
        <CardContent className="flex flex-1 flex-col gap-3 p-4">
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-[15px] font-semibold leading-tight tracking-[-0.01em] text-strong-950 line-clamp-1">
                {entry.alias || p.name}
              </h3>
              {entry.pinned && <Pin className="h-4 w-4 text-warning-base" />}
            </div>
            {entry.alias && entry.alias !== p.name && (
              <p className="mt-0.5 text-xs text-soft-400 line-clamp-1">{p.name}</p>
            )}
            {entry.notes && <p className="mt-1 text-xs text-sub-600 line-clamp-2">{entry.notes}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{localize((p as any).category_id, p.category)}</Badge>
            <Badge variant="outline">{tr("Lead: {days} d", { days: p.lead_time_days })}</Badge>
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
            <Button size="xs" variant="ghost" onClick={() => togglePinned(entry._id, !entry.pinned)}>
              {entry.pinned ? <StarOff className="h-3 w-3" /> : <Star className="h-3 w-3" />}
              {entry.pinned ? tr("Unpin") : tr("Pin")}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => openEdit(entry)}>
              {tr("Edit")}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => toggleHidden(entry._id, !entry.hidden)}>
              {entry.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => handleRemove(entry._id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <ClientLayout>
      <PageHeader
        title={tr("Product Catalog")}
        description={tr("Browse approved supplier products and curate your private catalog.")}
        actions={
          <Button asChild variant="outline" size="lg" className="relative">
            <Link to="/client/cart">
              <ShoppingCart className="h-4 w-4" />
              {tr("Cart")}
              {cartCount > 0 && (
                <span className="ms-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-base px-1.5 text-[11px] font-semibold text-white-0">
                  {cartCount}
                </span>
              )}
            </Link>
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-16 border border-stroke-soft-200 bg-bg-white-0 p-2 shadow-[var(--shadow-regular-xs)]">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft-400" />
          <Input
            placeholder={tr("Search products...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9 border-0 shadow-none focus:shadow-none focus:border-0"
          />
        </div>
        <div className="hidden h-8 w-px bg-stroke-soft-200 sm:block" />
        <Select
          value={catFilter}
          onValueChange={(v) => {
            setCatFilter(v);
            setSubFilter("ALL");
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={tr("Category")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr("All Categories")}</SelectItem>
            {categories.map((c) => {
              const sample = products.find((p) => p.category === c) as any;
              const label = localize(sample?.category_id, c);
              return (
                <SelectItem key={c} value={c}>
                  {label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {subcategories.length > 0 && (
          <Select value={subFilter} onValueChange={setSubFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={tr("Subcategory")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{tr("All Subcategories")}</SelectItem>
              {subcategories.map((s) => {
                const sample = products.find((p) => p.subcategory === s) as any;
                const label = localize(sample?.subcategory_id, s);
                return (
                  <SelectItem key={s} value={s}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="ALL">{tr("All Products")}</TabsTrigger>
          <TabsTrigger value="MINE">
            {tr("My Catalog ({count})", { count: myEntries.length })}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ALL" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-soft-400" />
            </div>
          ) : allFiltered.length === 0 ? (
            <EmptyMessage>
              <Package className="mx-auto mb-2 h-9 w-9 text-disabled-300" />
              {tr("No products found.")}
            </EmptyMessage>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {allFiltered.map(renderProductCard)}
            </div>
          )}
        </TabsContent>
        <TabsContent value="MINE" className="mt-4">
          {myEntries.length === 0 ? (
            <EmptyMessage>
              <Star className="mx-auto mb-2 h-9 w-9 text-disabled-300" />
              {tr("No products in your private catalog yet.")}
              <span className="mt-1 block text-xs text-soft-400">
                {tr("Browse All Products and click Add to catalog to curate your own list.")}
              </span>
            </EmptyMessage>
          ) : myFiltered.length === 0 ? (
            <p className="text-sm text-sub-600">{tr("No matches in your catalog.")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {myFiltered.map(renderMyCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editEntry !== null} onOpenChange={(o) => !o && setEditEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Edit catalog entry")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{tr("Display alias")}</Label>
              <Input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder={tr("Internal name (optional)")}
              />
            </div>
            <div>
              <Label>{tr("Notes")}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={tr("Optional internal notes")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>
              {tr("Cancel")}
            </Button>
            <Button onClick={saveEdit} disabled={busy}>
              {tr("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
};

export default ClientCatalog;
