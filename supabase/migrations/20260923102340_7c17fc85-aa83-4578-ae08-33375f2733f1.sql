REVOKE UPDATE ON public.commercial_address_reviews FROM authenticated;

DROP POLICY IF EXISTS "Owners can respond to commercial classification reviews" ON public.commercial_address_reviews;

GRANT UPDATE ON public.commercial_address_reviews TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_commercial_review_moderation_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.owner_id = auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.smart_address_id IS DISTINCT FROM OLD.smart_address_id
       OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.reasons IS DISTINCT FROM OLD.reasons
       OR NEW.score IS DISTINCT FROM OLD.score
       OR NEW.evidence IS DISTINCT FROM OLD.evidence
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.decision_note IS DISTINCT FROM OLD.decision_note
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.status NOT IN ('owner_confirmed_private', 'conversion_requested') THEN
      RAISE EXCEPTION 'commercial_review_moderation_fields_are_protected';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER commercial_address_reviews_protect_moderation
  BEFORE UPDATE ON public.commercial_address_reviews
  FOR EACH ROW EXECUTE FUNCTION public.protect_commercial_review_moderation_fields();

CREATE POLICY "Owners can submit constrained commercial review responses"
  ON public.commercial_address_reviews FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND status IN ('open', 'owner_confirmed_private', 'conversion_requested'))
  WITH CHECK (owner_id = auth.uid() AND status IN ('owner_confirmed_private', 'conversion_requested'));