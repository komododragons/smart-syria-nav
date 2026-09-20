CREATE TABLE public.access_point_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_point_id uuid NOT NULL REFERENCES public.access_points(id) ON DELETE CASCADE,
  context text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  approach_ar text,
  approach_en text,
  preferred_road text,
  vehicle_note text,
  always_open boolean NOT NULL DEFAULT true,
  opens_at time,
  closes_at time,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (access_point_id, context)
);

GRANT SELECT ON public.access_point_contexts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_point_contexts TO authenticated;
GRANT ALL ON public.access_point_contexts TO service_role;

ALTER TABLE public.access_point_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contexts readable" ON public.access_point_contexts
FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.access_points a
  JOIN public.location_nodes n ON n.id = a.node_id
  WHERE a.id = access_point_contexts.access_point_id
    AND n.visibility = 'public' AND n.is_active
));

CREATE POLICY "contexts manage own" ON public.access_point_contexts
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.access_points a
  WHERE a.id = access_point_contexts.access_point_id AND a.created_by = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.access_points a
  WHERE a.id = access_point_contexts.access_point_id AND a.created_by = auth.uid()
));

CREATE POLICY "contexts staff manage" ON public.access_point_contexts
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'verifier'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'verifier'));

CREATE OR REPLACE FUNCTION public.validate_routing_context()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.context := lower(trim(NEW.context));
  IF NEW.context NOT IN (
    'standard','visitor','parcel','commercial_delivery','heavy_freight','emergency','accessible'
  ) THEN
    RAISE EXCEPTION 'invalid routing context: %', NEW.context;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_routing_context_trg
BEFORE INSERT OR UPDATE ON public.access_point_contexts
FOR EACH ROW EXECUTE FUNCTION public.validate_routing_context();

CREATE INDEX access_point_contexts_ap_idx ON public.access_point_contexts (access_point_id, context);