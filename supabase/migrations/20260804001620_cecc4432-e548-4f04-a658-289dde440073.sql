
-- ============ APPROVAL STEPS ============
CREATE TABLE public.approval_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  sequence integer NOT NULL DEFAULT 1,
  stage text NOT NULL,
  approver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approver_email text,
  approver_role app_role,
  status text NOT NULL DEFAULT 'Pending',
  decision text,
  comments text,
  due_at timestamptz,
  decided_at timestamptz,
  escalated_at timestamptz,
  escalated_to app_role,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX idx_approval_steps_entity ON public.approval_steps(entity_type, entity_id);
CREATE INDEX idx_approval_steps_due ON public.approval_steps(status, due_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_steps TO authenticated;
GRANT ALL ON public.approval_steps TO service_role;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_steps_select_staff" ON public.approval_steps FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "approval_steps_insert" ON public.approval_steps FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "approval_steps_update" ON public.approval_steps FOR UPDATE TO authenticated
  USING (public.is_privileged(auth.uid()) OR approver_id = auth.uid())
  WITH CHECK (public.is_privileged(auth.uid()) OR approver_id = auth.uid());
CREATE POLICY "approval_steps_delete" ON public.approval_steps FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_approval_steps_updated BEFORE UPDATE ON public.approval_steps
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ DISCUSSIONS (CHATTER) ============
CREATE TABLE public.discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  parent_id uuid REFERENCES public.discussions(id) ON DELETE CASCADE,
  body text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT '{}',
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email text,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX idx_discussions_entity ON public.discussions(entity_type, entity_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discussions TO authenticated;
GRANT ALL ON public.discussions TO service_role;
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discussions_select_staff" ON public.discussions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "discussions_insert_own" ON public.discussions FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY "discussions_update_own" ON public.discussions FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "discussions_delete_own_or_admin" ON public.discussions FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_discussions_updated BEFORE UPDATE ON public.discussions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- notify mentioned users
CREATE OR REPLACE FUNCTION public.tg_notify_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m uuid;
BEGIN
  FOREACH m IN ARRAY COALESCE(NEW.mentions, '{}'::uuid[]) LOOP
    IF m <> COALESCE(NEW.author_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      PERFORM public.notify_user(m, 'You were mentioned',
        COALESCE(NEW.author_name, NEW.author_email, 'Someone') || ' mentioned you in a discussion',
        'mention', NULL);
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tg_notify_mentions() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_notify_mentions AFTER INSERT ON public.discussions
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_mentions();

-- ============ ATTACHMENTS ============
CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  version integer NOT NULL DEFAULT 1,
  notes text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX idx_attachments_entity ON public.attachments(entity_type, entity_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_select_staff" ON public.attachments FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "attachments_insert_own" ON public.attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY "attachments_update" ON public.attachments FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_privileged(auth.uid()))
  WITH CHECK (uploaded_by = auth.uid() OR public.is_privileged(auth.uid()));
CREATE POLICY "attachments_delete" ON public.attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_attachments_updated BEFORE UPDATE ON public.attachments
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ SUPPLIER QUOTES ============
CREATE TABLE public.supplier_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid REFERENCES public.requisitions(id) ON DELETE CASCADE,
  requisition_line_id uuid REFERENCES public.requisition_lines(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  item_name text,
  qty numeric DEFAULT 0,
  unit text,
  unit_price numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  lead_time_days integer,
  payment_terms text,
  validity_date date,
  notes text,
  shortlisted boolean NOT NULL DEFAULT false,
  selected boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX idx_supplier_quotes_req ON public.supplier_quotes(requisition_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_quotes TO authenticated;
GRANT ALL ON public.supplier_quotes TO service_role;
ALTER TABLE public.supplier_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_quotes_select_staff" ON public.supplier_quotes FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "supplier_quotes_insert" ON public.supplier_quotes FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_requisitions(auth.uid()));
CREATE POLICY "supplier_quotes_update" ON public.supplier_quotes FOR UPDATE TO authenticated
  USING (public.can_manage_requisitions(auth.uid()))
  WITH CHECK (public.can_manage_requisitions(auth.uid()));
CREATE POLICY "supplier_quotes_delete" ON public.supplier_quotes FOR DELETE TO authenticated
  USING (public.can_manage_procurement(auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_supplier_quotes_updated BEFORE UPDATE ON public.supplier_quotes
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ ESCALATION ============
CREATE OR REPLACE FUNCTION public.escalate_overdue_approvals()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT * FROM public.approval_steps
    WHERE status = 'Pending' AND deleted_at IS NULL
      AND due_at IS NOT NULL AND due_at < now() AND escalated_at IS NULL
  LOOP
    UPDATE public.approval_steps
      SET status = 'Escalated', escalated_at = now(), escalated_to = 'admin'
      WHERE id = r.id;
    PERFORM public.notify_roles(ARRAY['admin','project_manager']::app_role[],
      'Approval overdue — escalated',
      r.stage || ' approval on ' || r.entity_type || ' is overdue and has been escalated',
      'approval', NULL);
    IF r.approver_id IS NOT NULL THEN
      PERFORM public.notify_user(r.approver_id, 'Approval overdue',
        'Your pending approval for ' || r.stage || ' passed its due date', 'approval', NULL);
    END IF;
  END LOOP;
END; $$;
REVOKE EXECUTE ON FUNCTION public.escalate_overdue_approvals() FROM PUBLIC, anon;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('escalate-overdue-approvals', '0 * * * *', $$SELECT public.escalate_overdue_approvals();$$);
