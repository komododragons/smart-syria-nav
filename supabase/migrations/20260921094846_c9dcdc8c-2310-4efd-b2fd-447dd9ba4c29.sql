-- Real geospatial index (only a btree on lat/lng existed)
CREATE INDEX IF NOT EXISTS location_nodes_geo_gist_idx
  ON public.location_nodes USING gist (geo)
  WHERE geo IS NOT NULL;

-- Resolution hot path: code -> smart_address -> node -> access points
CREATE INDEX IF NOT EXISTS smart_addresses_node_idx
  ON public.smart_addresses(node_id);
CREATE INDEX IF NOT EXISTS smart_addresses_created_by_idx
  ON public.smart_addresses(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS smart_addresses_default_ap_idx
  ON public.smart_addresses(default_access_point_id) WHERE default_access_point_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS access_points_node_active_idx
  ON public.access_points(node_id, sort_order) WHERE is_active;

CREATE INDEX IF NOT EXISTS access_point_contexts_ap_ctx_idx
  ON public.access_point_contexts(access_point_id, context);

CREATE INDEX IF NOT EXISTS access_point_purposes_ap_idx
  ON public.access_point_purposes(access_point_id, purpose);

CREATE INDEX IF NOT EXISTS access_restrictions_ap_idx
  ON public.access_restrictions(access_point_id);

CREATE INDEX IF NOT EXISTS last_metre_node_idx
  ON public.last_metre_instructions(node_id);

CREATE INDEX IF NOT EXISTS businesses_node_idx
  ON public.businesses(node_id) WHERE node_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS businesses_smart_address_idx
  ON public.businesses(smart_address_id) WHERE smart_address_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS businesses_owner_idx
  ON public.businesses(owner_id) WHERE owner_id IS NOT NULL;

-- Aliases: lookup by node and fuzzy Arabic-tolerant text search
CREATE INDEX IF NOT EXISTS location_aliases_node_idx
  ON public.location_aliases(node_id);
CREATE INDEX IF NOT EXISTS location_aliases_trgm_idx
  ON public.location_aliases USING gin (public.normalize_arabic(alias) gin_trgm_ops);

-- Public directory listing / search filters
CREATE INDEX IF NOT EXISTS location_nodes_public_active_idx
  ON public.location_nodes(governorate, node_type)
  WHERE visibility = 'public' AND is_active;

-- Share-token lookups
CREATE INDEX IF NOT EXISTS temporary_addresses_token_idx
  ON public.temporary_addresses(token);
CREATE INDEX IF NOT EXISTS route_shares_token_idx
  ON public.route_shares(token);

-- Duplicate of address_events_code_created_idx
DROP INDEX IF EXISTS public.idx_address_events_code_time;