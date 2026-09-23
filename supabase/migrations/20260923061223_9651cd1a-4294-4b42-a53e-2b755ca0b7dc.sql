ALTER TABLE public.api_clients
  ADD COLUMN IF NOT EXISTS integration_sector text NOT NULL DEFAULT 'general';

ALTER TABLE public.api_clients
  ADD CONSTRAINT api_clients_integration_sector_check
  CHECK (integration_sector IN (
    'general', 'courier', 'ecommerce', 'banking', 'fintech', 'insurance',
    'utilities', 'healthcare', 'hospitality', 'government', 'municipality',
    'emergency', 'logistics'
  ));

CREATE TABLE public.integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.api_clients(id) ON DELETE CASCADE,
  smart_code text NOT NULL,
  sector text NOT NULL,
  routing_context text NOT NULL,
  event_type text NOT NULL,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  source text NOT NULL DEFAULT 'api',
  successful boolean,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integration_events_sector_check CHECK (sector IN (
    'general', 'courier', 'ecommerce', 'banking', 'fintech', 'insurance',
    'utilities', 'healthcare', 'hospitality', 'government', 'municipality',
    'emergency', 'logistics'
  )),
  CONSTRAINT integration_events_context_check CHECK (routing_context IN (
    'standard', 'visitor', 'parcel', 'commercial_delivery', 'heavy_freight',
    'emergency', 'wheelchair'
  )),
  CONSTRAINT integration_events_type_check CHECK (event_type IN (
    'address_used', 'navigation_started', 'destination_reached'
  )),
  CONSTRAINT integration_events_idempotency_length CHECK (char_length(idempotency_key) BETWEEN 8 AND 120),
  CONSTRAINT integration_events_source_length CHECK (char_length(source) BETWEEN 2 AND 40),
  UNIQUE (client_id, idempotency_key)
);

GRANT SELECT ON public.integration_events TO authenticated;
GRANT ALL ON public.integration_events TO service_role;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integration events admin read"
  ON public.integration_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX integration_events_client_time_idx
  ON public.integration_events (client_id, occurred_at DESC);
CREATE INDEX integration_events_type_time_idx
  ON public.integration_events (event_type, occurred_at DESC);
CREATE INDEX integration_events_code_time_idx
  ON public.integration_events (smart_code, occurred_at DESC);
CREATE INDEX integration_events_correlation_idx
  ON public.integration_events (correlation_id, occurred_at ASC);