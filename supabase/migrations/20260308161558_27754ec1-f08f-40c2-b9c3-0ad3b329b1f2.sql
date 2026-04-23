
-- Enums
CREATE TYPE public.rfq_status AS ENUM ('OPEN', 'QUOTED', 'CLOSED');
CREATE TYPE public.item_flexibility AS ENUM ('EXACT_MATCH', 'OPEN_TO_EQUIVALENT', 'OPEN_TO_ALTERNATIVES');

-- RFQs table
CREATE TABLE public.rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.rfq_status NOT NULL DEFAULT 'OPEN',
  expiry_date timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RFQ Items
CREATE TABLE public.rfq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  custom_item_description text,
  quantity integer NOT NULL DEFAULT 1,
  flexibility public.item_flexibility NOT NULL DEFAULT 'EXACT_MATCH',
  special_notes text
);

-- RFQ Supplier Assignments
CREATE TABLE public.rfq_supplier_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rfq_id, supplier_id)
);

-- RLS on rfqs
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can read own rfqs" ON public.rfqs FOR SELECT TO authenticated
  USING (client_id = auth.uid());
CREATE POLICY "Clients can insert own rfqs" ON public.rfqs FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid() AND public.has_role(auth.uid(), 'CLIENT'));
CREATE POLICY "Admins can read all rfqs" ON public.rfqs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admins can update all rfqs" ON public.rfqs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- RLS on rfq_items
ALTER TABLE public.rfq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can read own rfq items" ON public.rfq_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = rfq_items.rfq_id AND rfqs.client_id = auth.uid()));
CREATE POLICY "Clients can insert own rfq items" ON public.rfq_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = rfq_items.rfq_id AND rfqs.client_id = auth.uid()));
CREATE POLICY "Admins can read all rfq items" ON public.rfq_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- RLS on rfq_supplier_assignments
ALTER TABLE public.rfq_supplier_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can insert assignments for own rfqs" ON public.rfq_supplier_assignments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = rfq_supplier_assignments.rfq_id AND rfqs.client_id = auth.uid()));
CREATE POLICY "Admins can read all assignments" ON public.rfq_supplier_assignments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Suppliers can read own assignments" ON public.rfq_supplier_assignments FOR SELECT TO authenticated
  USING (supplier_id = auth.uid());
CREATE POLICY "Clients can read own rfq assignments" ON public.rfq_supplier_assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = rfq_supplier_assignments.rfq_id AND rfqs.client_id = auth.uid()));
