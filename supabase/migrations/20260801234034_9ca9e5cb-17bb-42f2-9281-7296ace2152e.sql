-- Role guard for approvals
CREATE OR REPLACE FUNCTION public.guard_requisition_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'Approved' AND (OLD.status IS DISTINCT FROM 'Approved') THEN
    IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'project_manager') OR public.has_role(auth.uid(),'procurement_officer')) THEN
      RAISE EXCEPTION 'Not authorised to approve requisitions';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.guard_requisition_approval() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_vo_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'Approved' AND (OLD.status IS DISTINCT FROM 'Approved') THEN
    IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'project_manager')) THEN
      RAISE EXCEPTION 'Not authorised to approve variation orders';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.guard_vo_approval() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_requisition_approval ON public.requisitions;
CREATE TRIGGER trg_guard_requisition_approval BEFORE UPDATE ON public.requisitions
  FOR EACH ROW EXECUTE FUNCTION public.guard_requisition_approval();
DROP TRIGGER IF EXISTS trg_auto_create_po ON public.requisitions;
CREATE TRIGGER trg_auto_create_po AFTER UPDATE ON public.requisitions
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_po();

DROP TRIGGER IF EXISTS trg_guard_vo_approval ON public.variation_orders;
CREATE TRIGGER trg_guard_vo_approval BEFORE UPDATE ON public.variation_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_vo_approval();
DROP TRIGGER IF EXISTS trg_apply_vo ON public.variation_orders;
CREATE TRIGGER trg_apply_vo BEFORE UPDATE ON public.variation_orders
  FOR EACH ROW EXECUTE FUNCTION public.apply_vo_to_project();

-- helper predicates
CREATE OR REPLACE FUNCTION public.can_manage_costing(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role IN ('admin','accountant','project_manager'))
$$;
CREATE OR REPLACE FUNCTION public.can_manage_procurement(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role IN ('admin','procurement_officer'))
$$;
CREATE OR REPLACE FUNCTION public.can_manage_requisitions(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role IN ('admin','project_manager','procurement_officer','site_manager'))
$$;
CREATE OR REPLACE FUNCTION public.can_manage_site(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role IN ('admin','project_manager','site_manager'))
$$;
CREATE OR REPLACE FUNCTION public.can_manage_catalog(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role IN ('admin','accountant','procurement_officer'))
$$;
GRANT EXECUTE ON FUNCTION public.can_manage_costing(uuid), public.can_manage_procurement(uuid),
  public.can_manage_requisitions(uuid), public.can_manage_site(uuid), public.can_manage_catalog(uuid) TO authenticated;

-- Costing tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cost_codes','cost_sheets','cost_sheet_materials','cost_sheet_labour','cost_sheet_overhead'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_manage_costing(auth.uid()))', t||'_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_manage_costing(auth.uid())) WITH CHECK (public.can_manage_costing(auth.uid()))', t||'_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''accountant''))', t||'_delete', t);
  END LOOP;
END $$;

-- Requisitions
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['requisitions','requisition_lines'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_manage_requisitions(auth.uid()))', t||'_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_manage_requisitions(auth.uid())) WITH CHECK (public.can_manage_requisitions(auth.uid()))', t||'_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''project_manager''))', t||'_delete', t);
  END LOOP;
END $$;

-- Purchase orders
DROP POLICY IF EXISTS purchase_orders_insert ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_update ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_delete ON public.purchase_orders;
CREATE POLICY purchase_orders_insert ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (public.can_manage_procurement(auth.uid()));
CREATE POLICY purchase_orders_update ON public.purchase_orders FOR UPDATE TO authenticated USING (public.can_manage_procurement(auth.uid())) WITH CHECK (public.can_manage_procurement(auth.uid()));
CREATE POLICY purchase_orders_delete ON public.purchase_orders FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

-- Milestones
DROP POLICY IF EXISTS milestones_insert ON public.milestones;
DROP POLICY IF EXISTS milestones_update ON public.milestones;
DROP POLICY IF EXISTS milestones_delete ON public.milestones;
CREATE POLICY milestones_insert ON public.milestones FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'project_manager'));
CREATE POLICY milestones_update ON public.milestones FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'project_manager')) WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'project_manager'));
CREATE POLICY milestones_delete ON public.milestones FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'project_manager'));

-- Site reports
DROP POLICY IF EXISTS site_reports_insert ON public.site_reports;
DROP POLICY IF EXISTS site_reports_update ON public.site_reports;
DROP POLICY IF EXISTS site_reports_delete ON public.site_reports;
CREATE POLICY site_reports_insert ON public.site_reports FOR INSERT TO authenticated WITH CHECK (public.can_manage_site(auth.uid()));
CREATE POLICY site_reports_update ON public.site_reports FOR UPDATE TO authenticated USING (public.can_manage_site(auth.uid())) WITH CHECK (public.can_manage_site(auth.uid()));
CREATE POLICY site_reports_delete ON public.site_reports FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'project_manager'));

-- Documents & contacts
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['documents','contacts'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()))', t||'_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()))', t||'_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (is_privileged(auth.uid()))', t||'_delete', t);
  END LOOP;
END $$;

-- Catalog tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','uom','standard_rates'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_manage_catalog(auth.uid()))', t||'_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_manage_catalog(auth.uid())) WITH CHECK (public.can_manage_catalog(auth.uid()))', t||'_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (has_role(auth.uid(),''admin''))', t||'_delete', t);
  END LOOP;
END $$;

-- Variation orders
DROP POLICY IF EXISTS variation_orders_insert ON public.variation_orders;
DROP POLICY IF EXISTS variation_orders_update ON public.variation_orders;
DROP POLICY IF EXISTS variation_orders_delete ON public.variation_orders;
CREATE POLICY variation_orders_insert ON public.variation_orders FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'project_manager'));
CREATE POLICY variation_orders_update ON public.variation_orders FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'project_manager')) WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'project_manager'));
CREATE POLICY variation_orders_delete ON public.variation_orders FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));