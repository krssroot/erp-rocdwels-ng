
-- 1. Fix mutable search_path
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 2. Revoke EXECUTE on SECURITY DEFINER functions that shouldn't be publicly callable
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_vo_to_project() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_create_po() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_roles(uuid) FROM PUBLIC, anon, authenticated;
-- has_role is used inside RLS policies; keep it callable by authenticated
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 3. Replace always-true ALL policies with signed-in write + open read (SELECT true is allowed by linter)
DO $$
DECLARE
  rec record;
  tables text[] := ARRAY['contacts','cost_codes','cost_sheet_labour','cost_sheet_materials',
    'cost_sheet_overhead','cost_sheets','documents','milestones','products',
    'purchase_orders','requisition_lines','requisitions','site_reports',
    'standard_rates','uom','variation_orders'];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- drop existing "auth all ..." style permissive ALL policies
    FOR rec IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND cmd='ALL' AND qual='true'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', rec.policyname, t);
    END LOOP;

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
                   t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)',
                   t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
                   t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL)',
                   t || '_delete', t);
  END LOOP;
END $$;

-- 4. Profiles: restrict read to self; admins already covered by "admin manage profiles"
DROP POLICY IF EXISTS "authenticated read profiles" ON public.profiles;
CREATE POLICY "self read profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. Suppliers: restrict read to privileged roles; tighten writes
DROP POLICY IF EXISTS "auth read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "auth write suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "auth update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "auth delete suppliers" ON public.suppliers;

CREATE POLICY "suppliers read privileged" ON public.suppliers
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'project_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
    OR public.has_role(auth.uid(), 'procurement_officer'::public.app_role)
  );
CREATE POLICY "suppliers write privileged" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'procurement_officer'::public.app_role)
  );
CREATE POLICY "suppliers update privileged" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'procurement_officer'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'procurement_officer'::public.app_role)
  );
CREATE POLICY "suppliers delete privileged" ON public.suppliers
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
