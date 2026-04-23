
-- Create enums
CREATE TYPE public.user_role AS ENUM ('CLIENT', 'SUPPLIER', 'ADMIN');
CREATE TYPE public.user_status AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'REQUIRES_ATTENTION', 'DEACTIVATED', 'FROZEN');
CREATE TYPE public.kyc_status AS ENUM ('INCOMPLETE', 'IN_REVIEW', 'VERIFIED', 'REJECTED');
CREATE TYPE public.payment_terms AS ENUM ('net_30', 'prepaid');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'CLIENT',
  status user_status NOT NULL DEFAULT 'PENDING',
  kyc_status kyc_status NOT NULL DEFAULT 'INCOMPLETE',
  company_name TEXT,
  public_id TEXT UNIQUE,
  credit_limit NUMERIC DEFAULT 0,
  current_balance NUMERIC DEFAULT 0,
  payment_terms payment_terms DEFAULT 'prepaid',
  client_margin NUMERIC,
  frozen_at TIMESTAMPTZ,
  freeze_reason TEXT,
  frozen_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS: users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- RLS: users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = _role
  )
$$;

-- Admin can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Admin can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Function to generate public_id
CREATE OR REPLACE FUNCTION public.generate_public_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix TEXT;
  seq INT;
BEGIN
  IF NEW.role = 'CLIENT' THEN
    prefix := 'Client';
  ELSIF NEW.role = 'SUPPLIER' THEN
    prefix := 'Supplier';
  ELSE
    prefix := 'Admin';
  END IF;
  
  SELECT COUNT(*) + 1 INTO seq FROM public.profiles WHERE role = NEW.role;
  NEW.public_id := prefix || '-' || LPAD(seq::TEXT, 4, '0');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_public_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_public_id();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, company_name)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'CLIENT'),
    COALESCE(NEW.raw_user_meta_data->>'company_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
