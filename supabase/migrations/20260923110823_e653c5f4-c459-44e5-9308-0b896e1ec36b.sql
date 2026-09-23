REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'st_estimatedextent'
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public', r.sig);
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'skip %', r.sig;
    END;
  END LOOP;
END $$;