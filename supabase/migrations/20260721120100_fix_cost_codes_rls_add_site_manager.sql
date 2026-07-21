-- Fix RLS policies: allow site_manager to insert cost_codes (budget creation)

-- Cost Codes: accountant, admin, and site_manager can create budgets
DROP POLICY IF EXISTS "cost_codes_insert" ON public.cost_codes;
CREATE POLICY "cost_codes_insert" ON public.cost_codes
FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'accountant'::app_role) OR
  public.has_role(auth.uid(), 'site_manager'::app_role)
);
