import { useEffect, useState } from "react";
import { ApiError, api } from "@mwrd/auth";
import type {
  Category,
  MasterProduct,
  PackType,
  ProductAdditionRequest,
  SupplierProduct,
} from "@mwrd/ui";

interface Props {
  reloadKey: number;
  onChanged: () => void;
}

export function CatalogPanel({ reloadKey, onChanged }: Props) {
  const [tab, setTab] = useState<
    "masters" | "supplier-queue" | "addition-queue" | "categories"
  >("addition-queue");
  return (
    <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
      <h3 style={{ margin: 0 }}>Catalog</h3>
      <div style={{ display: "flex", gap: "0.5rem", margin: "0.5rem 0" }}>
        <button onClick={() => setTab("addition-queue")} disabled={tab === "addition-queue"}>
          New-product requests
        </button>
        <button onClick={() => setTab("supplier-queue")} disabled={tab === "supplier-queue"}>
          Supplier listings
        </button>
        <button onClick={() => setTab("masters")} disabled={tab === "masters"}>
          Master products
        </button>
        <button onClick={() => setTab("categories")} disabled={tab === "categories"}>
          Categories
        </button>
      </div>
      {tab === "addition-queue" && (
        <AdditionQueue reloadKey={reloadKey} onChanged={onChanged} />
      )}
      {tab === "supplier-queue" && (
        <SupplierQueue reloadKey={reloadKey} onChanged={onChanged} />
      )}
      {tab === "masters" && <MastersTab reloadKey={reloadKey} onChanged={onChanged} />}
      {tab === "categories" && (
        <CategoriesTab reloadKey={reloadKey} onChanged={onChanged} />
      )}
    </section>
  );
}

function CategoriesTab({ reloadKey, onChanged }: Props) {
  const [items, setItems] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [parentId, setParentId] = useState<number | "">("");

  async function load() {
    try {
      setItems(await api<Category[]>("/api/catalog/categories"));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }
  useEffect(() => {
    void load();
  }, [reloadKey]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/staff/catalog/categories", {
        method: "POST",
        body: {
          slug, name_en: nameEn, name_ar: nameAr,
          parent_id: parentId === "" ? null : parentId,
        },
      });
      setSlug(""); setNameEn(""); setNameAr(""); setParentId("");
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  if (items === null) return <p>Loading…</p>;
  return (
    <div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <form onSubmit={create} style={{ display: "grid", gap: "0.5rem", maxWidth: 360, marginBottom: "1rem" }}>
        <strong>Add category</strong>
        <input placeholder="slug" required value={slug} onChange={e=>setSlug(e.target.value)} />
        <input placeholder="Name EN" required value={nameEn} onChange={e=>setNameEn(e.target.value)} />
        <input placeholder="Name AR" required value={nameAr} onChange={e=>setNameAr(e.target.value)} />
        <select value={parentId} onChange={e=>setParentId(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">(top-level)</option>
          {items.map(c => <option key={c.id} value={c.id}>{"  ".repeat(c.level)}{c.name_en}</option>)}
        </select>
        <button type="submit">Create</button>
      </form>
      <ul style={{ paddingLeft: 0 }}>
        {items.map(c => (
          <li key={c.id} style={{ listStyle: "none", marginLeft: c.level * 16 }}>
            {c.name_en} <code style={{color:"#666"}}>({c.slug})</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdditionQueue({ reloadKey, onChanged }: Props) {
  const [items, setItems] = useState<ProductAdditionRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setItems(await api<ProductAdditionRequest[]>("/api/staff/catalog/addition-requests"));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }
  useEffect(() => {
    void load();
  }, [reloadKey]);

  async function decide(id: number, action: "approve" | "reject") {
    let body: Record<string, string> = {};
    if (action === "reject") {
      const reason = window.prompt("Rejection reason?");
      if (!reason) return;
      body = { reason };
    } else {
      body = { notes: "" };
    }
    try {
      await api(`/api/staff/catalog/addition-requests/${id}/${action}`, {
        method: "POST",
        body,
      });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  if (items === null) return <p>Loading…</p>;
  return (
    <div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {items.length === 0 && <p style={{ color: "#666" }}>No pending requests.</p>}
      {items.map((r) => (
        <div
          key={r.id}
          style={{ border: "1px solid #eee", padding: "0.5rem", marginBottom: "0.5rem", borderRadius: 6 }}
        >
          <strong>{r.proposed_name_en}</strong> ({r.proposed_brand || "—"})
          <p style={{ margin: "0.25rem 0", fontSize: 13, color: "#666" }}>
            From org {r.organization} · justification: {r.justification || "—"}
          </p>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            <button onClick={() => void decide(r.id, "approve")}>Approve</button>
            <button onClick={() => void decide(r.id, "reject")}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SupplierQueue({ reloadKey, onChanged }: Props) {
  const [items, setItems] = useState<SupplierProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setItems(await api<SupplierProduct[]>("/api/staff/catalog/supplier-products"));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }
  useEffect(() => {
    void load();
  }, [reloadKey]);

  async function decide(id: number, action: "approve" | "reject") {
    let body: Record<string, string> = {};
    if (action === "reject") {
      const reason = window.prompt("Rejection reason?");
      if (!reason) return;
      body = { reason };
    }
    try {
      await api(`/api/staff/catalog/supplier-products/${id}/${action}`, {
        method: "POST",
        body,
      });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  if (items === null) return <p>Loading…</p>;
  return (
    <div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {items.length === 0 && <p style={{ color: "#666" }}>No pending listings.</p>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
            <th>Master</th>
            <th>Supplier org</th>
            <th>Pack</th>
            <th>Cost</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((sp) => (
            <tr key={sp.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
              <td>{sp.master_name_en}</td>
              <td>{sp.organization}</td>
              <td>{sp.pack_type_code}</td>
              <td>{sp.cost_price}</td>
              <td style={{ display: "flex", gap: "0.25rem" }}>
                <button onClick={() => void decide(sp.id, "approve")}>Approve</button>
                <button onClick={() => void decide(sp.id, "reject")}>Reject</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MastersTab({ reloadKey, onChanged }: Props) {
  const [items, setItems] = useState<MasterProduct[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    try {
      const [list, cats] = await Promise.all([
        api<MasterProduct[]>("/api/staff/catalog/products"),
        api<Category[]>("/api/catalog/categories"),
      ]);
      setItems(list);
      setCategories(cats);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }
  useEffect(() => {
    void load();
  }, [reloadKey]);

  if (items === null) return <p>Loading…</p>;
  return (
    <div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <p>
        <button onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "Create master product"}
        </button>
      </p>
      {showForm && (
        <CreateMasterForm
          categories={categories}
          onCreated={() => {
            setShowForm(false);
            void load();
            onChanged();
          }}
        />
      )}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: "0.5rem" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
            <th>Name</th>
            <th>SKU</th>
            <th>Category</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((mp) => (
            <tr key={mp.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
              <td>{mp.name_en}</td>
              <td>{mp.sku || "—"}</td>
              <td>{mp.category_name_en}</td>
              <td>{mp.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreateMasterForm({
  categories,
  onCreated,
}: {
  categories: Category[];
  onCreated: () => void;
}) {
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("");
  const [packTypes] = useState<PackType[]>([
    { code: "EACH", label_en: "Each", label_ar: "وحدة", base_qty: 1, uom: "PCS" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (categoryId === "") return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/staff/catalog/products", {
        method: "POST",
        body: {
          name_en: nameEn,
          name_ar: nameAr,
          description_en: "",
          description_ar: "",
          category: categoryId,
          sku,
          brand,
          image_keys: [],
          specs: {},
          pack_types: packTypes,
        },
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "0.5rem", maxWidth: 420 }}>
      <label>
        Name (English)
        <input required value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
      </label>
      <label>
        Name (Arabic)
        <input required value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
      </label>
      <label>
        Category
        <select
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">— select —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {"  ".repeat(c.level)}
              {c.name_en}
            </option>
          ))}
        </select>
      </label>
      <label>
        SKU
        <input value={sku} onChange={(e) => setSku(e.target.value)} />
      </label>
      <label>
        Brand
        <input value={brand} onChange={(e) => setBrand(e.target.value)} />
      </label>
      <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
        Pack types: {packTypes.length} (EACH default)
      </p>
      {error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? "…" : "Create"}
      </button>
    </form>
  );
}
