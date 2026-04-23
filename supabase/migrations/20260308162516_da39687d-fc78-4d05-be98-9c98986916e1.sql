
-- Payment method enum
CREATE TYPE public.payment_method AS ENUM ('BANK_TRANSFER', 'MADA', 'VISA_MASTERCARD', 'APPLE_PAY', 'STC_PAY');

-- Payment status enum
CREATE TYPE public.payment_status AS ENUM ('PENDING', 'PAID', 'DISCREPANCY');

-- Payments table
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'BANK_TRANSFER',
  status public.payment_status NOT NULL DEFAULT 'PENDING',
  bank_reference text,
  confirmed_by uuid REFERENCES public.profiles(id),
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Payment audit logs
CREATE TABLE public.payment_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all payments" ON public.payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admins can insert payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admins can update payments" ON public.payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Clients can read own payments" ON public.payments FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- RLS: payment_audit_logs
ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read payment audit logs" ON public.payment_audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admins can insert payment audit logs" ON public.payment_audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
