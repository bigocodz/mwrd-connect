
-- Payout method enum
CREATE TYPE public.payout_method AS ENUM ('BANK_TRANSFER', 'CHECK');

-- Payout status enum
CREATE TYPE public.payout_status AS ENUM ('PENDING', 'PAID');

-- Supplier payouts table
CREATE TABLE public.supplier_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  payment_method public.payout_method NOT NULL DEFAULT 'BANK_TRANSFER',
  bank_reference text,
  status public.payout_status NOT NULL DEFAULT 'PENDING',
  paid_at timestamptz,
  recorded_by uuid NOT NULL REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.supplier_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all payouts" ON public.supplier_payouts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admins can insert payouts" ON public.supplier_payouts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admins can update payouts" ON public.supplier_payouts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Suppliers can read own payouts" ON public.supplier_payouts FOR SELECT TO authenticated
  USING (supplier_id = auth.uid());
