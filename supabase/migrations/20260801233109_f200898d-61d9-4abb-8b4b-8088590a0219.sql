
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.user_id = _user_id AND pm.project_id = _project_id
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_privileged(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','project_manager','accountant','procurement_officer')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_privileged(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_privileged(uuid) TO authenticated;

-- activity logs: admins only (plus own actions)
DROP POLICY IF EXISTS activity_logs_read_all_authed ON public.activity_logs;
CREATE POLICY activity_logs_read_admin ON public.activity_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR actor_id = auth.uid());

-- contacts
DROP POLICY IF EXISTS contacts_select ON public.contacts;
CREATE POLICY contacts_select ON public.contacts FOR SELECT TO authenticated
USING (public.is_privileged(auth.uid()) OR public.is_project_member(auth.uid(), project_id));

-- documents
DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated
USING (public.is_privileged(auth.uid()) OR public.is_project_member(auth.uid(), project_id) OR uploaded_by = auth.uid());

-- projects and project members
DROP POLICY IF EXISTS "auth read projects" ON public.projects;
CREATE POLICY "auth read projects" ON public.projects FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "auth read pm" ON public.project_members;
CREATE POLICY "auth read pm" ON public.project_members FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

-- financial / operational tables: staff only
DROP POLICY IF EXISTS cost_codes_select ON public.cost_codes;
CREATE POLICY cost_codes_select ON public.cost_codes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS cost_sheets_select ON public.cost_sheets;
CREATE POLICY cost_sheets_select ON public.cost_sheets FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS cost_sheet_labour_select ON public.cost_sheet_labour;
CREATE POLICY cost_sheet_labour_select ON public.cost_sheet_labour FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS cost_sheet_materials_select ON public.cost_sheet_materials;
CREATE POLICY cost_sheet_materials_select ON public.cost_sheet_materials FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS cost_sheet_overhead_select ON public.cost_sheet_overhead;
CREATE POLICY cost_sheet_overhead_select ON public.cost_sheet_overhead FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS requisitions_select ON public.requisitions;
CREATE POLICY requisitions_select ON public.requisitions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS requisition_lines_select ON public.requisition_lines;
CREATE POLICY requisition_lines_select ON public.requisition_lines FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS purchase_orders_select ON public.purchase_orders;
CREATE POLICY purchase_orders_select ON public.purchase_orders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS milestones_select ON public.milestones;
CREATE POLICY milestones_select ON public.milestones FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS site_reports_select ON public.site_reports;
CREATE POLICY site_reports_select ON public.site_reports FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS variation_orders_select ON public.variation_orders;
CREATE POLICY variation_orders_select ON public.variation_orders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS standard_rates_select ON public.standard_rates;
CREATE POLICY standard_rates_select ON public.standard_rates FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- reference data: staff only
DROP POLICY IF EXISTS products_select ON public.products;
CREATE POLICY products_select ON public.products FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS uom_select ON public.uom;
CREATE POLICY uom_select ON public.uom FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
