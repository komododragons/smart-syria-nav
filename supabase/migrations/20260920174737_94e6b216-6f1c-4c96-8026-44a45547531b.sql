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

CREATE TABLE public.account_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('user','organization')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','business','developer','enterprise')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','trialing','past_due','canceled')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','grant','self_serve','partner')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  notes text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_plans_subject_shape CHECK (
    (subject_type = 'user' AND user_id IS NOT NULL AND organization_id IS NULL)
    OR (subject_type = 'organization' AND organization_id IS NOT NULL AND user_id IS NULL)
  )
);

CREATE UNIQUE INDEX account_plans_user_uidx ON public.account_plans (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX account_plans_org_uidx ON public.account_plans (organization_id) WHERE organization_id IS NOT NULL;

GRANT SELECT ON public.account_plans TO authenticated;
GRANT ALL ON public.account_plans TO service_role;

ALTER TABLE public.account_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own plan" ON public.account_plans
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Organization members read their organization plan" ON public.account_plans
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = account_plans.organization_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins read all plans" ON public.account_plans
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage plans" ON public.account_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER account_plans_set_updated_at
  BEFORE UPDATE ON public.account_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform settings" ON public.platform_settings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins manage platform settings" ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER platform_settings_set_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_settings (key, value)
VALUES ('entitlements', '{"enforced": false, "pricing_published": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;