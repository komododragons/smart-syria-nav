-- PHASE 28 — additive database architecture. No existing table or row is touched.

-- 1) QR codes -----------------------------------------------------------
CREATE TABLE public.qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_address_id uuid NOT NULL REFERENCES public.smart_addresses(id) ON DELETE CASCADE,
  node_id uuid REFERENCES public.location_nodes(id) ON DELETE SET NULL,
  access_point_id uuid REFERENCES public.access_points(id) ON DELETE SET NULL,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  label text,
  plate_format text NOT NULL DEFAULT 'a6'
    CHECK (plate_format IN ('a6','a5','a4','sticker','door_plate','shop_window')),
  target_url text NOT NULL,
  scan_count integer NOT NULL DEFAULT 0 CHECK (scan_count >= 0),
  last_scanned_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_codes TO authenticated;
GRANT ALL ON public.qr_codes TO service_role;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_codes own manage" ON public.qr_codes
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "qr_codes staff read" ON public.qr_codes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE INDEX qr_codes_smart_address_idx ON public.qr_codes(smart_address_id);
CREATE INDEX qr_codes_created_by_idx ON public.qr_codes(created_by);
CREATE INDEX qr_codes_business_idx ON public.qr_codes(business_id) WHERE business_id IS NOT NULL;

CREATE TRIGGER qr_codes_touch BEFORE UPDATE ON public.qr_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Verification documents ---------------------------------------------
CREATE TABLE public.verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('node','business','claim')),
  node_id uuid REFERENCES public.location_nodes(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  claim_id uuid REFERENCES public.business_claims(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'other'
    CHECK (document_type IN ('commercial_register','tax_card','utility_bill','lease','id_document','photo','letter','other')),
  storage_path text NOT NULL,
  mime_type text,
  size_bytes integer CHECK (size_bytes IS NULL OR size_bytes >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected')),
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT verification_documents_subject_ref CHECK (
    (subject_type = 'node' AND node_id IS NOT NULL)
    OR (subject_type = 'business' AND business_id IS NOT NULL)
    OR (subject_type = 'claim' AND claim_id IS NOT NULL)
  )
);

GRANT SELECT, INSERT, UPDATE ON public.verification_documents TO authenticated;
GRANT ALL ON public.verification_documents TO service_role;
ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verification_documents own read" ON public.verification_documents
  FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid());

CREATE POLICY "verification_documents own insert" ON public.verification_documents
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "verification_documents staff read" ON public.verification_documents
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'verifier')
    OR public.has_role(auth.uid(),'moderator')
    OR public.has_role(auth.uid(),'admin')
  );

CREATE POLICY "verification_documents staff review" ON public.verification_documents
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'verifier')
    OR public.has_role(auth.uid(),'moderator')
    OR public.has_role(auth.uid(),'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'verifier')
    OR public.has_role(auth.uid(),'moderator')
    OR public.has_role(auth.uid(),'admin')
  );

CREATE INDEX verification_documents_uploader_idx ON public.verification_documents(uploaded_by);
CREATE INDEX verification_documents_status_idx ON public.verification_documents(status, created_at DESC);
CREATE INDEX verification_documents_claim_idx ON public.verification_documents(claim_id) WHERE claim_id IS NOT NULL;
CREATE INDEX verification_documents_business_idx ON public.verification_documents(business_id) WHERE business_id IS NOT NULL;
CREATE INDEX verification_documents_node_idx ON public.verification_documents(node_id) WHERE node_id IS NOT NULL;

CREATE TRIGGER verification_documents_touch BEFORE UPDATE ON public.verification_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Bulk imports --------------------------------------------------------
CREATE TABLE public.imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  filename text NOT NULL,
  source text NOT NULL DEFAULT 'csv' CHECK (source IN ('csv','xlsx','api','manual')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','canceled')),
  total_rows integer NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  success_rows integer NOT NULL DEFAULT 0 CHECK (success_rows >= 0),
  error_rows integer NOT NULL DEFAULT 0 CHECK (error_rows >= 0),
  notes text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imports TO authenticated;
GRANT ALL ON public.imports TO service_role;
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imports own manage" ON public.imports
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "imports admin read" ON public.imports
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX imports_owner_idx ON public.imports(owner_id, created_at DESC);
CREATE INDEX imports_org_idx ON public.imports(organization_id) WHERE organization_id IS NOT NULL;

CREATE TRIGGER imports_touch BEFORE UPDATE ON public.imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.imports(id) ON DELETE CASCADE,
  row_number integer NOT NULL CHECK (row_number > 0),
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','imported','skipped','error')),
  error_message text,
  node_id uuid REFERENCES public.location_nodes(id) ON DELETE SET NULL,
  smart_address_id uuid REFERENCES public.smart_addresses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_id, row_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_rows TO authenticated;
GRANT ALL ON public.import_rows TO service_role;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_rows own manage" ON public.import_rows
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.imports i WHERE i.id = import_id AND i.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.imports i WHERE i.id = import_id AND i.owner_id = auth.uid()));

CREATE POLICY "import_rows admin read" ON public.import_rows
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX import_rows_import_idx ON public.import_rows(import_id, row_number);
CREATE INDEX import_rows_status_idx ON public.import_rows(import_id, status);

CREATE TRIGGER import_rows_touch BEFORE UPDATE ON public.import_rows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Routing profiles (public reference data) ----------------------------
CREATE TABLE public.routing_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  vehicle_type text NOT NULL
    CHECK (vehicle_type IN ('foot','bicycle','motorcycle','car','van','truck','ambulance','wheelchair')),
  ors_profile text NOT NULL,
  max_weight_kg integer CHECK (max_weight_kg IS NULL OR max_weight_kg > 0),
  max_height_m numeric(4,2) CHECK (max_height_m IS NULL OR max_height_m > 0),
  avoid_features text[] NOT NULL DEFAULT '{}'::text[],
  default_context text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.routing_profiles TO anon;
GRANT SELECT ON public.routing_profiles TO authenticated;
GRANT ALL ON public.routing_profiles TO service_role;
ALTER TABLE public.routing_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "routing_profiles public read" ON public.routing_profiles
  FOR SELECT TO anon, authenticated
  USING (is_active);

CREATE POLICY "routing_profiles admin manage" ON public.routing_profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX routing_profiles_active_idx ON public.routing_profiles(is_active, sort_order);

CREATE TRIGGER routing_profiles_touch BEFORE UPDATE ON public.routing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();