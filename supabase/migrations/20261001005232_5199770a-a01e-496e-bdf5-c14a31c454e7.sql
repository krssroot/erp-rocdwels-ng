DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, number, status FROM public.cost_sheets WHERE deleted_at IS NULL AND status IN ('Submitted for Vetting','Vetted') LOOP
    IF r.status = 'Submitted for Vetting' THEN
      PERFORM public.notify_roles(ARRAY['head_quantity_surveyor','admin']::app_role[], 'Budget awaiting vetting', COALESCE(r.number,'Budget') || ' needs your vetting', 'approval', '/cost-sheets/' || r.id::text);
    ELSE
      PERFORM public.notify_roles(ARRAY['admin']::app_role[], 'Budget awaiting MD approval', COALESCE(r.number,'Budget') || ' has been vetted and needs final approval', 'approval', '/cost-sheets/' || r.id::text);
    END IF;
  END LOOP;
  FOR r IN SELECT id, number, status FROM public.requisitions WHERE deleted_at IS NULL AND status IN ('Pending Vetting','Pending PO','MD Approval','Payment Schedule','Payment Confirmed') LOOP
    IF r.status = 'Pending Vetting' THEN
      PERFORM public.notify_roles(ARRAY['head_quantity_surveyor','admin']::app_role[], 'Labour requisition awaiting vetting', COALESCE(r.number,'Requisition') || ' needs your vetting', 'approval', '/requisitions');
    ELSIF r.status = 'Pending PO' THEN
      PERFORM public.notify_roles(ARRAY['procurement_officer','admin']::app_role[], 'Materials requisition awaiting purchase order', COALESCE(r.number,'Requisition') || ' needs a purchase order', 'procurement', '/requisitions');
    ELSIF r.status = 'MD Approval' THEN
      PERFORM public.notify_roles(ARRAY['admin']::app_role[], 'Requisition awaiting MD approval', COALESCE(r.number,'Requisition') || ' needs final approval', 'approval', '/requisitions');
    ELSIF r.status = 'Payment Schedule' THEN
      PERFORM public.notify_roles(ARRAY['accountant','admin']::app_role[], 'Payment schedule required', COALESCE(r.number,'Requisition') || ' was approved and needs a payment schedule', 'payment', '/requisitions');
    ELSE
      PERFORM public.notify_roles(ARRAY['accountant','admin']::app_role[], 'Payment awaiting confirmation', COALESCE(r.number,'Requisition') || ' has a scheduled payment awaiting confirmation', 'payment', '/requisitions');
    END IF;
  END LOOP;
END $$;