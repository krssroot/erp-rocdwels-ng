
-- ============================================================
-- ROLES
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin','project_manager','site_manager','accountant','procurement_officer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  phone text,
  job_title text,
  department text,
  start_date date,
  status text NOT NULL DEFAULT 'Active',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "self update profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "admin manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Auto profile + role assignment on signup based on email domain
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  email_local text;
  assigned_role app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  IF lower(split_part(NEW.email,'@',2)) = 'rocdwels.ng' THEN
    email_local := lower(split_part(NEW.email,'@',1));
    assigned_role := CASE
      WHEN email_local LIKE 'admin%' THEN 'admin'::app_role
      WHEN email_local LIKE 'pm%' OR email_local LIKE 'projectmanager%' THEN 'project_manager'::app_role
      WHEN email_local LIKE 'site%' THEN 'site_manager'::app_role
      WHEN email_local LIKE 'accountant%' OR email_local LIKE 'finance%' THEN 'accountant'::app_role
      WHEN email_local LIKE 'procurement%' OR email_local LIKE 'purchase%' THEN 'procurement_officer'::app_role
      ELSE 'project_manager'::app_role
    END;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Generic updated_at
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  category text,
  tax_id text,
  bank_details text,
  rating int DEFAULT 0,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client text,
  location text,
  contract_value numeric(18,2) DEFAULT 0,
  start_date date,
  end_date date,
  project_manager_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'Active',
  percent_complete numeric(5,2) DEFAULT 0,
  description text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert projects" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'project_manager'));
CREATE POLICY "auth update projects" ON public.projects FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR project_manager_id = auth.uid());
CREATE POLICY "auth delete projects" ON public.projects FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Assigned staff (many-to-many)
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_on_project text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pm" ON public.project_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write pm" ON public.project_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'project_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'project_manager'));

-- ============================================================
-- COST CODES
-- ============================================================
CREATE TABLE public.cost_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code text NOT NULL,
  category text NOT NULL DEFAULT 'Materials',
  description text,
  budgeted_amount numeric(18,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_codes TO authenticated;
GRANT ALL ON public.cost_codes TO service_role;
ALTER TABLE public.cost_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all cost_codes" ON public.cost_codes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_cc_updated BEFORE UPDATE ON public.cost_codes FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============================================================
-- JOB COST SHEETS
-- ============================================================
CREATE SEQUENCE public.jcs_seq START 1;
CREATE TABLE public.cost_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL DEFAULT ('JCS/' || lpad(nextval('public.jcs_seq')::text, 5, '0')),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  cost_code_id uuid REFERENCES public.cost_codes(id) ON DELETE SET NULL,
  title text,
  status text NOT NULL DEFAULT 'Draft',
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_sheets TO authenticated;
GRANT ALL ON public.cost_sheets TO service_role;
ALTER TABLE public.cost_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all cost_sheets" ON public.cost_sheets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_cs_updated BEFORE UPDATE ON public.cost_sheets FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.cost_sheet_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_sheet_id uuid NOT NULL REFERENCES public.cost_sheets(id) ON DELETE CASCADE,
  line_date date DEFAULT CURRENT_DATE,
  product text,
  description text,
  planned_qty numeric(18,3) DEFAULT 0,
  uom text,
  unit_cost numeric(18,2) DEFAULT 0,
  planned_amount numeric(18,2) DEFAULT 0,
  actual_req_qty numeric(18,3) DEFAULT 0,
  actual_purchased_qty numeric(18,3) DEFAULT 0,
  actual_purchased_cost numeric(18,2) DEFAULT 0,
  vendor_bill_qty numeric(18,3) DEFAULT 0,
  vendor_bill_cost numeric(18,2) DEFAULT 0,
  invoice_subtotal numeric(18,2) DEFAULT 0,
  cost_price_subtotal numeric(18,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_sheet_materials TO authenticated;
GRANT ALL ON public.cost_sheet_materials TO service_role;
ALTER TABLE public.cost_sheet_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all csm" ON public.cost_sheet_materials FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.cost_sheet_labour (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_sheet_id uuid NOT NULL REFERENCES public.cost_sheets(id) ON DELETE CASCADE,
  line_date date DEFAULT CURRENT_DATE,
  job_type text,
  worker text,
  description text,
  planned_days numeric(10,2) DEFAULT 0,
  daily_rate numeric(18,2) DEFAULT 0,
  planned_cost numeric(18,2) DEFAULT 0,
  actual_days numeric(10,2) DEFAULT 0,
  actual_cost numeric(18,2) DEFAULT 0,
  variance numeric(18,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_sheet_labour TO authenticated;
GRANT ALL ON public.cost_sheet_labour TO service_role;
ALTER TABLE public.cost_sheet_labour ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all csl" ON public.cost_sheet_labour FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.cost_sheet_overhead (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_sheet_id uuid NOT NULL REFERENCES public.cost_sheets(id) ON DELETE CASCADE,
  line_date date DEFAULT CURRENT_DATE,
  category text,
  description text,
  planned_amount numeric(18,2) DEFAULT 0,
  actual_amount numeric(18,2) DEFAULT 0,
  variance numeric(18,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_sheet_overhead TO authenticated;
GRANT ALL ON public.cost_sheet_overhead TO service_role;
ALTER TABLE public.cost_sheet_overhead ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all cso" ON public.cost_sheet_overhead FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- REQUISITIONS
-- ============================================================
CREATE SEQUENCE public.req_seq START 1;
CREATE TABLE public.requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL DEFAULT ('REQ/' || lpad(nextval('public.req_seq')::text, 5, '0')),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  cost_code_id uuid REFERENCES public.cost_codes(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'Materials',
  employee_id uuid REFERENCES public.profiles(id),
  department text,
  deadline date,
  is_change_order boolean DEFAULT false,
  status text NOT NULL DEFAULT 'Draft',
  notes text,
  total_amount numeric(18,2) DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisitions TO authenticated;
GRANT ALL ON public.requisitions TO service_role;
ALTER TABLE public.requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all requisitions" ON public.requisitions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_req_updated BEFORE UPDATE ON public.requisitions FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.requisition_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES public.requisitions(id) ON DELETE CASCADE,
  item_name text,
  qty numeric(18,3) DEFAULT 0,
  unit text,
  unit_cost numeric(18,2) DEFAULT 0,
  total numeric(18,2) DEFAULT 0,
  supplier_id uuid REFERENCES public.suppliers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisition_lines TO authenticated;
GRANT ALL ON public.requisition_lines TO service_role;
ALTER TABLE public.requisition_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all req lines" ON public.requisition_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
CREATE SEQUENCE public.po_seq START 1;
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL DEFAULT ('PO/' || lpad(nextval('public.po_seq')::text, 5, '0')),
  requisition_id uuid REFERENCES public.requisitions(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id),
  project_id uuid REFERENCES public.projects(id),
  status text NOT NULL DEFAULT 'Issued',
  total_amount numeric(18,2) DEFAULT 0,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all po" ON public.purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_po_updated BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Auto-create PO when requisition Approved
CREATE OR REPLACE FUNCTION public.auto_create_po()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sup uuid;
BEGIN
  IF NEW.status = 'Approved' AND (OLD.status IS DISTINCT FROM 'Approved') THEN
    SELECT supplier_id INTO sup FROM public.requisition_lines WHERE requisition_id = NEW.id AND supplier_id IS NOT NULL LIMIT 1;
    INSERT INTO public.purchase_orders (requisition_id, supplier_id, project_id, total_amount, status)
    VALUES (NEW.id, sup, NEW.project_id, NEW.total_amount, 'Issued');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_req_auto_po AFTER UPDATE ON public.requisitions
FOR EACH ROW EXECUTE FUNCTION public.auto_create_po();

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  doc_type text,
  version text,
  expiry_date date,
  file_url text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  uploaded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all documents" ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- DAILY SITE REPORTS
-- ============================================================
CREATE TABLE public.site_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  site_manager_id uuid REFERENCES public.profiles(id),
  weather text,
  workers_count int DEFAULT 0,
  work_done jsonb DEFAULT '[]'::jsonb,
  materials_used jsonb DEFAULT '[]'::jsonb,
  issues jsonb DEFAULT '[]'::jsonb,
  tomorrow_plan text,
  status text NOT NULL DEFAULT 'Draft',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_reports TO authenticated;
GRANT ALL ON public.site_reports TO service_role;
ALTER TABLE public.site_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all sr" ON public.site_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- VARIATION ORDERS
-- ============================================================
CREATE TABLE public.variation_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  description text,
  amount numeric(18,2) DEFAULT 0,
  vo_type text,
  status text NOT NULL DEFAULT 'Pending',
  created_by uuid DEFAULT auth.uid(),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.variation_orders TO authenticated;
GRANT ALL ON public.variation_orders TO service_role;
ALTER TABLE public.variation_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all vo" ON public.variation_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.apply_vo_to_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'Approved' AND (OLD.status IS DISTINCT FROM 'Approved') THEN
    UPDATE public.projects SET contract_value = COALESCE(contract_value,0) + COALESCE(NEW.amount,0)
    WHERE id = NEW.project_id;
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_vo_apply BEFORE UPDATE ON public.variation_orders
FOR EACH ROW EXECUTE FUNCTION public.apply_vo_to_project();

-- ============================================================
-- MILESTONES
-- ============================================================
CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_date date,
  actual_date date,
  percent_complete numeric(5,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO authenticated;
GRANT ALL ON public.milestones TO service_role;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all ms" ON public.milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- CONTACTS
-- ============================================================
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_type text,
  phone text,
  email text,
  company text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all contacts" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  kind text DEFAULT 'system',
  read boolean DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
