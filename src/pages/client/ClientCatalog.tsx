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
import { toast } from "sonner";
import { Search, Loader2, Package, Star, StarOff, Plus, Pin, EyeOff, Eye, Trash2 } from "lucide-react";

type Tab = "ALL" | "MINE";

const ClientCatalog = () => {
  const productsData = useQuery(api.products.listApproved);
  const myEntriesData = useQuery(api.clientCatalog.listMine);
  const myMeta = useQuery(api.clientCatalog.myProductIds);
  const addProduct = useMutation(api.clientCatalog.addProduct);
  const updateEntry = useMutation(api.clientCatalog.updateEntry);
  const removeEntry = useMutation(api.clientCatalog.remove);

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
      toast.success("Added to your catalog");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const togglePinned = async (entryId: string, next: boolean) => {
    try {
      await updateEntry({ id: entryId as any, pinned: next });
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  const toggleHidden = async (entryId: string, next: boolean) => {
    try {
      await updateEntry({ id: entryId as any, hidden: next });
      toast.success(next ? "Hidden" : "Restored");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  const handleRemove = async (entryId: string) => {
    if (!confirm("Remove this product from your catalog?")) return;
    try {
      await removeEntry({ id: entryId as any });
      toast.success("Removed");
    } catch (err: any) {
      toast.error(err.message || "Failed");
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
      toast.success("Saved");
      setEditEntry(null);
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const renderProductCard = (p: any) => {
    const entryMeta = metaByProduct.get(p._id);
    const inMine = !!entryMeta && !entryMeta.hidden;
    return (
      <Card key={p._id} className="overflow-hidden">
        {p.images?.length > 0 ? (
          <div className="aspect-video bg-muted">
            <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
          </div>
        ) : (
          <div className="aspect-video bg-muted flex items-center justify-center">
            <Package className="w-10 h-10 text-muted-foreground/30" />
          </div>
        )}
        <CardContent className="pt-4">
          <h3 className="font-display font-bold text-foreground line-clamp-1">
            {entryMeta?.alias || p.name}
          </h3>
          {entryMeta?.alias && p.name !== entryMeta.alias && (
            <p className="text-xs text-muted-foreground line-clamp-1">{p.name}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description || "No description"}</p>
          <div className="flex items-center justify-between mt-3">
            <Badge variant="outline" className="text-xs">{p.category}</Badge>
            <span className="text-xs text-muted-foreground">Lead: {p.lead_time_days} days</span>
          </div>
          {p.availability_status === "LIMITED_STOCK" && (
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mt-2">
              Limited Stock
            </span>
          )}
          <div className="mt-3 flex items-center justify-end">
            {inMine ? (
              <Badge variant="outline" className="bg-green-100 text-green-800">
              <Star className="w-3 h-3 me-1 fill-current" /> In your catalog
              </Badge>
            ) : (
              <Button size="sm" variant="outline" onClick={() => handleAdd(p._id)} disabled={busy}>
              <Plus className="w-3 h-3 me-1" /> Add to catalog
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderMyCard = (p: any) => {
    const entry = p._entry;
    return (
      <Card key={entry._id} className={`overflow-hidden ${entry.hidden ? "opacity-60" : ""}`}>
        {p.images?.length > 0 ? (
          <div className="aspect-video bg-muted">
            <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
          </div>
        ) : (
          <div className="aspect-video bg-muted flex items-center justify-center">
            <Package className="w-10 h-10 text-muted-foreground/30" />
          </div>
        )}
        <CardContent className="pt-4 space-y-3">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display font-bold text-foreground line-clamp-1">
                {entry.alias || p.name}
              </h3>
              {entry.pinned && <Pin className="w-4 h-4 text-amber-500 fill-amber-400" />}
            </div>
            {entry.alias && entry.alias !== p.name && (
              <p className="text-xs text-muted-foreground line-clamp-1">{p.name}</p>
            )}
            {entry.notes && <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>}
          </div>
          <div className="flex items-center justify-between text-xs">
            <Badge variant="outline">{p.category}</Badge>
            <span className="text-muted-foreground">Lead: {p.lead_time_days} d</span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => togglePinned(entry._id, !entry.pinned)}>
              {entry.pinned ? <StarOff className="w-3 h-3 me-1" /> : <Star className="w-3 h-3 me-1" />}
              {entry.pinned ? "Unpin" : "Pin"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => openEdit(entry)}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={() => toggleHidden(entry._id, !entry.hidden)}>
              {entry.hidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleRemove(entry._id)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <ClientLayout>
      <h1 className="font-display text-3xl font-bold text-foreground mb-6">Product Catalog</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
        </div>
        <Select value={catFilter} onValueChange={(v) => { setCatFilter(v); setSubFilter("ALL"); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {subcategories.length > 0 && (
          <Select value={subFilter} onValueChange={setSubFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Subcategory" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Subcategories</SelectItem>
              {subcategories.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="ALL">All Products</TabsTrigger>
          <TabsTrigger value="MINE">My Catalog ({myEntries.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="ALL" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : allFiltered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No products found.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allFiltered.map(renderProductCard)}
            </div>
          )}
        </TabsContent>
        <TabsContent value="MINE" className="mt-4">
          {myEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Star className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No products in your private catalog yet.</p>
              <p className="text-sm mt-1">Browse All Products and click "Add to catalog" to curate your own list.</p>
            </div>
          ) : myFiltered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matches in your catalog.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myFiltered.map(renderMyCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editEntry !== null} onOpenChange={(o) => !o && setEditEntry(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit catalog entry</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Display alias</Label>
              <Input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Internal name (optional)" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional internal notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busy}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
};

export default ClientCatalog;
