import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import ClientLayout from "@/components/client/ClientLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShoppingCart, Trash2, Package, Loader2, ArrowRight, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCategoryNames } from "@/components/categories/useCategoryNames";

const ClientCart = () => {
  const { tr } = useLanguage();
  const { localize } = useCategoryNames();
  const navigate = useNavigate();
  const cartData = useQuery(api.clientCatalog.listMyCart);
  const setQuantity = useMutation(api.clientCatalog.setCartQuantity);
  const removeFromCart = useMutation(api.clientCatalog.removeFromCart);
  const clearCart = useMutation(api.clientCatalog.clearCart);

  const loading = cartData === undefined;
  const cart = cartData ?? [];

  const handleSetQty = async (productId: string, qty: number) => {
    try {
      await setQuantity({ product_id: productId as any, quantity: qty });
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    }
  };

  const handleRemove = async (productId: string) => {
    try {
      await removeFromCart({ product_id: productId as any });
      toast.success(tr("Removed from cart"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    }
  };

  const handleClear = async () => {
    if (!confirm(tr("Clear all items from your cart?"))) return;
    try {
      await clearCart();
      toast.success(tr("Cart cleared"));
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    const items = cart.map((entry: any) => ({
      product_id: entry.product_id,
      product_name: entry.product?.name ?? "",
      quantity: entry.cart_quantity ?? 1,
    }));
    navigate("/client/rfq/new", { state: { cartItems: items } });
  };

  const totalItems = cart.reduce(
    (s: number, e: any) => s + (e.cart_quantity ?? 0),
    0,
  );

  // Earliest expiry across all cart entries — that's when the cart starts
  // losing items. Set on the server when entries are touched, 7-day TTL.
  const earliestExpiry = cart.reduce<number | null>((min: number | null, e: any) => {
    if (!e.cart_expires_at) return min;
    if (min === null) return e.cart_expires_at;
    return Math.min(min, e.cart_expires_at);
  }, null);
  const formatRemaining = (ts: number) => {
    const ms = ts - Date.now();
    if (ms <= 0) return tr("Expired");
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (days >= 1) return tr("{n} days left", { n: days });
    if (hours >= 1) return tr("{n} hours left", { n: hours });
    return tr("Less than an hour");
  };

  return (
    <ClientLayout>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">{tr("My Cart")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr("Review items, then send them as a Request for Quote.")}
          </p>
          {earliestExpiry !== null && (
            <Badge variant="outline" className="mt-2 inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRemaining(earliestExpiry)}
            </Badge>
          )}
        </div>
        {cart.length > 0 && (
          <Button variant="ghost" onClick={handleClear}>
            <Trash2 className="w-4 h-4 me-2" />
            {tr("Clear cart")}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : cart.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground">{tr("Your cart is empty.")}</p>
            <Button className="mt-4" onClick={() => navigate("/client/catalog")}>
              {tr("Browse catalog")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {cart.map((entry: any) => {
            const p = entry.product;
            return (
              <Card key={entry._id}>
                <CardContent className="flex flex-wrap items-center gap-4 py-4">
                  {p.images?.length > 0 ? (
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      className="w-16 h-16 object-cover rounded"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  ) : (
                    <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                      <Package className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-[200px]">
                    <h3 className="font-display font-bold text-foreground line-clamp-1">
                      {entry.alias || p.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {p.description || tr("No description")}
                    </p>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {localize(p.category_id, p.category)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">{tr("Qty")}</label>
                    <Input
                      type="number"
                      min={1}
                      className="w-20"
                      value={entry.cart_quantity ?? 1}
                      onChange={(e) =>
                        handleSetQty(entry.product_id, Math.max(1, parseInt(e.target.value) || 1))
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(entry.product_id)}
                      title={tr("Remove")}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card className="bg-muted/30">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {tr("{n} items in cart, total quantity {q}", {
                    n: String(cart.length),
                    q: String(totalItems),
                  })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {tr("Suppliers will quote prices for these items after you submit the RFQ.")}
                </p>
              </div>
              <Button onClick={handleCheckout}>
                {tr("Create RFQ from cart")}
                <ArrowRight className="w-4 h-4 ms-2 rtl:rotate-180" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </ClientLayout>
  );
};

export default ClientCart;
