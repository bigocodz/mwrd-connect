
CREATE TYPE public.margin_setting_type AS ENUM ('GLOBAL', 'CATEGORY', 'CLIENT');

CREATE TABLE public.margin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.margin_setting_type NOT NULL,
  category text,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  margin_percent numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX unique_global_margin ON public.margin_settings (type) WHERE (type = 'GLOBAL');
CREATE UNIQUE INDEX unique_category_margin ON public.margin_settings (type, category) WHERE (type = 'CATEGORY');
CREATE UNIQUE INDEX unique_client_margin ON public.margin_settings (type, client_id) WHERE (type = 'CLIENT');

ALTER TABLE public.margin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read margin settings" ON public.margin_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admins can insert margin settings" ON public.margin_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admins can update margin settings" ON public.margin_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admins can delete margin settings" ON public.margin_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE TRIGGER update_margin_settings_updated_at BEFORE UPDATE ON public.margin_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.margin_settings (type, margin_percent) VALUES ('GLOBAL', 15);
