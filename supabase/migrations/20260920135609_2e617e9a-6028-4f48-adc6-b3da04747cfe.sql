DROP POLICY IF EXISTS "claim evidence own read" ON storage.objects;
CREATE POLICY "claim evidence own read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'claim-evidence'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'moderator'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

DROP POLICY IF EXISTS "claim evidence own insert" ON storage.objects;
CREATE POLICY "claim evidence own insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'claim-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "claim evidence own delete" ON storage.objects;
CREATE POLICY "claim evidence own delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'claim-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );