ALTER TABLE public.temporary_addresses
  ADD COLUMN IF NOT EXISTS shared_fields text[] NOT NULL DEFAULT ARRAY['location','building','entrance','instructions']::text[],
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS label text;

CREATE OR REPLACE FUNCTION public.validate_temporary_address()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  allowed text[] := ARRAY['location','building','entrance','floor','unit','instructions','parking','phone','name'];
  f text;
BEGIN
  IF NEW.shared_fields IS NULL OR array_length(NEW.shared_fields, 1) IS NULL THEN
    RAISE EXCEPTION 'shared_fields must contain at least one field';
  END IF;
  IF array_length(NEW.shared_fields, 1) > 9 THEN
    RAISE EXCEPTION 'too many shared fields';
  END IF;
  FOREACH f IN ARRAY NEW.shared_fields LOOP
    IF NOT (f = ANY(allowed)) THEN
      RAISE EXCEPTION 'unknown shared field: %', f;
    END IF;
  END LOOP;
  IF NEW.expires_at > now() + interval '365 days' THEN
    RAISE EXCEPTION 'expiry too far in the future';
  END IF;
  IF NEW.contact_phone IS NOT NULL AND length(NEW.contact_phone) > 32 THEN
    RAISE EXCEPTION 'contact_phone too long';
  END IF;
  IF NEW.contact_name IS NOT NULL AND length(NEW.contact_name) > 80 THEN
    RAISE EXCEPTION 'contact_name too long';
  END IF;
  IF NEW.label IS NOT NULL AND length(NEW.label) > 80 THEN
    RAISE EXCEPTION 'label too long';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_temporary_address_trg ON public.temporary_addresses;
CREATE TRIGGER validate_temporary_address_trg
BEFORE INSERT OR UPDATE ON public.temporary_addresses
FOR EACH ROW EXECUTE FUNCTION public.validate_temporary_address();