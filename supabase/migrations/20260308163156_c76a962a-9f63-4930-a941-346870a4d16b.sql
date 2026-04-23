
-- Reviews table
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can insert own reviews" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid() AND public.has_role(auth.uid(), 'CLIENT'));
CREATE POLICY "Clients can read own reviews" ON public.reviews FOR SELECT TO authenticated
  USING (client_id = auth.uid());
CREATE POLICY "Suppliers can read own reviews" ON public.reviews FOR SELECT TO authenticated
  USING (supplier_id = auth.uid());
CREATE POLICY "Admins can read all reviews" ON public.reviews FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Add target_type and target_id to admin_audit_log for richer audit trail
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS target_type text;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS target_id uuid;
