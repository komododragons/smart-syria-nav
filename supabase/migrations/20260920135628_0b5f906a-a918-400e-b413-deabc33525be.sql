CREATE OR REPLACE FUNCTION public.validate_business_claim()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pending','approved','rejected','withdrawn','superseded') THEN
    RAISE EXCEPTION 'invalid claim status %', NEW.status;
  END IF;
  IF NEW.claim_method NOT IN ('document','phone','email','on_site','other') THEN
    RAISE EXCEPTION 'invalid claim method %', NEW.claim_method;
  END IF;
  IF NEW.granted_level IS NOT NULL AND NEW.granted_level NOT IN
     ('user_confirmed','community_confirmed','business_verified','organization_verified','official_verified') THEN
    RAISE EXCEPTION 'invalid granted level %', NEW.granted_level;
  END IF;
  IF array_length(NEW.evidence_urls, 1) > 8 THEN
    RAISE EXCEPTION 'too many evidence files';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;