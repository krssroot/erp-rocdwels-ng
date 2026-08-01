REVOKE EXECUTE ON FUNCTION
  public.can_manage_costing(uuid),
  public.can_manage_procurement(uuid),
  public.can_manage_requisitions(uuid),
  public.can_manage_site(uuid),
  public.can_manage_catalog(uuid)
FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION
  public.can_manage_costing(uuid),
  public.can_manage_procurement(uuid),
  public.can_manage_requisitions(uuid),
  public.can_manage_site(uuid),
  public.can_manage_catalog(uuid)
FROM anon;

GRANT EXECUTE ON FUNCTION
  public.can_manage_costing(uuid),
  public.can_manage_procurement(uuid),
  public.can_manage_requisitions(uuid),
  public.can_manage_site(uuid),
  public.can_manage_catalog(uuid)
TO authenticated;