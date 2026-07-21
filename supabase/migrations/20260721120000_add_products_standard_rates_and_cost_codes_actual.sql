-- Migration: add uom, products, standard_rates and add actual_amount to cost_codes
-- Generated: 2026-07-21 12:00:00 UTC

CREATE TABLE IF NOT EXISTS public.uom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uom TO authenticated;
GRANT ALL ON public.uom TO service_role;
ALTER TABLE public.uom ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all uom" ON public.uom FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  standard_price numeric(18,2) DEFAULT 0,
  uom_id uuid REFERENCES public.uom(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.standard_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  rate_per_hour numeric(18,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.standard_rates TO authenticated;
GRANT ALL ON public.standard_rates TO service_role;
ALTER TABLE public.standard_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all standard_rates" ON public.standard_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add actual_amount to cost_codes if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cost_codes' AND column_name='actual_amount') THEN
    ALTER TABLE public.cost_codes ADD COLUMN actual_amount numeric(18,2) DEFAULT 0;
  END IF;
END$$;

-- Ensure triggers to touch updated_at exist for new tables
CREATE TRIGGER IF NOT EXISTS trg_uom_updated BEFORE UPDATE ON public.uom FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER IF NOT EXISTS trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER IF NOT EXISTS trg_standard_rates_updated BEFORE UPDATE ON public.standard_rates FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
