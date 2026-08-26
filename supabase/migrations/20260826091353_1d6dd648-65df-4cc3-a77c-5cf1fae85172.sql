CREATE OR REPLACE FUNCTION public.apply_feedback_confidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta_val integer;
BEGIN
  delta_val := CASE WHEN NEW.successful THEN 3 ELSE -5 END;

  IF NEW.access_point_id IS NOT NULL THEN
    INSERT INTO public.confidence_events (access_point_id, factor, delta)
    VALUES (NEW.access_point_id, 'visit_feedback', delta_val);

    UPDATE public.access_points
    SET confidence_score = GREATEST(0, LEAST(100, confidence_score + delta_val))
    WHERE id = NEW.access_point_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER visit_feedback_confidence
AFTER INSERT ON public.visit_feedback
FOR EACH ROW EXECUTE FUNCTION public.apply_feedback_confidence();

CREATE OR REPLACE FUNCTION public.apply_correction_confidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.access_point_id IS NOT NULL THEN
    INSERT INTO public.confidence_events (access_point_id, factor, delta)
    VALUES (NEW.access_point_id, 'correction_reported', -2);

    UPDATE public.access_points
    SET confidence_score = GREATEST(0, LEAST(100, confidence_score - 2))
    WHERE id = NEW.access_point_id;
  ELSIF NEW.node_id IS NOT NULL THEN
    INSERT INTO public.confidence_events (node_id, factor, delta)
    VALUES (NEW.node_id, 'correction_reported', -2);

    UPDATE public.location_nodes
    SET confidence_score = GREATEST(0, LEAST(100, confidence_score - 2))
    WHERE id = NEW.node_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER correction_report_confidence
AFTER INSERT ON public.correction_reports
FOR EACH ROW EXECUTE FUNCTION public.apply_correction_confidence();