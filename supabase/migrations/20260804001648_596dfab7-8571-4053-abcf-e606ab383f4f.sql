
CREATE POLICY "attach_read_staff" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND public.is_staff(auth.uid()));
CREATE POLICY "attach_insert_staff" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND public.is_staff(auth.uid()) AND owner = auth.uid());
CREATE POLICY "attach_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'attachments' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'attachments' AND owner = auth.uid());
CREATE POLICY "attach_delete_own_or_admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));
