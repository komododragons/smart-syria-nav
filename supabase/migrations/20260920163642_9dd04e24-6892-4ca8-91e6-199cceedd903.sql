ALTER TABLE public.location_nodes ADD COLUMN IF NOT EXISTS place_category text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS place_category text;

CREATE OR REPLACE FUNCTION public.validate_place_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  allowed text[] := ARRAY[
    'hospital','pharmacy','clinic','school','university','government_office',
    'bank','atm','hotel','restaurant','fuel_station','factory','warehouse',
    'shopping_center','transport_hub','tourist_attraction','public_facility',
    'emergency_facility'
  ];
BEGIN
  IF NEW.place_category IS NOT NULL THEN
    NEW.place_category := lower(trim(NEW.place_category));
    IF NOT (NEW.place_category = ANY(allowed)) THEN
      RAISE EXCEPTION 'invalid place_category: %', NEW.place_category;
    END IF;
    IF TG_TABLE_NAME = 'location_nodes' AND NEW.visibility <> 'public' THEN
      RAISE EXCEPTION 'place_category is only allowed on public places';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_place_category_nodes ON public.location_nodes;
CREATE TRIGGER validate_place_category_nodes
BEFORE INSERT OR UPDATE ON public.location_nodes
FOR EACH ROW EXECUTE FUNCTION public.validate_place_category();

DROP TRIGGER IF EXISTS validate_place_category_businesses ON public.businesses;
CREATE TRIGGER validate_place_category_businesses
BEFORE INSERT OR UPDATE ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.validate_place_category();

CREATE INDEX IF NOT EXISTS location_nodes_place_category_idx
  ON public.location_nodes (place_category, governorate)
  WHERE place_category IS NOT NULL AND visibility = 'public' AND is_active;

CREATE INDEX IF NOT EXISTS businesses_place_category_idx
  ON public.businesses (place_category, is_published)
  WHERE place_category IS NOT NULL;