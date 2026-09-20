-- 1) Trust fields can only be changed by staff or by SECURITY DEFINER workflows.
CREATE OR REPLACE FUNCTION public.guard_trust_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  is_staff := public.has_role(auth.uid(), 'admin')
           OR public.has_role(auth.uid(), 'moderator')
           OR public.has_role(auth.uid(), 'verifier');

  IF is_staff THEN
    RETURN NEW;
  END IF;

  NEW.verification_level := OLD.verification_level;
  NEW.confidence_score := OLD.confidence_score;

  IF TG_TABLE_NAME = 'location_nodes' THEN
    NEW.verification_method := OLD.verification_method;
    NEW.last_verified_at := OLD.last_verified_at;
    NEW.created_by := OLD.created_by;
  ELSIF TG_TABLE_NAME = 'access_points' THEN
    NEW.last_verified_at := OLD.last_verified_at;
    NEW.created_by := OLD.created_by;
  ELSIF TG_TABLE_NAME = 'businesses' THEN
    NEW.owner_id := OLD.owner_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_trust_fields() FROM anon, authenticated;

DROP TRIGGER IF EXISTS guard_trust_location_nodes ON public.location_nodes;
CREATE TRIGGER guard_trust_location_nodes
  BEFORE UPDATE ON public.location_nodes
  FOR EACH ROW EXECUTE FUNCTION public.guard_trust_fields();

DROP TRIGGER IF EXISTS guard_trust_access_points ON public.access_points;
CREATE TRIGGER guard_trust_access_points
  BEFORE UPDATE ON public.access_points
  FOR EACH ROW EXECUTE FUNCTION public.guard_trust_fields();

DROP TRIGGER IF EXISTS guard_trust_businesses ON public.businesses;
CREATE TRIGGER guard_trust_businesses
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_trust_fields();

-- 2) Smart address ownership cannot be transferred by its owner.
CREATE OR REPLACE FUNCTION public.guard_smart_address_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_smart_address_owner() FROM anon, authenticated;

DROP TRIGGER IF EXISTS guard_smart_address_owner_trg ON public.smart_addresses;
CREATE TRIGGER guard_smart_address_owner_trg
  BEFORE UPDATE ON public.smart_addresses
  FOR EACH ROW EXECUTE FUNCTION public.guard_smart_address_owner();

-- 3) A claimant may withdraw, never approve, their own business claim.
CREATE OR REPLACE FUNCTION public.guard_business_claim_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_reviewer boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  is_reviewer := public.has_role(auth.uid(), 'admin')
              OR public.has_role(auth.uid(), 'moderator')
              OR public.has_role(auth.uid(), 'verifier');

  IF is_reviewer THEN
    RETURN NEW;
  END IF;

  -- Non-reviewers may only move their own pending claim to 'withdrawn'.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'withdrawn' THEN
    RAISE EXCEPTION 'only reviewers can decide business claims';
  END IF;

  NEW.granted_level := OLD.granted_level;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.review_notes := OLD.review_notes;
  NEW.claimant_id := OLD.claimant_id;
  NEW.business_id := OLD.business_id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_business_claim_review() FROM anon, authenticated;

DROP TRIGGER IF EXISTS guard_business_claim_review_trg ON public.business_claims;
CREATE TRIGGER guard_business_claim_review_trg
  BEFORE UPDATE ON public.business_claims
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_claim_review();