-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile write" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

-- ============ roles ============
CREATE TYPE public.app_role AS ENUM ('user','business_owner','organization_manager','courier','verifier','moderator','admin');
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ location nodes ============
CREATE TABLE public.location_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.location_nodes(id) ON DELETE SET NULL,
  node_type TEXT NOT NULL,
  name_ar TEXT,
  name_en TEXT,
  display_name TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  country_code TEXT NOT NULL DEFAULT 'SY',
  governorate TEXT,
  city TEXT,
  district TEXT,
  neighborhood TEXT,
  street TEXT,
  landmark TEXT,
  description TEXT,
  floor_label TEXT,
  floor_order INTEGER,
  unit_label TEXT,
  floors_count INTEGER,
  has_elevator BOOLEAN,
  visibility TEXT NOT NULL DEFAULT 'private',
  verification_level TEXT NOT NULL DEFAULT 'unverified',
  confidence_score INTEGER NOT NULL DEFAULT 40,
  lifecycle_status TEXT NOT NULL DEFAULT 'active',
  public_notes TEXT,
  private_notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX location_nodes_parent_idx ON public.location_nodes(parent_id);
CREATE INDEX location_nodes_type_idx ON public.location_nodes(node_type);
CREATE INDEX location_nodes_geo_idx ON public.location_nodes(latitude, longitude);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_nodes TO authenticated;
GRANT SELECT ON public.location_nodes TO anon;
GRANT ALL ON public.location_nodes TO service_role;
ALTER TABLE public.location_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public nodes readable" ON public.location_nodes FOR SELECT TO anon, authenticated
  USING (visibility = 'public' AND is_active);
CREATE POLICY "own nodes readable" ON public.location_nodes FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "moderators read all nodes" ON public.location_nodes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'moderator') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "create nodes" ON public.location_nodes FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "update own nodes" ON public.location_nodes FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "delete own nodes" ON public.location_nodes FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER location_nodes_updated BEFORE UPDATE ON public.location_nodes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.location_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES public.location_nodes(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.location_aliases TO authenticated;
GRANT SELECT ON public.location_aliases TO anon;
GRANT ALL ON public.location_aliases TO service_role;
ALTER TABLE public.location_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aliases readable" ON public.location_aliases FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.location_nodes n WHERE n.id = node_id AND n.visibility='public' AND n.is_active));
CREATE POLICY "aliases manage own" ON public.location_aliases FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.location_nodes n WHERE n.id = node_id AND n.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.location_nodes n WHERE n.id = node_id AND n.created_by = auth.uid()));

-- ============ access points ============
CREATE TABLE public.access_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES public.location_nodes(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL DEFAULT 'entrance',
  name_ar TEXT,
  name_en TEXT,
  display_name TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  instructions_ar TEXT,
  instructions_en TEXT,
  accessibility TEXT[] NOT NULL DEFAULT '{}',
  always_open BOOLEAN NOT NULL DEFAULT false,
  opens_at TIME,
  closes_at TIME,
  temporarily_closed BOOLEAN NOT NULL DEFAULT false,
  verification_level TEXT NOT NULL DEFAULT 'unverified',
  confidence_score INTEGER NOT NULL DEFAULT 40,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX access_points_node_idx ON public.access_points(node_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_points TO authenticated;
GRANT SELECT ON public.access_points TO anon;
GRANT ALL ON public.access_points TO service_role;
ALTER TABLE public.access_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "access points readable" ON public.access_points FOR SELECT TO anon, authenticated
  USING (is_active AND EXISTS (SELECT 1 FROM public.location_nodes n WHERE n.id = node_id AND n.visibility='public' AND n.is_active));
CREATE POLICY "access points own" ON public.access_points FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "access points insert" ON public.access_points FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "access points update" ON public.access_points FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "access points delete" ON public.access_points FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER access_points_updated BEFORE UPDATE ON public.access_points FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.access_point_purposes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_point_id UUID NOT NULL REFERENCES public.access_points(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  UNIQUE (access_point_id, purpose)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_point_purposes TO authenticated;
GRANT SELECT ON public.access_point_purposes TO anon;
GRANT ALL ON public.access_point_purposes TO service_role;
ALTER TABLE public.access_point_purposes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purposes readable" ON public.access_point_purposes FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.access_points a JOIN public.location_nodes n ON n.id=a.node_id
                 WHERE a.id = access_point_id AND n.visibility='public' AND n.is_active));
CREATE POLICY "purposes manage own" ON public.access_point_purposes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.access_points a WHERE a.id = access_point_id AND a.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.access_points a WHERE a.id = access_point_id AND a.created_by = auth.uid()));

CREATE TABLE public.access_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_point_id UUID NOT NULL REFERENCES public.access_points(id) ON DELETE CASCADE,
  restriction TEXT NOT NULL,
  note_ar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_restrictions TO authenticated;
GRANT SELECT ON public.access_restrictions TO anon;
GRANT ALL ON public.access_restrictions TO service_role;
ALTER TABLE public.access_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restrictions readable" ON public.access_restrictions FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.access_points a JOIN public.location_nodes n ON n.id=a.node_id
                 WHERE a.id = access_point_id AND n.visibility='public' AND n.is_active));
CREATE POLICY "restrictions manage own" ON public.access_restrictions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.access_points a WHERE a.id = access_point_id AND a.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.access_points a WHERE a.id = access_point_id AND a.created_by = auth.uid()));

-- ============ smart addresses ============
CREATE TABLE public.smart_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  node_id UUID NOT NULL REFERENCES public.location_nodes(id) ON DELETE CASCADE,
  default_access_point_id UUID REFERENCES public.access_points(id) ON DELETE SET NULL,
  label TEXT,
  purpose_hint TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX smart_addresses_code_lower_idx ON public.smart_addresses(lower(code));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smart_addresses TO authenticated;
GRANT SELECT ON public.smart_addresses TO anon;
GRANT ALL ON public.smart_addresses TO service_role;
ALTER TABLE public.smart_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public codes readable" ON public.smart_addresses FOR SELECT TO anon, authenticated USING (is_public);
CREATE POLICY "own codes readable" ON public.smart_addresses FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "codes insert" ON public.smart_addresses FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "codes update" ON public.smart_addresses FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "codes delete" ON public.smart_addresses FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER smart_addresses_updated BEFORE UPDATE ON public.smart_addresses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.smart_address_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  old_code TEXT NOT NULL UNIQUE,
  new_code TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.smart_address_redirects TO anon, authenticated;
GRANT ALL ON public.smart_address_redirects TO service_role;
ALTER TABLE public.smart_address_redirects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "redirects readable" ON public.smart_address_redirects FOR SELECT TO anon, authenticated USING (true);

-- ============ businesses ============
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  category TEXT,
  phone TEXT,
  website TEXT,
  logo_url TEXT,
  opening_hours TEXT,
  node_id UUID REFERENCES public.location_nodes(id) ON DELETE SET NULL,
  smart_address_id UUID REFERENCES public.smart_addresses(id) ON DELETE SET NULL,
  visitor_access_point_id UUID REFERENCES public.access_points(id) ON DELETE SET NULL,
  delivery_access_point_id UUID REFERENCES public.access_points(id) ON DELETE SET NULL,
  verification_level TEXT NOT NULL DEFAULT 'unverified',
  is_published BOOLEAN NOT NULL DEFAULT true,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT SELECT ON public.businesses TO anon;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published businesses readable" ON public.businesses FOR SELECT TO anon, authenticated USING (is_published);
CREATE POLICY "own businesses readable" ON public.businesses FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "businesses insert" ON public.businesses FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "businesses update" ON public.businesses FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "businesses delete" ON public.businesses FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER businesses_updated BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.business_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  claimant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evidence TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.business_claims TO authenticated;
GRANT ALL ON public.business_claims TO service_role;
ALTER TABLE public.business_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claims own read" ON public.business_claims FOR SELECT TO authenticated
  USING (claimant_id = auth.uid() OR public.has_role(auth.uid(),'moderator') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "claims insert" ON public.business_claims FOR INSERT TO authenticated WITH CHECK (claimant_id = auth.uid());
CREATE POLICY "claims review" ON public.business_claims FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'moderator') OR public.has_role(auth.uid(),'admin'));

-- ============ temporary addresses ============
CREATE TABLE public.temporary_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  smart_address_id UUID NOT NULL REFERENCES public.smart_addresses(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL DEFAULT 'parcel_delivery',
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.temporary_addresses TO authenticated;
GRANT ALL ON public.temporary_addresses TO service_role;
ALTER TABLE public.temporary_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "temp own read" ON public.temporary_addresses FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "temp insert" ON public.temporary_addresses FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "temp update" ON public.temporary_addresses FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- ============ verification / confidence / feedback ============
CREATE TABLE public.verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES public.location_nodes(id) ON DELETE CASCADE,
  access_point_id UUID REFERENCES public.access_points(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  method TEXT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.verifications TO authenticated;
GRANT ALL ON public.verifications TO service_role;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verifications read" ON public.verifications FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR public.has_role(auth.uid(),'verifier') OR public.has_role(auth.uid(),'moderator') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "verifications insert" ON public.verifications FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE TABLE public.confidence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES public.location_nodes(id) ON DELETE CASCADE,
  access_point_id UUID REFERENCES public.access_points(id) ON DELETE CASCADE,
  factor TEXT NOT NULL,
  delta INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.confidence_events TO authenticated;
GRANT ALL ON public.confidence_events TO service_role;
ALTER TABLE public.confidence_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "confidence admin read" ON public.confidence_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE TABLE public.visit_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_code TEXT NOT NULL,
  purpose TEXT NOT NULL,
  access_point_id UUID REFERENCES public.access_points(id) ON DELETE SET NULL,
  successful BOOLEAN NOT NULL,
  notes TEXT,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.visit_feedback TO authenticated;
GRANT ALL ON public.visit_feedback TO service_role;
ALTER TABLE public.visit_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback insert" ON public.visit_feedback FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "feedback read" ON public.visit_feedback FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(),'moderator') OR public.has_role(auth.uid(),'admin'));

-- ============ corrections / duplicates ============
CREATE TABLE public.correction_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES public.location_nodes(id) ON DELETE CASCADE,
  access_point_id UUID REFERENCES public.access_points(id) ON DELETE CASCADE,
  smart_code TEXT,
  issue_type TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.correction_reports TO authenticated;
GRANT ALL ON public.correction_reports TO service_role;
ALTER TABLE public.correction_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "corrections insert" ON public.correction_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "corrections read" ON public.correction_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(),'moderator') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "corrections review" ON public.correction_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'moderator') OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.duplicate_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_a UUID NOT NULL REFERENCES public.location_nodes(id) ON DELETE CASCADE,
  node_b UUID NOT NULL REFERENCES public.location_nodes(id) ON DELETE CASCADE,
  distance_meters DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.duplicate_candidates TO authenticated;
GRANT ALL ON public.duplicate_candidates TO service_role;
ALTER TABLE public.duplicate_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "duplicates moderate" ON public.duplicate_candidates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'moderator') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "duplicates insert" ON public.duplicate_candidates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "duplicates update" ON public.duplicate_candidates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'moderator') OR public.has_role(auth.uid(),'admin'));

-- ============ favorites ============
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  smart_address_id UUID REFERENCES public.smart_addresses(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites own" ON public.favorites FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ audit + api ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.api_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  scopes TEXT[] NOT NULL DEFAULT '{resolve}',
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.api_clients TO authenticated;
GRANT ALL ON public.api_clients TO service_role;
ALTER TABLE public.api_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api clients own" ON public.api_clients FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.api_clients(id) ON DELETE CASCADE,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api keys own" ON public.api_keys FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.api_clients c WHERE c.id = client_id AND c.owner_id = auth.uid()));

CREATE TABLE public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.api_clients(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  status_code INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_usage TO authenticated;
GRANT ALL ON public.api_usage TO service_role;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api usage admin" ON public.api_usage FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============ demo data (public infrastructure) ============
-- Residential tower, Damascus / Mazzeh
INSERT INTO public.location_nodes (id, node_type, name_ar, name_en, display_name, latitude, longitude, governorate, city, district, neighborhood, street, landmark, visibility, verification_level, confidence_score, floors_count, has_elevator, public_notes)
VALUES
 ('11111111-1111-4111-8111-111111111101','building','برج الفيحاء السكني','Al-Fayhaa Residential Tower','برج الفيحاء السكني',33.51380,36.27650,'دمشق','دمشق','المزة','المزة','أوتوستراد المزة','مقابل صيدلية الشام','public','community_confirmed',94,9,true,'مبنى سكني من 9 طوابق، مدخلان'),
 ('11111111-1111-4111-8111-111111111102','building','مبنى المزة الطبي','Mazzeh Medical Block','مبنى المزة الطبي',33.51500,36.27200,'دمشق','دمشق','المزة','المزة','شارع الجلاء','بجانب حديقة المزة','public','business_verified',88,6,true,'مبنى عيادات'),
 ('11111111-1111-4111-8111-111111111103','property','المنطقة الصناعية — عدرا','Adra Industrial Zone Property','مستودع الشام اللوجستي',33.61000,36.50000,'ريف دمشق','عدرا','المنطقة الصناعية','عدرا الصناعية','طريق عدرا','مقابل بوابة المنطقة الصناعية 3','public','user_confirmed',71,NULL,NULL,'عقار صناعي يحتوي مستودعين');

INSERT INTO public.location_nodes (id, parent_id, node_type, name_ar, name_en, display_name, latitude, longitude, governorate, city, district, neighborhood, visibility, verification_level, confidence_score, floor_label, floor_order)
VALUES
 ('11111111-1111-4111-8111-111111111201','11111111-1111-4111-8111-111111111102','floor','الطابق الثالث','Floor 3','الطابق الثالث',33.51500,36.27200,'دمشق','دمشق','المزة','المزة','public','business_verified',88,'3',3);

INSERT INTO public.location_nodes (id, parent_id, node_type, name_ar, name_en, display_name, latitude, longitude, governorate, city, district, neighborhood, visibility, verification_level, confidence_score, unit_label)
VALUES
 ('11111111-1111-4111-8111-111111111301','11111111-1111-4111-8111-111111111201','clinic','مكتب 305','Office 305','مكتب 305',33.51500,36.27200,'دمشق','دمشق','المزة','المزة','public','business_verified',88,'305');

INSERT INTO public.location_nodes (id, parent_id, node_type, name_ar, name_en, display_name, latitude, longitude, governorate, city, visibility, verification_level, confidence_score)
VALUES
 ('11111111-1111-4111-8111-111111111401','11111111-1111-4111-8111-111111111103','warehouse','مستودع A','Warehouse A','مستودع A',33.61020,36.50040,'ريف دمشق','عدرا','public','user_confirmed',70);

INSERT INTO public.location_aliases (node_id, alias, lang) VALUES
 ('11111111-1111-4111-8111-111111111101','برج الفيحاء','ar'),
 ('11111111-1111-4111-8111-111111111101','Al Fayha Tower','en'),
 ('11111111-1111-4111-8111-111111111102','Mazzeh Clinics','en');

-- Access points
INSERT INTO public.access_points (id, node_id, access_type, name_ar, name_en, display_name, latitude, longitude, instructions_ar, accessibility, always_open, opens_at, closes_at, verification_level, confidence_score, sort_order)
VALUES
 ('22222222-2222-4222-8222-222222222201','11111111-1111-4111-8111-111111111101','entrance','المدخل الرئيسي (أ)','Main Entrance (A)','المدخل الرئيسي (أ)',33.51385,36.27641,'المدخل الرئيسي على الأوتوستراد. ممنوع دخول التوصيل من هنا.','{wheelchair_accessible,elevator}',false,'06:00','23:00','community_confirmed',92,1),
 ('22222222-2222-4222-8222-222222222202','11111111-1111-4111-8111-111111111101','delivery_point','مدخل التوصيل (ب)','Delivery Entrance (B)','مدخل التوصيل (ب)',33.51368,36.27672,'استخدم الطريق الخدمي الشرقي، الباب المعدني الرمادي بجانب موقف السيارات.','{ramp}',false,'08:00','16:00','courier_verified',95,2),
 ('22222222-2222-4222-8222-222222222203','11111111-1111-4111-8111-111111111101','emergency_entrance','مدخل الطوارئ','Emergency Entrance','مدخل الطوارئ',33.51392,36.27665,'يُفتح لسيارات الإسعاف والإطفاء فقط.','{}',true,NULL,NULL,'user_confirmed',80,3),
 ('22222222-2222-4222-8222-222222222204','11111111-1111-4111-8111-111111111102','entrance','مدخل المراجعين','Visitor Entrance','مدخل المراجعين',33.51505,36.27195,'مدخل المراجعين على شارع الجلاء، الاستقبال في الطابق الأرضي.','{wheelchair_accessible,elevator,ramp}',false,'08:00','20:00','business_verified',90,1),
 ('22222222-2222-4222-8222-222222222205','11111111-1111-4111-8111-111111111103','gate','بوابة الزوار','Visitor Gate','بوابة الزوار',33.60990,36.49980,'بوابة الزوار والموظفين — ممنوع دخول الشاحنات.','{}',false,'08:00','17:00','user_confirmed',70,1),
 ('22222222-2222-4222-8222-222222222206','11111111-1111-4111-8111-111111111103','gate','بوابة الشاحنات','Truck Gate','بوابة الشاحنات',33.61045,36.50085,'بوابة الشاحنات الشمالية، ارتفاع أقصى 4.2 متر.','{}',false,'07:00','19:00','courier_verified',84,2),
 ('22222222-2222-4222-8222-222222222207','11111111-1111-4111-8111-111111111401','loading_dock','رصيف التحميل 1','Loading Dock 1','رصيف التحميل 1',33.61025,36.50050,'رصيف التحميل الأول داخل المستودع A بعد بوابة الشاحنات.','{}',false,'07:00','19:00','user_confirmed',75,1);

INSERT INTO public.access_point_purposes (access_point_id, purpose, allowed, note) VALUES
 ('22222222-2222-4222-8222-222222222201','visitor',true,NULL),
 ('22222222-2222-4222-8222-222222222201','resident',true,NULL),
 ('22222222-2222-4222-8222-222222222201','parcel_delivery',false,'ممنوع التوصيل من المدخل الرئيسي'),
 ('22222222-2222-4222-8222-222222222201','food_delivery',false,'ممنوع التوصيل من المدخل الرئيسي'),
 ('22222222-2222-4222-8222-222222222201','freight',false,NULL),
 ('22222222-2222-4222-8222-222222222201','wheelchair_access',true,NULL),
 ('22222222-2222-4222-8222-222222222202','parcel_delivery',true,NULL),
 ('22222222-2222-4222-8222-222222222202','food_delivery',true,NULL),
 ('22222222-2222-4222-8222-222222222202','resident',true,NULL),
 ('22222222-2222-4222-8222-222222222202','visitor',false,'مدخل خدمي فقط'),
 ('22222222-2222-4222-8222-222222222202','freight',false,NULL),
 ('22222222-2222-4222-8222-222222222203','emergency',true,NULL),
 ('22222222-2222-4222-8222-222222222203','visitor',false,NULL),
 ('22222222-2222-4222-8222-222222222203','parcel_delivery',false,NULL),
 ('22222222-2222-4222-8222-222222222204','visitor',true,NULL),
 ('22222222-2222-4222-8222-222222222204','customer',true,NULL),
 ('22222222-2222-4222-8222-222222222204','wheelchair_access',true,NULL),
 ('22222222-2222-4222-8222-222222222204','parcel_delivery',true,NULL),
 ('22222222-2222-4222-8222-222222222204','freight',false,NULL),
 ('22222222-2222-4222-8222-222222222205','visitor',true,NULL),
 ('22222222-2222-4222-8222-222222222205','employee',true,NULL),
 ('22222222-2222-4222-8222-222222222205','freight',false,'ممنوع دخول الشاحنات'),
 ('22222222-2222-4222-8222-222222222206','freight',true,NULL),
 ('22222222-2222-4222-8222-222222222206','loading',true,NULL),
 ('22222222-2222-4222-8222-222222222206','parcel_delivery',true,NULL),
 ('22222222-2222-4222-8222-222222222206','visitor',false,NULL),
 ('22222222-2222-4222-8222-222222222207','freight',true,NULL),
 ('22222222-2222-4222-8222-222222222207','loading',true,NULL),
 ('22222222-2222-4222-8222-222222222207','visitor',false,NULL);

INSERT INTO public.access_restrictions (access_point_id, restriction, note_ar) VALUES
 ('22222222-2222-4222-8222-222222222201','no_deliveries','ممنوع التوصيل — استخدم مدخل التوصيل (ب)'),
 ('22222222-2222-4222-8222-222222222201','pedestrian_only','للمشاة فقط'),
 ('22222222-2222-4222-8222-222222222202','closed_after_hours','يُغلق بعد الساعة 16:00'),
 ('22222222-2222-4222-8222-222222222203','emergency_only','لخدمات الطوارئ فقط'),
 ('22222222-2222-4222-8222-222222222205','trucks_prohibited','ممنوع دخول الشاحنات'),
 ('22222222-2222-4222-8222-222222222206','vehicle_only','للمركبات فقط — ارتفاع أقصى 4.2 م');

INSERT INTO public.smart_addresses (id, code, node_id, default_access_point_id, label, is_public, status) VALUES
 ('33333333-3333-4333-8333-333333333301','SY-DAM-K7X4','11111111-1111-4111-8111-111111111101','22222222-2222-4222-8222-222222222201','برج الفيحاء السكني',true,'active'),
 ('33333333-3333-4333-8333-333333333302','SY-DAM-9M4Q','11111111-1111-4111-8111-111111111301','22222222-2222-4222-8222-222222222204','مركز النور الطبي — مكتب 305',true,'active'),
 ('33333333-3333-4333-8333-333333333303','SY-RDA-82KF','11111111-1111-4111-8111-111111111103','22222222-2222-4222-8222-222222222206','مستودع الشام اللوجستي',true,'active'),
 ('33333333-3333-4333-8333-333333333304','SY-RDA-4T7B','11111111-1111-4111-8111-111111111401','22222222-2222-4222-8222-222222222207','مستودع A — رصيف التحميل 1',true,'active');

INSERT INTO public.businesses (name_ar, name_en, category, phone, website, opening_hours, node_id, smart_address_id, visitor_access_point_id, delivery_access_point_id, verification_level, is_published) VALUES
 ('مركز النور الطبي','Al-Noor Medical Center','عيادات وخدمات طبية','+963 11 000 0000','https://example.sy','السبت–الخميس 09:00–18:00','11111111-1111-4111-8111-111111111301','33333333-3333-4333-8333-333333333302','22222222-2222-4222-8222-222222222204','22222222-2222-4222-8222-222222222204','business_verified',true),
 ('مستودع الشام اللوجستي','Al-Sham Logistics Warehouse','مستودعات وشحن','+963 11 111 1111',NULL,'الأحد–الخميس 07:00–19:00','11111111-1111-4111-8111-111111111103','33333333-3333-4333-8333-333333333303','22222222-2222-4222-8222-222222222205','22222222-2222-4222-8222-222222222206','user_confirmed',true);

INSERT INTO public.location_aliases (node_id, alias, lang) VALUES
 ('11111111-1111-4111-8111-111111111301','النور','ar'),
 ('11111111-1111-4111-8111-111111111301','Al Nour','en'),
 ('11111111-1111-4111-8111-111111111301','Al-Nour Medical','en');