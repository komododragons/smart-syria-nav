DROP FUNCTION IF EXISTS public.resolve_smart_address_redirect(text);

DROP POLICY IF EXISTS "redirects readable by staff" ON public.smart_address_redirects;

CREATE POLICY "public redirects for active public addresses"
ON public.smart_address_redirects
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.smart_addresses AS target
    WHERE target.code = smart_address_redirects.new_code
      AND target.is_public = true
      AND target.status = 'active'
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

GRANT SELECT ON TABLE public.smart_address_redirects TO anon, authenticated;