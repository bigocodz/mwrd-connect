-- Simplify lead capture form: only name, email, and notes (message) are required.
-- Company, CR/VAT, phone and account type are no longer collected from the public form.
ALTER TABLE public.interest_submissions
  ALTER COLUMN company_name DROP NOT NULL,
  ALTER COLUMN cr_number DROP NOT NULL,
  ALTER COLUMN vat_number DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN account_type DROP NOT NULL;
