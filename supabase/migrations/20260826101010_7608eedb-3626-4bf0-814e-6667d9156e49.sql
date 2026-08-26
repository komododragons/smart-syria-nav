
-- 1) SECURITY DEFINER trigger functions must not be user-callable
revoke execute on function public.apply_correction_confidence() from public, anon, authenticated;
revoke execute on function public.apply_feedback_confidence() from public, anon, authenticated;
-- has_role and record_verification stay callable by signed-in users by design:
-- has_role backs RLS policies (returns only a boolean), record_verification enforces
-- verifier/moderator/admin roles inside the function. Still lock them away from anon.
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.record_verification(uuid, uuid, text, text) from public, anon;

-- 2) Align api_clients WITH CHECK with USING so admins can manage rows
 drop policy if exists "api clients own" on public.api_clients;
create policy "api clients own"
on public.api_clients
for all
to authenticated
using (owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- 3) Restrict duplicate_candidates inserts to moderators/admins (detection runs from admin tooling)
drop policy if exists "duplicates insert" on public.duplicate_candidates;
create policy "duplicates insert"
on public.duplicate_candidates
for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'moderator') or public.has_role(auth.uid(), 'admin')
);
