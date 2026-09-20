ALTER TABLE public.favorites
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.validate_favorite()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  allowed text[] := ARRAY['home','work','parents','warehouse','office','other'];
BEGIN
  IF NOT (NEW.category = ANY(allowed)) THEN
    RAISE EXCEPTION 'unknown category: %', NEW.category;
  END IF;
  IF NEW.note IS NOT NULL AND length(NEW.note) > 300 THEN
    RAISE EXCEPTION 'note too long';
  END IF;
  IF NEW.label IS NOT NULL AND length(NEW.label) > 80 THEN
    RAISE EXCEPTION 'label too long';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_favorite_trg ON public.favorites;
CREATE TRIGGER validate_favorite_trg
BEFORE INSERT OR UPDATE ON public.favorites
FOR EACH ROW EXECUTE FUNCTION public.validate_favorite();

CREATE INDEX IF NOT EXISTS favorites_user_sort_idx ON public.favorites (user_id, sort_order, created_at DESC);