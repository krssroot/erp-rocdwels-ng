DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

INSERT INTO public.notifications (user_id, title, body, kind, link, read, created_at)
SELECT ur.user_id,
  initcap(coalesce(ah.entity_type,'record')) || ': ' || coalesce(ah.from_status,'—') || ' → ' || coalesce(ah.to_status, ah.action),
  coalesce(ah.by_email,'Someone') || coalesce(' — ' || nullif(ah.notes,''), ''),
  'workflow',
  CASE WHEN ah.budget_id IS NOT NULL THEN '/cost-sheets/' || ah.budget_id ELSE '/requisitions' END,
  false, ah.created_at
FROM public.approval_history ah
JOIN public.user_roles ur ON ur.role IN ('admin','accountant','procurement_officer','site_manager','project_manager')
WHERE ur.user_id IS DISTINCT FROM ah.by_user_id;