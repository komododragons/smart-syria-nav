-- 1. PostGIS system reference table: remove Data API exposure (RLS cannot be enabled; table is owned by supabase_admin)
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon;
REVOKE ALL ON TABLE public.spatial_ref_sys FROM authenticated;
REVOKE ALL ON TABLE public.spatial_ref_sys FROM PUBLIC;

-- 2. SECURITY DEFINER PostGIS helpers must not be callable by anonymous users
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text, boolean) FROM PUBLIC, anon;

-- 3. duplicate_candidates: keep moderator/admin role check AND validate the data itself
DROP POLICY IF EXISTS "duplicates insert" ON public.duplicate_candidates;
CREATE POLICY "duplicates insert"
ON public.duplicate_candidates
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND node_a <> node_b
  AND status IN ('pending', 'confirmed', 'rejected')
  AND (distance_meters IS NULL OR (distance_meters >= 0 AND distance_meters <= 100000))
  AND EXISTS (SELECT 1 FROM public.location_nodes n WHERE n.id = node_a)
  AND EXISTS (SELECT 1 FROM public.location_nodes n WHERE n.id = node_b)
);