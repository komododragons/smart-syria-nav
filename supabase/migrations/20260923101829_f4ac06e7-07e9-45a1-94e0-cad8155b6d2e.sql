CREATE TYPE public.address_classification AS ENUM (
  'private_residence',
  'business_shop',
  'office',
  'government_institution',
  'healthcare_facility',
  'hotel_accommodation',
  'building_residential_complex',
  'warehouse_industrial'
);

ALTER TABLE public.smart_addresses
  ADD COLUMN address_classification public.address_classification,
  ADD COLUMN classification_status text NOT NULL DEFAULT 'confirmed'
    CHECK (classification_status IN ('confirmed', 'needs_classification'));

UPDATE public.smart_addresses sa
SET address_classification = CASE
  WHEN EXISTS (SELECT 1 FROM public.businesses b WHERE b.smart_address_id = sa.id AND b.place_category IN ('government_office', 'government')) THEN 'government_institution'::public.address_classification
  WHEN EXISTS (SELECT 1 FROM public.businesses b WHERE b.smart_address_id = sa.id AND b.place_category IN ('hospital', 'pharmacy', 'clinic', 'healthcare')) THEN 'healthcare_facility'::public.address_classification
  WHEN EXISTS (SELECT 1 FROM public.businesses b WHERE b.smart_address_id = sa.id AND b.place_category IN ('hotel', 'accommodation')) THEN 'hotel_accommodation'::public.address_classification
  WHEN EXISTS (SELECT 1 FROM public.businesses b WHERE b.smart_address_id = sa.id AND b.place_category IN ('factory', 'warehouse', 'industrial')) THEN 'warehouse_industrial'::public.address_classification
  WHEN EXISTS (SELECT 1 FROM public.businesses b WHERE b.smart_address_id = sa.id AND (b.category ILIKE '%مكتب%' OR b.category ILIKE '%office%')) THEN 'office'::public.address_classification
  WHEN EXISTS (SELECT 1 FROM public.businesses b WHERE b.smart_address_id = sa.id) THEN 'business_shop'::public.address_classification
  WHEN NOT sa.is_public THEN 'private_residence'::public.address_classification
  WHEN EXISTS (SELECT 1 FROM public.location_nodes n WHERE n.id = sa.node_id AND n.node_type = 'warehouse') THEN 'warehouse_industrial'::public.address_classification
  ELSE 'building_residential_complex'::public.address_classification
END,
classification_status = CASE
  WHEN EXISTS (SELECT 1 FROM public.businesses b WHERE b.smart_address_id = sa.id)
    OR NOT sa.is_public
    OR EXISTS (SELECT 1 FROM public.location_nodes n WHERE n.id = sa.node_id AND n.node_type IN ('warehouse', 'apartment', 'unit', 'residence', 'home'))
  THEN 'confirmed'
  ELSE 'needs_classification'
END;

ALTER TABLE public.smart_addresses
  ALTER COLUMN address_classification SET NOT NULL;

CREATE INDEX smart_addresses_classification_idx
  ON public.smart_addresses (address_classification, classification_status, is_public);

CREATE TABLE public.commercial_address_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_address_id uuid NOT NULL REFERENCES public.smart_addresses(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  reasons text[] NOT NULL DEFAULT '{}',
  score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'owner_confirmed_private', 'conversion_requested', 'converted', 'dismissed')),
  owner_response text CHECK (owner_response IS NULL OR char_length(owner_response) <= 1000),
  reviewed_by uuid,
  decision_note text CHECK (decision_note IS NULL OR char_length(decision_note) <= 1000),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.commercial_address_reviews TO authenticated;
GRANT ALL ON public.commercial_address_reviews TO service_role;
ALTER TABLE public.commercial_address_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view commercial classification reviews"
  ON public.commercial_address_reviews FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY "Owners can respond to commercial classification reviews"
  ON public.commercial_address_reviews FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND status IN ('open', 'owner_confirmed_private', 'conversion_requested'))
  WITH CHECK (owner_id = auth.uid() AND status IN ('owner_confirmed_private', 'conversion_requested'));
CREATE POLICY "Administrators can view commercial classification reviews"
  ON public.commercial_address_reviews FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Administrators can review commercial classification reviews"
  ON public.commercial_address_reviews FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX commercial_address_reviews_one_open_idx
  ON public.commercial_address_reviews (smart_address_id)
  WHERE status IN ('open', 'owner_confirmed_private', 'conversion_requested');
CREATE INDEX commercial_address_reviews_queue_idx
  ON public.commercial_address_reviews (status, score DESC, created_at DESC);
CREATE INDEX commercial_address_reviews_owner_idx
  ON public.commercial_address_reviews (owner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_commercial_address_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER commercial_address_reviews_touch_updated_at
  BEFORE UPDATE ON public.commercial_address_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_commercial_address_review();

CREATE OR REPLACE FUNCTION public.enforce_address_classification_privacy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.address_classification = 'private_residence' THEN
    NEW.is_public := false;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER smart_addresses_enforce_classification_privacy
  BEFORE INSERT OR UPDATE OF address_classification, is_public ON public.smart_addresses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_address_classification_privacy();

CREATE OR REPLACE FUNCTION public.prevent_private_business_listing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.smart_address_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.smart_addresses sa
    WHERE sa.id = NEW.smart_address_id
      AND sa.address_classification = 'private_residence'
  ) THEN
    RAISE EXCEPTION 'private_residence_cannot_have_business_listing';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER businesses_prevent_private_address
  BEFORE INSERT OR UPDATE OF smart_address_id ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_private_business_listing();