ALTER TABLE public.business_claims
  ADD COLUMN IF NOT EXISTS claimant_name text,
  ADD COLUMN IF NOT EXISTS claimant_role text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS claim_method text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS evidence_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS granted_level text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

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
     ('community','owner_claimed','business_verified','organization_verified','syriasan_verified') THEN
    RAISE EXCEPTION 'invalid granted level %', NEW.granted_level;
  END IF;
  IF array_length(NEW.evidence_urls, 1) > 8 THEN
    RAISE EXCEPTION 'too many evidence files';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_business_claim_trg ON public.business_claims;
CREATE TRIGGER validate_business_claim_trg
BEFORE INSERT OR UPDATE ON public.business_claims
FOR EACH ROW EXECUTE FUNCTION public.validate_business_claim();

CREATE UNIQUE INDEX IF NOT EXISTS business_claims_one_pending
  ON public.business_claims (business_id, claimant_id)
  WHERE status = 'pending';

DROP POLICY IF EXISTS "claims withdraw own" ON public.business_claims;
CREATE POLICY "claims withdraw own" ON public.business_claims
  FOR UPDATE TO authenticated
  USING (claimant_id = auth.uid() AND status = 'pending')
  WITH CHECK (claimant_id = auth.uid());