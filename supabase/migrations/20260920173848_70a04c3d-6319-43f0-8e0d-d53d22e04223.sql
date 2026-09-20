CREATE INDEX IF NOT EXISTS address_events_type_created_idx ON public.address_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS address_events_code_created_idx ON public.address_events (smart_code, created_at DESC);
CREATE INDEX IF NOT EXISTS api_usage_created_idx ON public.api_usage (created_at DESC);