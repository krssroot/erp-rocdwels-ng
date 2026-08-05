
-- =============== APPROVAL HISTORY ===============
CREATE TABLE IF NOT EXISTS public.approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid REFERENCES public.requisitions(id) ON DELETE CASCADE,
  budget_id uuid REFERENCES public.cost_sheets(id) ON DELETE CASCADE,
  entity_type text NOT NULL DEFAULT 'requisition',
  action text NOT NULL,
  from_status text,
  to_status text,
  by_user_id uuid,
  by_email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.approval_history TO authenticated;
GRANT ALL ON public.approval_history TO service_role;
ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ah_select_staff" ON public.approval_history;
CREATE POLICY "ah_select_staff" ON public.approval_history FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "ah_insert_staff" ON public.approval_history;
CREATE POLICY "ah_insert_staff" ON public.approval_history FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_ah_req ON public.approval_history(requisition_id);
CREATE INDEX IF NOT EXISTS idx_ah_budget ON public.approval_history(budget_id);

-- =============== PAYMENT SCHEDULES ===============
CREATE TABLE IF NOT EXISTS public.payment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES public.requisitions(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id),
  amount numeric NOT NULL DEFAULT 0,
  bank text,
  due_date date,
  notes text,
  status text NOT NULL DEFAULT 'Scheduled',
  confirmed_at timestamptz,
  confirmed_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_schedules TO authenticated;
GRANT ALL ON public.payment_schedules TO service_role;
ALTER TABLE public.payment_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ps_select_staff" ON public.payment_schedules;
CREATE POLICY "ps_select_staff" ON public.payment_schedules FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "ps_insert_acct" ON public.payment_schedules;
CREATE POLICY "ps_insert_acct" ON public.payment_schedules FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'accountant') OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "ps_update_acct" ON public.payment_schedules;
CREATE POLICY "ps_update_acct" ON public.payment_schedules FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'accountant') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'accountant') OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "ps_delete_acct" ON public.payment_schedules;
CREATE POLICY "ps_delete_acct" ON public.payment_schedules FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'accountant') OR public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS trg_ps_updated ON public.payment_schedules;
CREATE TRIGGER trg_ps_updated BEFORE UPDATE ON public.payment_schedules FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =============== WORKFLOW COLUMNS ===============
ALTER TABLE public.cost_sheets
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS vetted_by uuid,
  ADD COLUMN IF NOT EXISTS vetted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.requisitions
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS vetted_by uuid,
  ADD COLUMN IF NOT EXISTS vetted_at timestamptz,
  ADD COLUMN IF NOT EXISTS po_created_by uuid,
  ADD COLUMN IF NOT EXISTS po_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS md_approved_by uuid,
  ADD COLUMN IF NOT EXISTS md_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_by uuid,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- =============== BUDGET (COST SHEET) WORKFLOW ===============
CREATE OR REPLACE FUNCTION public.tg_budget_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); em text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT email INTO em FROM public.profiles WHERE id = uid;

  IF NEW.status = 'Submitted for Vetting' THEN
    IF NOT (public.has_role(uid,'site_manager') OR public.has_role(uid,'procurement_officer') OR public.has_role(uid,'admin')) THEN
      RAISE EXCEPTION 'Only a Site Manager or Procurement Officer can submit a budget for vetting';
    END IF;
    NEW.submitted_by := uid; NEW.submitted_at := now();
  ELSIF NEW.status = 'Vetted' THEN
    IF NOT (public.has_role(uid,'head_quantity_surveyor') OR public.has_role(uid,'admin')) THEN
      RAISE EXCEPTION 'Only the Head Quantity Surveyor can vet a budget';
    END IF;
    NEW.vetted_by := uid; NEW.vetted_at := now();
  ELSIF NEW.status = 'Approved' THEN
    IF NOT public.has_role(uid,'admin') THEN
      RAISE EXCEPTION 'Only the Managing Director can approve a budget';
    END IF;
    NEW.approved_by := uid; NEW.approved_at := now();
  ELSIF NEW.status = 'Rejected' THEN
    IF NOT public.has_role(uid,'admin') THEN
      RAISE EXCEPTION 'Only the Managing Director can reject a budget';
    END IF;
    NEW.rejected_by := uid; NEW.rejected_at := now();
  END IF;

  INSERT INTO public.approval_history (budget_id, entity_type, action, from_status, to_status, by_user_id, by_email, notes)
  VALUES (NEW.id, 'budget', lower(NEW.status), OLD.status, NEW.status, uid, em, NEW.rejection_reason);

  IF NEW.status = 'Submitted for Vetting' THEN
    PERFORM public.notify_roles(ARRAY['head_quantity_surveyor','admin']::app_role[],
      'Budget awaiting vetting', COALESCE(NEW.number,'Budget') || ' needs your vetting', 'approval', '/cost-sheets/' || NEW.id::text);
  ELSIF NEW.status = 'Vetted' THEN
    PERFORM public.notify_roles(ARRAY['admin']::app_role[],
      'Budget awaiting MD approval', COALESCE(NEW.number,'Budget') || ' has been vetted and needs final approval', 'approval', '/cost-sheets/' || NEW.id::text);
  ELSIF NEW.status IN ('Approved','Rejected') THEN
    PERFORM public.notify_user(NEW.created_by, 'Budget ' || NEW.status,
      COALESCE(NEW.number,'Budget') || ' was ' || lower(NEW.status), 'status', '/cost-sheets/' || NEW.id::text);
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tg_budget_workflow() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_cost_sheet ON public.cost_sheets;
DROP TRIGGER IF EXISTS trg_budget_workflow ON public.cost_sheets;
CREATE TRIGGER trg_budget_workflow BEFORE UPDATE ON public.cost_sheets FOR EACH ROW EXECUTE FUNCTION public.tg_budget_workflow();

-- =============== REQUISITION WORKFLOW ===============
CREATE OR REPLACE FUNCTION public.tg_requisition_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); em text; sup uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT email INTO em FROM public.profiles WHERE id = uid;

  IF NEW.status IN ('Pending Vetting','Pending PO') THEN
    NEW.submitted_by := uid; NEW.submitted_at := now();
  ELSIF NEW.status = 'MD Approval' THEN
    IF OLD.status = 'Pending Vetting' AND NOT (public.has_role(uid,'head_quantity_surveyor') OR public.has_role(uid,'admin')) THEN
      RAISE EXCEPTION 'Only the Head Quantity Surveyor can vet a labour requisition';
    END IF;
    IF OLD.status = 'Pending PO' AND NOT (public.has_role(uid,'procurement_officer') OR public.has_role(uid,'admin')) THEN
      RAISE EXCEPTION 'Only the Procurement Officer can raise the purchase order';
    END IF;
    IF OLD.status = 'Pending Vetting' THEN NEW.vetted_by := uid; NEW.vetted_at := now();
    ELSE NEW.po_created_by := uid; NEW.po_created_at := now(); END IF;
  ELSIF NEW.status = 'Payment Schedule' THEN
    IF NOT public.has_role(uid,'admin') THEN
      RAISE EXCEPTION 'Only the Managing Director can approve a requisition';
    END IF;
    NEW.md_approved_by := uid; NEW.md_approved_at := now();
  ELSIF NEW.status = 'Payment Confirmed' THEN
    IF NOT (public.has_role(uid,'accountant') OR public.has_role(uid,'admin')) THEN
      RAISE EXCEPTION 'Only the Accountant can confirm payment';
    END IF;
    NEW.scheduled_by := uid; NEW.scheduled_at := now();
  ELSIF NEW.status = 'Paid' THEN
    IF NOT (public.has_role(uid,'accountant') OR public.has_role(uid,'admin')) THEN
      RAISE EXCEPTION 'Only the Accountant can mark a requisition as paid';
    END IF;
    NEW.paid_by := uid; NEW.paid_at := now();
  ELSIF NEW.status = 'Rejected' THEN
    IF NOT public.has_role(uid,'admin') THEN
      RAISE EXCEPTION 'Only the Managing Director can reject a requisition';
    END IF;
    NEW.rejected_by := uid; NEW.rejected_at := now();
  END IF;

  INSERT INTO public.approval_history (requisition_id, entity_type, action, from_status, to_status, by_user_id, by_email, notes)
  VALUES (NEW.id, 'requisition', lower(NEW.status), OLD.status, NEW.status, uid, em, NEW.rejection_reason);

  -- Auto purchase order when procurement pushes a materials requisition forward
  IF NEW.status = 'MD Approval' AND OLD.status = 'Pending PO'
     AND NOT EXISTS (SELECT 1 FROM public.purchase_orders WHERE requisition_id = NEW.id AND deleted_at IS NULL) THEN
    SELECT supplier_id INTO sup FROM public.requisition_lines WHERE requisition_id = NEW.id AND supplier_id IS NOT NULL LIMIT 1;
    INSERT INTO public.purchase_orders (requisition_id, supplier_id, project_id, total_amount, status)
    VALUES (NEW.id, sup, NEW.project_id, NEW.total_amount, 'Issued');
  END IF;

  -- Notifications
  IF NEW.status = 'Pending Vetting' THEN
    PERFORM public.notify_roles(ARRAY['head_quantity_surveyor','admin']::app_role[],
      'Labour requisition awaiting vetting', COALESCE(NEW.number,'Requisition') || ' needs your vetting', 'approval', '/requisitions');
  ELSIF NEW.status = 'Pending PO' THEN
    PERFORM public.notify_roles(ARRAY['procurement_officer','admin']::app_role[],
      'Materials requisition awaiting purchase order', COALESCE(NEW.number,'Requisition') || ' needs a purchase order', 'procurement', '/requisitions');
  ELSIF NEW.status = 'MD Approval' THEN
    PERFORM public.notify_roles(ARRAY['admin']::app_role[],
      'Requisition awaiting MD approval', COALESCE(NEW.number,'Requisition') || ' needs final approval', 'approval', '/requisitions');
  ELSIF NEW.status = 'Payment Schedule' THEN
    PERFORM public.notify_roles(ARRAY['accountant','admin']::app_role[],
      'Payment schedule required', COALESCE(NEW.number,'Requisition') || ' was approved and needs a payment schedule', 'payment', '/requisitions');
  ELSIF NEW.status IN ('Paid','Rejected') THEN
    PERFORM public.notify_user(NEW.created_by, 'Requisition ' || NEW.status,
      COALESCE(NEW.number,'Requisition') || ' is now ' || lower(NEW.status), 'status', '/requisitions');
  END IF;

  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tg_requisition_workflow() FROM PUBLIC, anon, authenticated;

-- Replace the old duplicated approval/PO triggers with the single workflow trigger
DROP TRIGGER IF EXISTS notify_requisition ON public.requisitions;
DROP TRIGGER IF EXISTS trg_auto_create_po ON public.requisitions;
DROP TRIGGER IF EXISTS trg_auto_po ON public.requisitions;
DROP TRIGGER IF EXISTS trg_req_auto_po ON public.requisitions;
DROP TRIGGER IF EXISTS trg_guard_req ON public.requisitions;
DROP TRIGGER IF EXISTS trg_guard_requisition_approval ON public.requisitions;
DROP TRIGGER IF EXISTS trg_requisition_workflow ON public.requisitions;
CREATE TRIGGER trg_requisition_workflow BEFORE UPDATE ON public.requisitions FOR EACH ROW EXECUTE FUNCTION public.tg_requisition_workflow();

-- =============== EXPENDITURE ON PAID ONLY ===============
CREATE OR REPLACE FUNCTION public.tg_requisition_expenditure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'Paid' AND OLD.status IS DISTINCT FROM 'Paid' AND NEW.cost_code_id IS NOT NULL THEN
    UPDATE public.cost_codes
      SET actual_amount = COALESCE(actual_amount,0) + COALESCE(NEW.total_amount,0)
      WHERE id = NEW.cost_code_id;
  ELSIF OLD.status = 'Paid' AND NEW.status IS DISTINCT FROM 'Paid' AND NEW.cost_code_id IS NOT NULL THEN
    UPDATE public.cost_codes
      SET actual_amount = GREATEST(COALESCE(actual_amount,0) - COALESCE(NEW.total_amount,0), 0)
      WHERE id = NEW.cost_code_id;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tg_requisition_expenditure() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_req_expenditure ON public.requisitions;
CREATE TRIGGER trg_req_expenditure AFTER UPDATE ON public.requisitions FOR EACH ROW EXECUTE FUNCTION public.tg_requisition_expenditure();

-- =============== PAYMENT CONFIRMATION -> PAID ===============
CREATE OR REPLACE FUNCTION public.tg_payment_schedule_confirm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'Confirmed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'Confirmed') THEN
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
    NEW.confirmed_by := COALESCE(NEW.confirmed_by, auth.uid());
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tg_payment_schedule_confirm() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_ps_confirm ON public.payment_schedules;
CREATE TRIGGER trg_ps_confirm BEFORE INSERT OR UPDATE ON public.payment_schedules FOR EACH ROW EXECUTE FUNCTION public.tg_payment_schedule_confirm();

-- =============== ROLE ASSIGNMENT FOR NEW HQS STAFF ===============
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
      WHEN email_local LIKE 'admin%' OR email_local LIKE 'md%' THEN 'admin'::app_role
      WHEN email_local LIKE 'hqs%' OR email_local LIKE 'qs%' OR email_local LIKE 'surveyor%' THEN 'head_quantity_surveyor'::app_role
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
END; $$;

-- HQS needs the same module access as other privileged staff
CREATE OR REPLACE FUNCTION public.is_privileged(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','project_manager','accountant','procurement_officer','head_quantity_surveyor')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_costing(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role IN ('admin','accountant','project_manager','head_quantity_surveyor','site_manager','procurement_officer'))
$$;

CREATE OR REPLACE FUNCTION public.can_manage_requisitions(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_uid)
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_costing(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_requisitions(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_privileged(uuid) FROM PUBLIC, anon;
