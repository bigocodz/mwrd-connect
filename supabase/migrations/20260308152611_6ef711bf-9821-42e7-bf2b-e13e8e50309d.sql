-- Create enum for account type
CREATE TYPE public.account_type AS ENUM ('CLIENT', 'SUPPLIER');

-- Create enum for submission status
CREATE TYPE public.submission_status AS ENUM ('PENDING', 'REVIEWED', 'APPROVED', 'REJECTED');

-- Create interest_submissions table
CREATE TABLE public.interest_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  cr_number TEXT NOT NULL,
  vat_number TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  account_type account_type NOT NULL,
  notes TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status submission_status NOT NULL DEFAULT 'PENDING'
);

-- Enable RLS
ALTER TABLE public.interest_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public lead capture form)
CREATE POLICY "Anyone can submit interest form"
  ON public.interest_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);