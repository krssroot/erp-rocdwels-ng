CREATE OR REPLACE FUNCTION public.tg_notify_payment_schedule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT number, created_by INTO r FROM public.requisitions WHERE id = NEW.requisition_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_roles(ARRAY['accountant','admin']::app_role[], 'Payment awaiting confirmation',
      COALESCE(r.number,'Requisition') || ' has a scheduled payment of ₦' || NEW.amount::text || ' to confirm', 'payment', '/requisitions');
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'Confirmed' AND r.created_by IS NOT NULL THEN
    PERFORM public.notify_user(r.created_by, 'Requisition paid', COALESCE(r.number,'Requisition') || ' has been paid', 'status', '/requisitions');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_notify_payment_schedule() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_ps_notify ON public.payment_schedules;
CREATE TRIGGER trg_ps_notify AFTER INSERT OR UPDATE ON public.payment_schedules
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_payment_schedule();