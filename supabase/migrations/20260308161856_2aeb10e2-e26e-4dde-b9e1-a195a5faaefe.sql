
-- Quote status enum
CREATE TYPE public.quote_status AS ENUM ('PENDING_ADMIN', 'SENT_TO_CLIENT', 'ACCEPTED', 'REJECTED');

-- Quotes table
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.quote_status NOT NULL DEFAULT 'PENDING_ADMIN',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz
);

-- Quote items table
CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  rfq_item_id uuid NOT NULL REFERENCES public.rfq_items(id) ON DELETE CASCADE,
  is_quoted boolean NOT NULL DEFAULT true,
  supplier_product_id uuid REFERENCES public.products(id),
  alternative_product_id uuid REFERENCES public.products(id),
  cost_price numeric NOT NULL DEFAULT 0,
  lead_time_days integer NOT NULL DEFAULT 7,
  margin_percent numeric NOT NULL DEFAULT 0,
  final_price_before_vat numeric NOT NULL DEFAULT 0,
  final_price_with_vat numeric NOT NULL DEFAULT 0
);

-- Notifications table for in-app notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: quotes
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can insert own quotes" ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (supplier_id = auth.uid() AND public.has_role(auth.uid(), 'SUPPLIER'));
CREATE POLICY "Suppliers can read own quotes" ON public.quotes FOR SELECT TO authenticated
  USING (supplier_id = auth.uid());
CREATE POLICY "Admins can read all quotes" ON public.quotes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admins can update all quotes" ON public.quotes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Clients can read quotes for own rfqs" ON public.quotes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = quotes.rfq_id AND rfqs.client_id = auth.uid()));
CREATE POLICY "Clients can update quotes for own rfqs" ON public.quotes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = quotes.rfq_id AND rfqs.client_id = auth.uid()));

-- RLS: quote_items
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can insert own quote items" ON public.quote_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_items.quote_id AND quotes.supplier_id = auth.uid()));
CREATE POLICY "Suppliers can read own quote items" ON public.quote_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_items.quote_id AND quotes.supplier_id = auth.uid()));
CREATE POLICY "Admins can read all quote items" ON public.quote_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admins can update all quote items" ON public.quote_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Clients can read quote items for own rfqs" ON public.quote_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quotes
    JOIN public.rfqs ON rfqs.id = quotes.rfq_id
    WHERE quotes.id = quote_items.quote_id AND rfqs.client_id = auth.uid()
  ));

-- RLS: notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
