CREATE TABLE public.privacy_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  allow_share_phone boolean NOT NULL DEFAULT false,
  allow_share_unit boolean NOT NULL DEFAULT false,
  allow_share_floor boolean NOT NULL DEFAULT true,
  allow_share_name boolean NOT NULL DEFAULT false,
  allow_share_instructions boolean NOT NULL DEFAULT true,
  allow_share_parking boolean NOT NULL DEFAULT true,
  default_share_hours integer NOT NULL DEFAULT 24,
  max_share_hours integer NOT NULL DEFAULT 168,
  require_expiry boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.privacy_preferences TO authenticated;
GRANT ALL ON public.privacy_preferences TO service_role;

ALTER TABLE public.privacy_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own privacy prefs read" ON public.privacy_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own privacy prefs insert" ON public.privacy_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own privacy prefs update" ON public.privacy_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.validate_privacy_preferences()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.default_share_hours < 1 OR NEW.default_share_hours > 8760 THEN
    RAISE EXCEPTION 'default_share_hours out of range';
  END IF;
  IF NEW.max_share_hours < 1 OR NEW.max_share_hours > 8760 THEN
    RAISE EXCEPTION 'max_share_hours out of range';
  END IF;
  IF NEW.default_share_hours > NEW.max_share_hours THEN
    NEW.default_share_hours := NEW.max_share_hours;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER privacy_preferences_validate
  BEFORE INSERT OR UPDATE ON public.privacy_preferences
  FOR EACH ROW EXECUTE FUNCTION public.validate_privacy_preferences();

DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "anyone can read platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "platform settings readable" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_select" ON public.platform_settings;

CREATE POLICY "platform settings admin read" ON public.platform_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

REVOKE SELECT ON public.platform_settings FROM anon;