CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text,
  logo_url text,
  website text,
  contact_phone text,
  contact_email text,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','manager','staff','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.org_role(_org uuid, _user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.organization_members
  WHERE organization_id = _org AND user_id = _user
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.org_role(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.org_role(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.org_role(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "org members read organization" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.org_role(id, auth.uid()) IS NOT NULL);
CREATE POLICY "users create own organization" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "org admins update organization" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.org_role(id, auth.uid()) IN ('owner','admin'))
  WITH CHECK (public.org_role(id, auth.uid()) IN ('owner','admin'));

CREATE POLICY "org members read team" ON public.organization_members
  FOR SELECT TO authenticated
  USING (public.org_role(organization_id, auth.uid()) IS NOT NULL);
CREATE POLICY "org admins manage team" ON public.organization_members
  FOR ALL TO authenticated
  USING (public.org_role(organization_id, auth.uid()) IN ('owner','admin'))
  WITH CHECK (public.org_role(organization_id, auth.uid()) IN ('owner','admin'));

CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_organization_created
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_organization_members_updated_at
BEFORE UPDATE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.businesses
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN branch_label text;
CREATE INDEX idx_businesses_organization ON public.businesses (organization_id) WHERE organization_id IS NOT NULL;

CREATE POLICY "org staff manage businesses" ON public.businesses
  FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND public.org_role(organization_id, auth.uid()) IN ('owner','admin','manager'))
  WITH CHECK (organization_id IS NOT NULL AND public.org_role(organization_id, auth.uid()) IN ('owner','admin','manager'));

CREATE TABLE public.address_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_code text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('resolve','navigate_start','delivery_view','qr_scan','plate_print')),
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.address_events TO service_role;
ALTER TABLE public.address_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_address_events_code_time ON public.address_events (smart_code, created_at DESC);