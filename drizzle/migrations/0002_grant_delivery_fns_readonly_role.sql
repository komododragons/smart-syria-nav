GRANT EXECUTE ON FUNCTION public.address_delivery_confidence(TEXT) TO supabase_read_only_user;
GRANT EXECUTE ON FUNCTION public.record_partner_delivery_event(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) TO supabase_read_only_user;
GRANT SELECT ON public.address_delivery_events TO supabase_read_only_user;
GRANT SELECT ON public.address_deliverability TO supabase_read_only_user;