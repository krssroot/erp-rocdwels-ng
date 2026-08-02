
CREATE OR REPLACE FUNCTION public.notify_roles(_roles app_role[], _title text, _body text, _kind text, _link text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, kind, link)
  SELECT DISTINCT ur.user_id, _title, _body, _kind, _link
  FROM public.user_roles ur
  WHERE ur.role = ANY(_roles);
END; $$;

CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _title text, _body text, _kind text, _link text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, title, body, kind, link)
  VALUES (_user_id, _title, _body, _kind, _link);
END; $$;

REVOKE EXECUTE ON FUNCTION public.notify_roles(app_role[], text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_notify_requisition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'Pending Approval' THEN
      PERFORM public.notify_roles(ARRAY['admin','project_manager','procurement_officer']::app_role[],
        'Requisition awaiting approval', COALESCE(NEW.number,'Requisition') || ' needs your approval', 'approval', '/requisitions');
    ELSIF NEW.status IN ('Approved','Rejected') THEN
      PERFORM public.notify_user(NEW.created_by, 'Requisition ' || NEW.status,
        COALESCE(NEW.number,'Requisition') || ' was ' || lower(NEW.status), 'status', '/requisitions');
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_notify_variation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'Pending Approval' THEN
      PERFORM public.notify_roles(ARRAY['admin','project_manager']::app_role[],
        'Variation order awaiting approval', COALESCE(NEW.description,'Variation order') || ' needs approval', 'approval', '/variations');
    ELSIF NEW.status IN ('Approved','Rejected') THEN
      PERFORM public.notify_user(NEW.created_by, 'Variation order ' || NEW.status,
        COALESCE(NEW.description,'Variation order') || ' was ' || lower(NEW.status), 'status', '/variations');
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_notify_cost_sheet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.created_by, 'Cost sheet ' || NEW.status,
      COALESCE(NEW.number,'Cost sheet') || ' moved to ' || NEW.status, 'status', '/cost-sheets/' || NEW.id::text);
    IF NEW.status IN ('Confirmed','Budget Validated') THEN
      PERFORM public.notify_roles(ARRAY['admin','accountant','project_manager']::app_role[],
        'Cost sheet ' || NEW.status, COALESCE(NEW.number,'Cost sheet') || ' is awaiting the next stage', 'approval', '/cost-sheets/' || NEW.id::text);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_notify_po()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_roles(ARRAY['admin','procurement_officer']::app_role[],
    'Purchase order created', COALESCE(NEW.number,'PO') || ' has been issued', 'procurement', '/purchase-orders');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS notify_requisition ON public.requisitions;
CREATE TRIGGER notify_requisition AFTER UPDATE ON public.requisitions
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_requisition();

DROP TRIGGER IF EXISTS notify_variation ON public.variation_orders;
CREATE TRIGGER notify_variation AFTER UPDATE ON public.variation_orders
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_variation();

DROP TRIGGER IF EXISTS notify_cost_sheet ON public.cost_sheets;
CREATE TRIGGER notify_cost_sheet AFTER UPDATE ON public.cost_sheets
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_cost_sheet();

DROP TRIGGER IF EXISTS notify_po ON public.purchase_orders;
CREATE TRIGGER notify_po AFTER INSERT ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_po();

-- Re-attach the business rule triggers that back the automations (idempotent)
DROP TRIGGER IF EXISTS trg_apply_vo ON public.variation_orders;
CREATE TRIGGER trg_apply_vo BEFORE UPDATE ON public.variation_orders
FOR EACH ROW EXECUTE FUNCTION public.apply_vo_to_project();

DROP TRIGGER IF EXISTS trg_guard_vo ON public.variation_orders;
CREATE TRIGGER trg_guard_vo BEFORE UPDATE ON public.variation_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_vo_approval();

DROP TRIGGER IF EXISTS trg_guard_req ON public.requisitions;
CREATE TRIGGER trg_guard_req BEFORE UPDATE ON public.requisitions
FOR EACH ROW EXECUTE FUNCTION public.guard_requisition_approval();

DROP TRIGGER IF EXISTS trg_auto_po ON public.requisitions;
CREATE TRIGGER trg_auto_po AFTER UPDATE ON public.requisitions
FOR EACH ROW EXECUTE FUNCTION public.auto_create_po();
