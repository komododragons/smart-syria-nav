ALTER TABLE public.location_nodes
  ADD COLUMN IF NOT EXISTS building_number text,
  ADD COLUMN IF NOT EXISTS parking_info text,
  ADD COLUMN IF NOT EXISTS loading_info text,
  ADD COLUMN IF NOT EXISTS wheelchair_accessible boolean,
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

ALTER TABLE public.access_points
  ADD COLUMN IF NOT EXISTS parking_info text,
  ADD COLUMN IF NOT EXISTS loading_info text,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

UPDATE public.location_nodes n
SET last_verified_at = v.created_at,
    verification_method = COALESCE(n.verification_method, v.method)
FROM (
  SELECT DISTINCT ON (node_id) node_id, created_at, method
  FROM public.verifications
  WHERE node_id IS NOT NULL
  ORDER BY node_id, created_at DESC
) v
WHERE v.node_id = n.id AND n.last_verified_at IS NULL;

UPDATE public.access_points a
SET last_verified_at = v.created_at
FROM (
  SELECT DISTINCT ON (access_point_id) access_point_id, created_at
  FROM public.verifications
  WHERE access_point_id IS NOT NULL
  ORDER BY access_point_id, created_at DESC
) v
WHERE v.access_point_id = a.id AND a.last_verified_at IS NULL;