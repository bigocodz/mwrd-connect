import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "@cvx/api";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Download01, Upload01 } from "@untitledui/icons";
import { downloadCsv, parseCsv } from "@/lib/csv";

type Row = {
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  sku?: string;
  brand?: string;
  cost_price: number;
  lead_time_days: number;
  availability_status: "AVAILABLE" | "LIMITED_STOCK" | "OUT_OF_STOCK";
  stock_quantity?: number;
  low_stock_threshold?: number;
};

const OPTIONAL_HEADERS = ["stock_quantity", "low_stock_threshold"];

type ParsedRow = { row: Row | null; errors: string[]; raw: Record<string, string> };

const REQUIRED_HEADERS = [
  "name",
  "description",
  "category",
  "subcategory",
  "sku",
  "brand",
  "cost_price",
  "lead_time_days",
  "availability_status",
];

const VALID_AVAIL = new Set(["AVAILABLE", "LIMITED_STOCK", "OUT_OF_STOCK"]);

const validateRow = (raw: Record<string, string>): ParsedRow => {
  const errors: string[] = [];
  const name = (raw.name ?? "").trim();
  const category = (raw.category ?? "").trim();
  const costStr = (raw.cost_price ?? "").trim();
  const leadStr = (raw.lead_time_days ?? "").trim();
  const availability = (raw.availability_status ?? "").trim().toUpperCase();

  if (!name) errors.push("name is required");
  if (!category) errors.push("category is required");
  const cost = parseFloat(costStr);
  if (!costStr || Number.isNaN(cost) || cost < 0) errors.push("cost_price must be a non-negative number");
  const lead = parseInt(leadStr, 10);
  if (!leadStr || Number.isNaN(lead) || lead < 0) errors.push("lead_time_days must be a non-negative integer");
  if (!VALID_AVAIL.has(availability))
    errors.push("availability_status must be AVAILABLE, LIMITED_STOCK, or OUT_OF_STOCK");

  const stockStr = (raw.stock_quantity ?? "").trim();
  let stock: number | undefined;
  if (stockStr) {
    const parsed = Number(stockStr);
    if (!Number.isFinite(parsed) || parsed < 0) errors.push("stock_quantity must be a non-negative number");
    else stock = Math.floor(parsed);
  }
  const thresholdStr = (raw.low_stock_threshold ?? "").trim();
  let threshold: number | undefined;
  if (thresholdStr) {
    const parsed = Number(thresholdStr);
    if (!Number.isFinite(parsed) || parsed < 0) errors.push("low_stock_threshold must be a non-negative number");
    else threshold = Math.floor(parsed);
  }

  if (errors.length > 0) return { row: null, errors, raw };
  return {
    row: {
      name,
      description: (raw.description ?? "").trim() || undefined,
      category,
      subcategory: (raw.subcategory ?? "").trim() || undefined,
      sku: (raw.sku ?? "").trim() || undefined,
      brand: (raw.brand ?? "").trim() || undefined,
      cost_price: cost,
      lead_time_days: lead,
      availability_status: availability as Row["availability_status"],
      stock_quantity: stock,
      low_stock_threshold: threshold,
    },
    errors: [],
    raw,
  };
};

const SupplierProductsBulk = () => {
  const bulkCreate = useMutation(api.products.bulkCreate);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const validRows = parsedRows.filter((r) => r.row !== null);
  const invalidRows = parsedRows.filter((r) => r.row === null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      toast.error("Empty file");
      setParsedRows([]);
      return;
    }
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
    if (missing.length > 0) {
      toast.error(`Missing required columns: ${missing.join(", ")}`);
      setParsedRows([]);
      return;
    }
    const dataRows = rows.slice(1);
    const parsed = dataRows.map((cells) => {
      const raw: Record<string, string> = {};
      headers.forEach((h, idx) => {
        raw[h] = cells[idx] ?? "";
      });
      return validateRow(raw);
    });
    setParsedRows(parsed);
    if (parsed.length === 0) toast.error("No data rows found");
    else toast.success(`Parsed ${parsed.length} row(s)`);
  };

  const handleSubmit = async () => {
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    setBusy(true);
    try {
      const res = await bulkCreate({ rows: validRows.map((r) => r.row!) as any });
      toast.success(`${res.count} product(s) submitted for approval`);
      setParsedRows([]);
      setFileName(null);
    } catch (err: any) {
      toast.error(err.message || "Bulk import failed");
    } finally {
      setBusy(false);
    }
  };

  const handleTemplate = () => {
    downloadCsv("mwrd-products-template.csv", [
      [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS],
      [
        "Pilot G2 0.7mm Pen",
        "Retractable gel ink rollerball",
        "Office Consumables",
        "Pens",
        "PILOT-G2-07",
        "Pilot",
        "8.5",
        "3",
        "AVAILABLE",
        "120",
        "20",
      ],
    ]);
  };

  return (
    <SupplierLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Bulk Product Upload</h1>
            <p className="text-muted-foreground mt-1">
              Import products from a CSV file. All rows are submitted for MWRD approval.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTemplate}>
              <Download01 className="w-4 h-4 mr-2" /> Download template
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/supplier/products">Back to products</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
              <div className="flex items-center gap-3">
                <Button onClick={() => fileRef.current?.click()} disabled={busy}>
                  <Upload01 className="w-4 h-4 mr-2" /> Select CSV
                </Button>
                {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Required columns: <code>{REQUIRED_HEADERS.join(", ")}</code>.{" "}
              <code>availability_status</code> must be one of <code>AVAILABLE</code>, <code>LIMITED_STOCK</code>,
              or <code>OUT_OF_STOCK</code>. Optional columns: <code>{OPTIONAL_HEADERS.join(", ")}</code> — when set,
              availability is auto-derived from stock.
            </p>
          </CardContent>
        </Card>

        {parsedRows.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    {validRows.length} valid
                  </Badge>
                  {invalidRows.length > 0 && (
                    <Badge variant="outline" className="bg-red-100 text-red-800">
                      {invalidRows.length} invalid
                    </Badge>
                  )}
                </div>
                <Button onClick={handleSubmit} disabled={busy || validRows.length === 0}>
                  Import {validRows.length} product{validRows.length === 1 ? "" : "s"}
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Lead time</TableHead>
                    <TableHead>Availability</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((parsed, idx) => {
                    const data = parsed.row ?? parsed.raw;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{(data as any).name || "—"}</TableCell>
                        <TableCell>{(data as any).category || "—"}</TableCell>
                        <TableCell>{(data as any).sku || "—"}</TableCell>
                        <TableCell>{(data as any).cost_price ?? "—"}</TableCell>
                        <TableCell>{(data as any).lead_time_days ?? "—"}</TableCell>
                        <TableCell className="text-xs">{(data as any).availability_status || "—"}</TableCell>
                        <TableCell>
                          {parsed.errors.length === 0 ? (
                            <Badge variant="outline" className="bg-green-100 text-green-800">Valid</Badge>
                          ) : (
                            <div>
                              <Badge variant="outline" className="bg-red-100 text-red-800">Invalid</Badge>
                              <p className="text-xs text-muted-foreground mt-1">{parsed.errors.join("; ")}</p>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </SupplierLayout>
  );
};

export default SupplierProductsBulk;
