-- ============================================================
-- FIX ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Projects: users see only their assigned projects or if they're admin
DROP POLICY IF EXISTS "auth read projects" ON public.projects;
CREATE POLICY "projects_select" ON public.projects
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  project_manager_id = auth.uid() OR
  auth.uid() IN (
    SELECT user_id FROM project_members WHERE project_id = id
  )
);

-- Job Cost Sheets: restrict by project access
DROP POLICY IF EXISTS "auth all cost_sheets" ON public.cost_sheets;
CREATE POLICY "cost_sheets_select" ON public.cost_sheets
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'accountant'::app_role) OR
  project_id IN (
    SELECT id FROM projects WHERE 
      project_manager_id = auth.uid() OR
      auth.uid() IN (SELECT user_id FROM project_members WHERE project_id = id)
  )
);

CREATE POLICY "cost_sheets_insert" ON public.cost_sheets
FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "cost_sheets_update" ON public.cost_sheets
FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'accountant'::app_role) OR
  project_id IN (
    SELECT id FROM projects WHERE project_manager_id = auth.uid()
  )
);

CREATE POLICY "cost_sheets_delete" ON public.cost_sheets
FOR DELETE USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Documents: restrict by project access
DROP POLICY IF EXISTS "auth all documents" ON public.documents;
CREATE POLICY "documents_select" ON public.documents
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'accountant'::app_role) OR
  project_id IN (
    SELECT id FROM projects WHERE 
      project_manager_id = auth.uid() OR
      auth.uid() IN (SELECT user_id FROM project_members WHERE project_id = id)
  )
);

CREATE POLICY "documents_insert" ON public.documents
FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'project_manager'::app_role) OR
  public.has_role(auth.uid(), 'site_manager'::app_role)
);

CREATE POLICY "documents_delete" ON public.documents
FOR DELETE USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Requisitions: restrict creation and approval
DROP POLICY IF EXISTS "auth all requisitions" ON public.requisitions;
CREATE POLICY "requisitions_select" ON public.requisitions
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'accountant'::app_role) OR
  public.has_role(auth.uid(), 'project_manager'::app_role) OR
  public.has_role(auth.uid(), 'procurement_officer'::app_role) OR
  created_by = auth.uid()
);

CREATE POLICY "requisitions_insert" ON public.requisitions
FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'project_manager'::app_role) OR
  public.has_role(auth.uid(), 'site_manager'::app_role)
);

CREATE POLICY "requisitions_update" ON public.requisitions
FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  (public.has_role(auth.uid(), 'accountant'::app_role) AND status = 'Draft') OR
  (public.has_role(auth.uid(), 'procurement_officer'::app_role) AND status != 'Approved')
);

CREATE POLICY "requisitions_delete" ON public.requisitions
FOR DELETE USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Suppliers: restrict financial data to accountant and procurement
DROP POLICY IF EXISTS "auth read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "auth write suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "auth update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "auth delete suppliers" ON public.suppliers;

CREATE POLICY "suppliers_select" ON public.suppliers
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'accountant'::app_role) OR
  public.has_role(auth.uid(), 'procurement_officer'::app_role)
);

CREATE POLICY "suppliers_insert" ON public.suppliers
FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'procurement_officer'::app_role)
);

CREATE POLICY "suppliers_update" ON public.suppliers
FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  (public.has_role(auth.uid(), 'procurement_officer'::app_role) AND created_by = auth.uid())
);

CREATE POLICY "suppliers_delete" ON public.suppliers
FOR DELETE USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Cost Codes: accountant and admin only
DROP POLICY IF EXISTS "auth all cost_codes" ON public.cost_codes;
CREATE POLICY "cost_codes_select" ON public.cost_codes
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'accountant'::app_role) OR
  project_id IN (
    SELECT id FROM projects WHERE project_manager_id = auth.uid()
  )
);

CREATE POLICY "cost_codes_insert" ON public.cost_codes
FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'accountant'::app_role)
);

CREATE POLICY "cost_codes_delete" ON public.cost_codes
FOR DELETE USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Site Reports: site managers only
DROP POLICY IF EXISTS "auth all sr" ON public.site_reports;
CREATE POLICY "site_reports_select" ON public.site_reports
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  project_id IN (
    SELECT id FROM projects WHERE 
      auth.uid() IN (SELECT user_id FROM project_members WHERE project_id = id)
  ) OR
  site_manager_id = auth.uid()
);

CREATE POLICY "site_reports_insert" ON public.site_reports
FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'site_manager'::app_role)
);

CREATE POLICY "site_reports_delete" ON public.site_reports
FOR DELETE USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Purchase Orders: procurement and admin
DROP POLICY IF EXISTS "auth all po" ON public.purchase_orders;
CREATE POLICY "purchase_orders_select" ON public.purchase_orders
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'procurement_officer'::app_role) OR
  public.has_role(auth.uid(), 'accountant'::app_role)
);

CREATE POLICY "purchase_orders_insert" ON public.purchase_orders
FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'procurement_officer'::app_role)
);

CREATE POLICY "purchase_orders_delete" ON public.purchase_orders
FOR DELETE USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- User profiles: users see only their own (admins see all)
DROP POLICY IF EXISTS "authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "self update profile" ON public.profiles;
DROP POLICY IF EXISTS "admin manage profiles" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT USING (
  id = auth.uid() OR
  public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "profiles_update" ON public.profiles
FOR UPDATE USING (
  id = auth.uid() OR
  public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "profiles_admin_all" ON public.profiles
FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::app_role)
) WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Budgets: accountant and admin only (add policy if table exists)
DROP POLICY IF EXISTS "auth all budgets" ON public.budgets;
CREATE POLICY "budgets_select" ON public.budgets
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'accountant'::app_role)
);

-- Variation Orders: project managers and admins
DROP POLICY IF EXISTS "auth all vo" ON public.variation_orders;
CREATE POLICY "variation_orders_select" ON public.variation_orders
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  project_id IN (
    SELECT id FROM projects WHERE project_manager_id = auth.uid()
  )
);

CREATE POLICY "variation_orders_insert" ON public.variation_orders
FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  project_id IN (
    SELECT id FROM projects WHERE project_manager_id = auth.uid()
  )
);

CREATE POLICY "variation_orders_delete" ON public.variation_orders
FOR DELETE USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Milestones: project managers and admins
DROP POLICY IF EXISTS "auth all ms" ON public.milestones;
CREATE POLICY "milestones_select" ON public.milestones
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  project_id IN (
    SELECT id FROM projects WHERE project_manager_id = auth.uid()
  )
);

CREATE POLICY "milestones_insert" ON public.milestones
FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "milestones_delete" ON public.milestones
FOR DELETE USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Contacts: project managers and admins
DROP POLICY IF EXISTS "auth all contacts" ON public.contacts;
CREATE POLICY "contacts_select" ON public.contacts
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'project_manager'::app_role) OR
  project_id IN (
    SELECT id FROM projects WHERE 
      auth.uid() IN (SELECT user_id FROM project_members WHERE project_id = id)
  )
);

CREATE POLICY "contacts_insert" ON public.contacts
FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "contacts_delete" ON public.contacts
FOR DELETE USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);
