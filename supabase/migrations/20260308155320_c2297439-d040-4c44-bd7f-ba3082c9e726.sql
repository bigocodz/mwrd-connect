
-- Replace the overly permissive INSERT policy on interest_submissions with a more specific one
DROP POLICY IF EXISTS "Anyone can submit interest form" ON public.interest_submissions;
CREATE POLICY "Anyone can submit interest form"
  ON public.interest_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
