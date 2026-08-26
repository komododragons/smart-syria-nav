-- ============ Extensions ============
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============ Arabic normalisation for fuzzy search ============
CREATE OR REPLACE FUNCTION public.normalize_arabic(_t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(
    regexp_replace(
      translate(
        regexp_replace(coalesce(_t, ''), '[\u064B-\u0652\u0640]', '', 'g'),
        'أإآٱىيؤئةگچپڤ',
        'اااايياءءهكچبف'
      ),
      '\s+', ' ', 'g'
    )
  );
$$;

-- ============ Spatial columns + indexes on existing tables ============
ALTER TABLE public.location_nodes
  ADD COLUMN IF NOT EXISTS geo geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    END
  ) STORED;

ALTER TABLE public.access_points
  ADD COLUMN IF NOT EXISTS geo geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS location_nodes_geo_idx ON public.location_nodes USING gist (geo);
CREATE INDEX IF NOT EXISTS access_points_geo_idx ON public.access_points USING gist (geo);
CREATE INDEX IF NOT EXISTS location_nodes_name_trgm_idx ON public.location_nodes USING gin (public.normalize_arabic(display_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS businesses_name_ar_trgm_idx ON public.businesses USING gin (public.normalize_arabic(name_ar) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS businesses_name_en_trgm_idx ON public.businesses USING gin (public.normalize_arabic(coalesce(name_en,'')) gin_trgm_ops);

-- ============ Entrance purpose flags ============
ALTER TABLE public.access_points
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_delivery_entrance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pedestrian_entrance boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_emergency_entrance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_parking_entrance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_loading_entrance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vehicle_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wheelchair_accessible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temporary_status text,
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS photo_url text;

-- ============ road_access_points ============
CREATE TABLE IF NOT EXISTS public.road_access_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES public.location_nodes(id) ON DELETE CASCADE,
  access_point_id uuid REFERENCES public.access_points(id) ON DELETE SET NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  geo geography(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED,
  access_type text NOT NULL DEFAULT 'road_access',
  vehicle_types text[] NOT NULL DEFAULT ARRAY['car']::text[],
  stopping_allowed boolean NOT NULL DEFAULT true,
  parking_available boolean NOT NULL DEFAULT false,
  road_name text,
  approach_direction text,
  notes_ar text,
  notes_en text,
  verification_status text NOT NULL DEFAULT 'unverified',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.road_access_points TO authenticated;
GRANT SELECT ON public.road_access_points TO anon;
GRANT ALL ON public.road_access_points TO service_role;
ALTER TABLE public.road_access_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "road access points readable for public nodes"
ON public.road_access_points FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.location_nodes n
  WHERE n.id = node_id AND n.is_active AND (n.visibility = 'public' OR n.created_by = auth.uid())
));

CREATE POLICY "owners manage road access points"
ON public.road_access_points FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.location_nodes n WHERE n.id = node_id AND n.created_by = auth.uid())
  OR public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.location_nodes n WHERE n.id = node_id AND n.created_by = auth.uid())
  OR public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER road_access_points_updated BEFORE UPDATE ON public.road_access_points
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS road_access_points_geo_idx ON public.road_access_points USING gist (geo);
CREATE INDEX IF NOT EXISTS road_access_points_node_idx ON public.road_access_points (node_id);

-- ============ last_metre_instructions ============
CREATE TABLE IF NOT EXISTS public.last_metre_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES public.location_nodes(id) ON DELETE CASCADE,
  access_point_id uuid REFERENCES public.access_points(id) ON DELETE SET NULL,
  language text NOT NULL DEFAULT 'ar',
  instruction_text text,
  landmark_description text,
  door_description text,
  floor text,
  unit_number text,
  intercom_name text,
  elevator_available boolean,
  stairs_required boolean,
  call_on_arrival boolean NOT NULL DEFAULT false,
  delivery_notes text,
  accessibility_notes text,
  photo_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
  visibility text NOT NULL DEFAULT 'private',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.last_metre_instructions TO authenticated;
GRANT SELECT ON public.last_metre_instructions TO anon;
GRANT ALL ON public.last_metre_instructions TO service_role;
ALTER TABLE public.last_metre_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public last metre instructions readable"
ON public.last_metre_instructions FOR SELECT TO anon, authenticated
USING (visibility = 'public' AND EXISTS (
  SELECT 1 FROM public.location_nodes n WHERE n.id = node_id AND n.is_active AND n.visibility = 'public'
));

CREATE POLICY "owners read own last metre instructions"
ON public.last_metre_instructions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.location_nodes n WHERE n.id = node_id AND n.created_by = auth.uid())
  OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "owners manage last metre instructions"
ON public.last_metre_instructions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.location_nodes n WHERE n.id = node_id AND n.created_by = auth.uid())
  OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.location_nodes n WHERE n.id = node_id AND n.created_by = auth.uid())
  OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER last_metre_instructions_updated BEFORE UPDATE ON public.last_metre_instructions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS last_metre_node_idx ON public.last_metre_instructions (node_id);

-- ============ route_shares ============
CREATE TABLE IF NOT EXISTS public.route_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  share_type text NOT NULL DEFAULT 'public',
  smart_address_id uuid REFERENCES public.smart_addresses(id) ON DELETE CASCADE,
  node_id uuid REFERENCES public.location_nodes(id) ON DELETE CASCADE,
  access_point_id uuid REFERENCES public.access_points(id) ON DELETE SET NULL,
  travel_mode text NOT NULL DEFAULT 'driving',
  include_last_metre boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  one_time boolean NOT NULL DEFAULT false,
  revoked boolean NOT NULL DEFAULT false,
  access_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.route_shares TO authenticated;
GRANT ALL ON public.route_shares TO service_role;
ALTER TABLE public.route_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read own route shares"
ON public.route_shares FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users create route shares"
ON public.route_shares FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "owners update own route shares"
ON public.route_shares FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER route_shares_updated BEFORE UPDATE ON public.route_shares
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.route_share_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.route_shares(id) ON DELETE CASCADE,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL DEFAULT 'granted'
);

GRANT SELECT ON public.route_share_access TO authenticated;
GRANT ALL ON public.route_share_access TO service_role;
ALTER TABLE public.route_share_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "share owners read access log"
ON public.route_share_access FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.route_shares s WHERE s.id = share_id AND (s.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- ============ route_reports ============
CREATE TABLE IF NOT EXISTS public.route_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users(id),
  route_id text,
  smart_address_id uuid REFERENCES public.smart_addresses(id) ON DELETE SET NULL,
  node_id uuid REFERENCES public.location_nodes(id) ON DELETE SET NULL,
  access_point_id uuid REFERENCES public.access_points(id) ON DELETE SET NULL,
  category text NOT NULL,
  description text,
  latitude double precision,
  longitude double precision,
  photo_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'pending',
  reviewer_id uuid REFERENCES auth.users(id),
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.route_reports TO authenticated;
GRANT ALL ON public.route_reports TO service_role;
ALTER TABLE public.route_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reporters read own route reports"
ON public.route_reports FOR SELECT TO authenticated
USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users file route reports"
ON public.route_reports FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "moderators review route reports"
ON public.route_reports FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

-- ============ courier routes ============
CREATE TABLE IF NOT EXISTS public.courier_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL DEFAULT 'مسار توصيل',
  vehicle_type text NOT NULL DEFAULT 'car',
  start_latitude double precision,
  start_longitude double precision,
  end_latitude double precision,
  end_longitude double precision,
  status text NOT NULL DEFAULT 'draft',
  total_distance_m integer,
  total_duration_s integer,
  optimized_at timestamptz,
  warnings text[] NOT NULL DEFAULT ARRAY[]::text[],
  geometry text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.courier_routes TO authenticated;
GRANT ALL ON public.courier_routes TO service_role;
ALTER TABLE public.courier_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "couriers manage own routes"
ON public.courier_routes FOR ALL TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER courier_routes_updated BEFORE UPDATE ON public.courier_routes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.courier_route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.courier_routes(id) ON DELETE CASCADE,
  smart_code text,
  node_id uuid REFERENCES public.location_nodes(id) ON DELETE SET NULL,
  access_point_id uuid REFERENCES public.access_points(id) ON DELETE SET NULL,
  label text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  position integer NOT NULL DEFAULT 0,
  optimized_position integer,
  locked boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0,
  service_time_s integer NOT NULL DEFAULT 180,
  window_start time,
  window_end time,
  eta_seconds integer,
  unreachable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.courier_route_stops TO authenticated;
GRANT ALL ON public.courier_route_stops TO service_role;
ALTER TABLE public.courier_route_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "couriers manage own route stops"
ON public.courier_route_stops FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.courier_routes r WHERE r.id = route_id AND (r.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.courier_routes r WHERE r.id = route_id AND (r.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE TRIGGER courier_route_stops_updated BEFORE UPDATE ON public.courier_route_stops
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS courier_route_stops_route_idx ON public.courier_route_stops (route_id);

-- ============ navigation analytics + provider health ============
CREATE TABLE IF NOT EXISTS public.navigation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  smart_code text,
  travel_mode text,
  origin_method text,
  destination_kind text,
  provider text,
  success boolean,
  duration_ms integer,
  city text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.navigation_events TO authenticated;
GRANT INSERT ON public.navigation_events TO anon;
GRANT ALL ON public.navigation_events TO service_role;
ALTER TABLE public.navigation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read navigation events"
ON public.navigation_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE INDEX IF NOT EXISTS navigation_events_created_idx ON public.navigation_events (created_at DESC);
CREATE INDEX IF NOT EXISTS navigation_events_event_idx ON public.navigation_events (event);

CREATE TABLE IF NOT EXISTS public.navigation_provider_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  healthy boolean NOT NULL,
  latency_ms integer,
  status_code integer,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.navigation_provider_health TO authenticated;
GRANT ALL ON public.navigation_provider_health TO service_role;
ALTER TABLE public.navigation_provider_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read provider health"
ON public.navigation_provider_health FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- ============ Spatial helper: nearby public nodes ============
CREATE OR REPLACE FUNCTION public.nodes_near(_lat double precision, _lng double precision, _radius_m double precision DEFAULT 2000, _limit integer DEFAULT 50)
RETURNS TABLE (id uuid, display_name text, city text, neighborhood text, latitude double precision, longitude double precision, distance_m double precision)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT n.id, n.display_name, n.city, n.neighborhood, n.latitude, n.longitude,
         ST_Distance(n.geo, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography) AS distance_m
  FROM public.location_nodes n
  WHERE n.is_active AND n.geo IS NOT NULL
    AND ST_DWithin(n.geo, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography, LEAST(_radius_m, 50000))
  ORDER BY distance_m
  LIMIT LEAST(_limit, 200);
$$;

REVOKE EXECUTE ON FUNCTION public.nodes_near(double precision, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nodes_near(double precision, double precision, double precision, integer) TO anon, authenticated, service_role;