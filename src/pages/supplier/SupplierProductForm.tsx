import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import SupplierLayout from "@/components/supplier/SupplierLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

const CATEGORIES = [
  "Building Materials", "Electrical", "Plumbing", "HVAC",
  "Safety Equipment", "Tools & Hardware", "Chemicals", "Packaging", "Office Supplies", "Other",
];

const SupplierProductForm = () => {
  const { tr, dir } = useLanguage();
  const navigate = useNavigate();
  const { productId } = useParams<{ productId: string }>();
  const isEdit = !!productId;
  const createProduct = useMutation(api.products.create);
  const updateProduct = useMutation(api.products.update);

  const productData = useQuery(api.products.getById, productId ? { id: productId as any } : "skip");
  const fetching = isEdit && productData === undefined;
  const [loading, setLoading] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("");
  const [images, setImages] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [leadTime, setLeadTime] = useState("7");
  const [availability, setAvailability] = useState("AVAILABLE");
  const [stockQuantity, setStockQuantity] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");

  useEffect(() => {
    if (productData) {
      setName(productData.name);
      setDescription(productData.description || "");
      setCategory(productData.category);
      setSubcategory(productData.subcategory || "");
      setSku(productData.sku || "");
      setBrand(productData.brand || "");
      setImages(((productData.images as string[]) || []).join("\n"));
      setCostPrice(String(productData.cost_price));
      setLeadTime(String(productData.lead_time_days));
      setAvailability(productData.availability_status);
      setStockQuantity(productData.stock_quantity != null ? String(productData.stock_quantity) : "");
      setLowStockThreshold(
        productData.low_stock_threshold != null ? String(productData.low_stock_threshold) : "",
      );
      setIsApproved(productData.approval_status === "APPROVED");
    }
  }, [productData?._id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const imageArray = images.split("\n").map((s) => s.trim()).filter(Boolean);
    const stockNumber = stockQuantity.trim() === "" ? undefined : Math.max(0, Math.floor(Number(stockQuantity)));
    const thresholdNumber =
      lowStockThreshold.trim() === "" ? undefined : Math.max(0, Math.floor(Number(lowStockThreshold)));
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      subcategory: subcategory.trim() || undefined,
      sku: sku.trim() || undefined,
      brand: brand.trim() || undefined,
      images: imageArray,
      cost_price: parseFloat(costPrice) || 0,
      lead_time_days: parseInt(leadTime) || 7,
      availability_status: availability as "AVAILABLE" | "LIMITED_STOCK" | "OUT_OF_STOCK",
      stock_quantity: stockNumber,
      low_stock_threshold: thresholdNumber,
    };

    try {
      if (isEdit) {
        await updateProduct({ id: productId as any, ...payload });
      } else {
        await createProduct(payload);
      }
      toast.success(isEdit ? tr("Product resubmitted for review") : tr("Product submitted for review"));
      navigate("/supplier/products");
    } catch (err: any) {
      toast.error(tr("Failed to save: {message}", { message: err.message }));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <SupplierLayout><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></SupplierLayout>;
  }

  return (
    <SupplierLayout>
      <Link to="/supplier/products" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-6">
        {dir === "rtl" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />} {tr("Back to Products")}
      </Link>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{isEdit ? tr("Edit Product") : tr("Add Product")}</CardTitle>
          <CardDescription>
            {isEdit && isApproved
              ? tr("Editing an approved product will resubmit it for review.")
              : tr("Fill in the details below. Your product will be reviewed before appearing in the catalog.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">{tr("Product Name")} *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">{tr("Description")}</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tr("Category")} *</Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger><SelectValue placeholder={tr("Select category")} /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{tr(c)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subcat">{tr("Subcategory")}</Label>
                <Input id="subcat" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} maxLength={100} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">{tr("SKU")}</Label>
                <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} maxLength={50} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">{tr("Brand")}</Label>
                <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={100} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="images">{tr("Image URLs (one per line)")}</Label>
              <Textarea id="images" value={images} onChange={(e) => setImages(e.target.value)} rows={3} placeholder={tr("Paste image URLs (one per line)")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">{tr("Your Price (SAR)")} *</Label>
                <Input id="price" type="number" step="0.01" min="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead">{tr("Lead Time (days)")} *</Label>
                <Input id="lead" type="number" min="1" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tr("Availability")}</Label>
              <Select value={availability} onValueChange={setAvailability}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVAILABLE">{tr("Available")}</SelectItem>
                  <SelectItem value="LIMITED_STOCK">{tr("Limited Stock")}</SelectItem>
                  <SelectItem value="OUT_OF_STOCK">{tr("Out of stock")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {tr("Set stock below to auto-derive availability (0 = out of stock; ≤ threshold = limited).")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">{tr("Stock quantity")}</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  step="1"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  placeholder={tr("Leave blank to manage manually")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold">{tr("Low-stock threshold")}</Label>
                <Input
                  id="threshold"
                  type="number"
                  min="0"
                  step="1"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  placeholder={tr("Optional")}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading || !category}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : null}
              {isEdit ? tr("Resubmit for Review") : tr("Submit for Review")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </SupplierLayout>
  );
};

export default SupplierProductForm;
