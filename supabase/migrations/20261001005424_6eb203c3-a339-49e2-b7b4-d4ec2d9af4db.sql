CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, app_role) SET SCHEMA private;
ALTER FUNCTION public.can_manage_catalog(uuid) SET SCHEMA private;
ALTER FUNCTION public.can_manage_site(uuid) SET SCHEMA private;
ALTER FUNCTION public.can_manage_procurement(uuid) SET SCHEMA private;
ALTER FUNCTION public.can_manage_costing(uuid) SET SCHEMA private;
ALTER FUNCTION public.can_manage_requisitions(uuid) SET SCHEMA private;
ALTER FUNCTION public.is_staff(uuid) SET SCHEMA private;
ALTER FUNCTION public.is_privileged(uuid) SET SCHEMA private;
ALTER FUNCTION public.is_project_member(uuid, uuid) SET SCHEMA private;

DO $$
DECLARE f record; def text;
BEGIN
  FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname IN ('public','private') AND p.prokind='f'
             AND p.prosrc ~ '(has_role|can_manage_\w+|is_staff|is_privileged|is_project_member)\s*\(' LOOP
    def := pg_get_functiondef(f.oid);
    def := regexp_replace(def, '(public\.)?(has_role|can_manage_catalog|can_manage_site|can_manage_procurement|can_manage_costing|can_manage_requisitions|is_staff|is_privileged|is_project_member)\s*\(', 'private.\2(', 'g');
    -- restore the function's own name in its header
    def := regexp_replace(def, 'FUNCTION private\.private\.', 'FUNCTION private.', 'g');
    EXECUTE def;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.escalate_overdue_approvals() FROM authenticated;