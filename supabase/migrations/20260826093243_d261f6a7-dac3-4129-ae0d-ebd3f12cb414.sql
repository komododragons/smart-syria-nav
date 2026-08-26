REVOKE EXECUTE ON FUNCTION public.record_verification(uuid, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_verification(uuid, uuid, text, text) TO service_role;