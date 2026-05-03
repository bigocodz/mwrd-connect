import { useEffect, useState } from "react";
import { ApiError, api } from "@mwrd/auth";
import type { Category, MasterProduct } from "./portal-types";

export function CatalogBrowse() {
  const [q, setQ] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Category[]>("/api/catalog/categories")
      .then(setCategories)
      .catch((e) => setError(e instanceof ApiError ? e.detail : String(e)));
  }, []);

  async function search() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (categoryId !== "") params.set("category_id", String(categoryId));
      const out = await api<MasterProduct[]>(`/api/catalog/products?${params}`);
      setProducts(out);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>Catalog</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
        style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}
      >
        <input
          placeholder="Search products"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: "1 1 200px" }}
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {"  ".repeat(c.level)}
              {c.name_en}
            </option>
          ))}
        </select>
        <button type="submit" disabled={loading}>
          {loading ? "…" : "Search"}
        </button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {products.length === 0 && !loading && (
        <p style={{ color: "#666" }}>No products match your search.</p>
      )}
      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        }}
      >
        {products.map((p) => (
          <article key={p.id} style={{ border: "1px solid #eee", padding: "0.75rem", borderRadius: 6 }}>
            <h4 style={{ margin: 0 }}>{p.name_en}</h4>
            <p style={{ margin: "0.25rem 0", color: "#666", fontSize: 13 }}>
              {p.brand || "—"} · {p.category_name_en} · SKU {p.sku || p.id}
            </p>
            <p style={{ margin: "0.25rem 0", fontSize: 13 }}>
              Pack sizes: {p.pack_types.map((pt) => pt.label_en).join(", ") || "—"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
