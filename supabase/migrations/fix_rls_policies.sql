@@
-CREATE POLICY "cost_codes_insert" ON public.cost_codes
-FOR INSERT WITH CHECK (
-  public.has_role(auth.uid(), 'admin'::app_role) OR
-  public.has_role(auth.uid(), 'accountant'::app_role)
-);
+CREATE POLICY "cost_codes_insert" ON public.cost_codes
+FOR INSERT WITH CHECK (
+  public.has_role(auth.uid(), 'admin'::app_role) OR
+  public.has_role(auth.uid(), 'accountant'::app_role) OR
+  public.has_role(auth.uid(), 'site_manager'::app_role)
+);
