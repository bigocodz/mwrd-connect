
-- Product enums
CREATE TYPE public.availability_status AS ENUM ('AVAILABLE', 'LIMITED_STOCK', 'OUT_OF_STOCK');
CREATE TYPE public.product_approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  sku TEXT,
  brand TEXT,
  images TEXT[] DEFAULT '{}',
  cost_price NUMERIC NOT NULL DEFAULT 0,
  lead_time_days INTEGER NOT NULL DEFAULT 7,
  availability_status availability_status NOT NULL DEFAULT 'AVAILABLE',
  approval_status product_approval_status NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Suppliers can read their own products
CREATE POLICY "Suppliers can read own products"
  ON public.products FOR SELECT
  TO authenticated
  USING (supplier_id = auth.uid());

-- Suppliers can insert their own products
CREATE POLICY "Suppliers can insert own products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (supplier_id = auth.uid() AND public.has_role(auth.uid(), 'SUPPLIER'));

-- Suppliers can update their own products
CREATE POLICY "Suppliers can update own products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());

-- Admins can read all products
CREATE POLICY "Admins can read all products"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Admins can update all products (for approval/rejection)
CREATE POLICY "Admins can update all products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Clients can read approved, non-out-of-stock products (no cost_price access handled in app)
CREATE POLICY "Clients can read approved products"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'CLIENT')
    AND approval_status = 'APPROVED'
    AND availability_status != 'OUT_OF_STOCK'
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
