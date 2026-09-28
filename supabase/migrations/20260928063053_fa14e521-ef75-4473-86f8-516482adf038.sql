DROP POLICY IF EXISTS "public redirects for active public addresses" ON public.smart_address_redirects;
CREATE POLICY "public redirects for active public addresses" ON public.smart_address_redirects
FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.smart_addresses target WHERE target.code = smart_address_redirects.new_code AND target.is_public = true AND target.status = 'active'));
CREATE POLICY "staff read all redirects" ON public.smart_address_redirects
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));