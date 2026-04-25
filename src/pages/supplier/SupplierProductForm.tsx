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
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  "Building Materials", "Electrical", "Plumbing", "HVAC",
  "Safety Equipment", "Tools & Hardware", "Chemicals", "Packaging", "Office Supplies", "Other",
];

const SupplierProductForm = () => {
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
      toast.success(isEdit ? "Product resubmitted for review" : "Product submitted for review");
      navigate("/supplier/products");
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
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
        <ArrowLeft className="w-4 h-4" /> Back to Products
      </Link>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{isEdit ? "Edit Product" : "Add Product"}</CardTitle>
          <CardDescription>
            {isEdit && isApproved
              ? "Editing an approved product will resubmit it for review."
              : "Fill in the details below. Your product will be reviewed before appearing in the catalog."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subcat">Subcategory</Label>
                <Input id="subcat" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} maxLength={100} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} maxLength={50} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={100} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="images">Image URLs (one per line)</Label>
              <Textarea id="images" value={images} onChange={(e) => setImages(e.target.value)} rows={3} placeholder={"https://example.com/image1.jpg\nhttps://example.com/image2.jpg"} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Your Price (SAR) *</Label>
                <Input id="price" type="number" step="0.01" min="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead">Lead Time (days) *</Label>
                <Input id="lead" type="number" min="1" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Availability</Label>
              <Select value={availability} onValueChange={setAvailability}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVAILABLE">Available</SelectItem>
                  <SelectItem value="LIMITED_STOCK">Limited Stock</SelectItem>
                  <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Set stock below to auto-derive availability (0 = out of stock; ≤ threshold = limited).
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Stock quantity</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  step="1"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  placeholder="Leave blank to manage manually"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold">Low-stock threshold</Label>
                <Input
                  id="threshold"
                  type="number"
                  min="0"
                  step="1"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading || !category}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {isEdit ? "Resubmit for Review" : "Submit for Review"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </SupplierLayout>
  );
};

export default SupplierProductForm;
