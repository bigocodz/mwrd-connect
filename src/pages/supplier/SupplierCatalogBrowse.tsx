import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@cvx/api";
import { Id } from "@cvx/dataModel";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CategoryPicker } from "@/components/categories/CategoryPicker";
import { useCategoryNames } from "@/components/categories/useCategoryNames";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Plus, PackageSearch, Search } from "lucide-react";

type PackType = {
  code: string;
  label_en: string;
  label_ar: string;
  base_qty: number;
  uom?: string;
};

type MasterRow = {
  _id: Id<"master_products">;
  name_en: string;
  name_ar: string;
  description_en?: string;
  description_ar?: string;
  category_id: Id<"categories">;
  brand?: string;
  sku?: string;
  images: string[];
  pack_types: PackType[];
  my_offer_count: number;
};

const SupplierCatalogBrowse = () => {
  const { tr, lang } = useLanguage();
  const { localize } = useCategoryNames();
  const navigate = useNavigate();

  const [categoryId, setCategoryId] = useState<Id<"categories"> | undefined>();
  const [search, setSearch] = useState("");

  const data = useQuery(api.masterProducts.listForSupplierBrowse, {
    category_id: categoryId,
  }) as MasterRow[] | undefined;

  const loading = data === undefined;
  const rows = (data ?? []).filter((m) => {
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return (
      m.name_en.toLowerCase().includes(s) ||
      m.name_ar.toLowerCase().includes(s) ||
      (m.brand ?? "").toLowerCase().includes(s) ||
      (m.sku ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <SupplierLayout>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-display text-3xl font-bold text-foreground">
          {tr("Browse Master Catalog")}
        </h1>
        <Link to="/supplier/product-requests/new">
          <Button variant="outline">
            <Plus className="w-4 h-4 me-1.5" />
            {tr("Propose new product")}
          </Button>
        </Link>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <CategoryPicker
              categoryId={categoryId}
              onChange={(next) =>
                setCategoryId(next.subcategory_id ?? next.category_id)
              }
            />
          </div>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={tr("Search name, brand, SKU…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <PackageSearch className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{tr("No master products found.")}</p>
          <p className="text-sm mt-1">
            {tr("Don't see what you sell?")}{" "}
            <Link
              to="/supplier/product-requests/new"
              className="text-primary hover:underline"
            >
              {tr("Propose a new product")}
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((m) => (
            <Card key={m._id} className="flex flex-col">
              <CardContent className="pt-6 flex-1 flex flex-col">
                {m.images[0] && (
                  <img
                    src={m.images[0]}
                    alt=""
                    className="w-full h-40 rounded-md object-cover border border-border mb-3"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                )}
                <h3 className="font-display text-base font-semibold text-foreground line-clamp-2">
                  {lang === "ar" ? m.name_ar : m.name_en}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {localize(m.category_id)}
                  {m.brand ? ` · ${m.brand}` : ""}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {m.pack_types.slice(0, 4).map((p) => (
                    <Badge
                      key={p.code}
                      variant="secondary"
                      className="font-mono text-[10px]"
                    >
                      {p.code}
                    </Badge>
                  ))}
                  {m.pack_types.length > 4 && (
                    <Badge variant="secondary" className="text-[10px]">
                      +{m.pack_types.length - 4}
                    </Badge>
                  )}
                </div>
                <div className="mt-auto pt-4 flex items-center gap-2">
                  {m.my_offer_count > 0 ? (
                    <>
                      <Badge variant="default">
                        {tr("{n} offer(s)", { n: m.my_offer_count })}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ms-auto"
                        onClick={() =>
                          navigate(`/supplier/offers/new?master=${m._id}`)
                        }
                      >
                        {tr("Add pack")}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="ms-auto"
                      onClick={() =>
                        navigate(`/supplier/offers/new?master=${m._id}`)
                      }
                    >
                      <Plus className="w-3.5 h-3.5 me-1" />
                      {tr("Sell this")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </SupplierLayout>
  );
};

export default SupplierCatalogBrowse;
