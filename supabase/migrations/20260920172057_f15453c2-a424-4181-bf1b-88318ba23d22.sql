ALTER TABLE public.correction_reports
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_field text,
  ADD COLUMN IF NOT EXISTS original_value text,
  ADD COLUMN IF NOT EXISTS suggested_value text,
  ADD COLUMN IF NOT EXISTS decision text,
  ADD COLUMN IF NOT EXISTS decision_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS applied boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS applied_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.validate_correction_report()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.issue_type := lower(btrim(NEW.issue_type));
  IF NEW.issue_type NOT IN (
    'wrong_location','wrong_business_name','business_closed','entrance_changed',
    'duplicate_location','incorrect_category','access_issue','wrong_building_pin',
    'wrong_entrance','entrance_closed','delivery_prohibited','wrong_floor',
    'business_moved','incorrect_name','incorrect_hours','unsafe_access','other'
  ) THEN
    RAISE EXCEPTION 'نوع بلاغ التصحيح غير معروف: %', NEW.issue_type;
  END IF;

  IF NEW.status NOT IN ('pending','under_review','approved','rejected','reviewed','dismissed') THEN
    RAISE EXCEPTION 'حالة بلاغ التصحيح غير معروفة: %', NEW.status;
  END IF;

  IF NEW.decision IS NOT NULL AND NEW.decision NOT IN ('approved','rejected','needs_more_info') THEN
    RAISE EXCEPTION 'قرار المراجعة غير معروف: %', NEW.decision;
  END IF;

  IF NEW.target_field IS NOT NULL AND NEW.target_field NOT IN (
    'node_coordinates','business_name','business_status','business_category',
    'place_category','entrance','access','other'
  ) THEN
    RAISE EXCEPTION 'حقل التصحيح غير معروف: %', NEW.target_field;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_correction_report_trg ON public.correction_reports;
CREATE TRIGGER validate_correction_report_trg
BEFORE INSERT OR UPDATE ON public.correction_reports
FOR EACH ROW EXECUTE FUNCTION public.validate_correction_report();

CREATE INDEX IF NOT EXISTS correction_reports_status_idx
  ON public.correction_reports (status, created_at DESC);