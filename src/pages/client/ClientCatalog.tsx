import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import ClientLayout from "@/components/client/ClientLayout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Package } from "lucide-react";

const ClientCatalog = () => {
  const productsData = useQuery(api.products.listApproved);
  const loading = productsData === undefined;
  const products = productsData ?? [];

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [subFilter, setSubFilter] = useState("ALL");

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products]);
  const subcategories = useMemo(() => {
    const filtered = catFilter === "ALL" ? products : products.filter((p) => p.category === catFilter);
    return [...new Set(filtered.map((p) => p.subcategory).filter(Boolean))].sort() as string[];
  }, [products, catFilter]);

  const filtered = products.filter((p) => {
    if (catFilter !== "ALL" && p.category !== catFilter) return false;
    if (subFilter !== "ALL" && p.subcategory !== subFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return p.name.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <ClientLayout>
      <h1 className="font-display text-3xl font-bold text-foreground mb-6">Product Catalog</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No products found.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p._id} className="overflow-hidden">
              {p.images.length > 0 ? (
                <div className="aspect-video bg-muted">
                  <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                </div>
              ) : (
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <Package className="w-10 h-10 text-muted-foreground/30" />
                </div>
              )}
              <CardContent className="pt-4">
                <h3 className="font-display font-bold text-foreground line-clamp-1">{p.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description || "No description"}</p>
                <div className="flex items-center justify-between mt-3">
                  <Badge variant="outline" className="text-xs">{p.category}</Badge>
                  <span className="text-xs text-muted-foreground">Lead: {p.lead_time_days} days</span>
                </div>
                {p.availability_status === "LIMITED_STOCK" && (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 mt-2">
                    Limited Stock
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ClientLayout>
  );
};

export default ClientCatalog;
