REVOKE ALL ON TABLE public.spatial_ref_sys FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "redirects readable" ON public.smart_address_redirects;
REVOKE SELECT ON TABLE public.smart_address_redirects FROM anon;

CREATE POLICY "redirects readable by staff"
ON public.smart_address_redirects
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.resolve_smart_address_redirect(p_old_code text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.new_code
  FROM public.smart_address_redirects AS r
  WHERE r.old_code = upper(btrim(p_old_code))
    AND p_old_code ~* '^SY-[A-Z0-9]{2,8}-[A-Z0-9]{3,12}$'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_smart_address_redirect(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_smart_address_redirect(text) TO anon, authenticated, service_role;