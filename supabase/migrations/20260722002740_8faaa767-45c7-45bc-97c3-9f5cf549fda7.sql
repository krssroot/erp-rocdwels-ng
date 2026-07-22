
-- cost_sheets additive columns
ALTER TABLE public.cost_sheets
  ADD COLUMN IF NOT EXISTS analytic_account text,
  ADD COLUMN IF NOT EXISTS job_order text,
  ADD COLUMN IF NOT EXISTS sale_reference text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sheet_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS customer text;

-- cost_codes additive columns
ALTER TABLE public.cost_codes
  ADD COLUMN IF NOT EXISTS committed_amount numeric(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_amount numeric(18,2) DEFAULT 0;

-- uom
CREATE TABLE IF NOT EXISTS public.uom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uom TO authenticated;
GRANT ALL ON public.uom TO service_role;
ALTER TABLE public.uom ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='uom' AND policyname='auth all uom') THEN
    CREATE POLICY "auth all uom" ON public.uom TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
INSERT INTO public.uom (name) VALUES ('bags'),('tons'),('kg'),('meters'),('pieces'),('litres')
  ON CONFLICT (name) DO NOTHING;

-- products
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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='auth all products') THEN
    CREATE POLICY "auth all products" ON public.products TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- standard_rates
CREATE TABLE IF NOT EXISTS public.standard_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL UNIQUE,
  rate_per_hour numeric(18,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.standard_rates TO authenticated;
GRANT ALL ON public.standard_rates TO service_role;
ALTER TABLE public.standard_rates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='standard_rates' AND policyname='auth all standard_rates') THEN
    CREATE POLICY "auth all standard_rates" ON public.standard_rates TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
