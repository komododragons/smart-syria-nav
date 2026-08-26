CREATE OR REPLACE FUNCTION public.record_verification(_node_id uuid, _access_point_id uuid, _level text, _method text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'verifier')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.has_role(auth.uid(), 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _level NOT IN ('user_confirmed', 'community_confirmed', 'courier_verified', 'owner_verified', 'officially_verified') THEN
    RAISE EXCEPTION 'invalid verification level';
  END IF;

  IF _node_id IS NULL AND _access_point_id IS NULL THEN
    RAISE EXCEPTION 'target required';
  END IF;

  INSERT INTO public.verifications (node_id, access_point_id, level, method, actor_id)
  VALUES (_node_id, _access_point_id, _level, _method, auth.uid())
  RETURNING id INTO new_id;

  IF _access_point_id IS NOT NULL THEN
    UPDATE public.access_points
    SET verification_level = _level,
        confidence_score = LEAST(100, confidence_score + 10)
    WHERE id = _access_point_id;
    INSERT INTO public.confidence_events (access_point_id, factor, delta)
    VALUES (_access_point_id, 'field_verification', 10);
  ELSIF _node_id IS NOT NULL THEN
    UPDATE public.location_nodes
    SET verification_level = _level,
        confidence_score = LEAST(100, confidence_score + 10)
    WHERE id = _node_id;
    INSERT INTO public.confidence_events (node_id, factor, delta)
    VALUES (_node_id, 'field_verification', 10);
  END IF;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_verification(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_verification(uuid, uuid, text, text) TO authenticated;