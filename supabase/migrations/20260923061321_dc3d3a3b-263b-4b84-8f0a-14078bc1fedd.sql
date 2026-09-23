ALTER TABLE public.integration_events
  DROP CONSTRAINT integration_events_context_check;
ALTER TABLE public.integration_events
  ADD CONSTRAINT integration_events_context_check CHECK (routing_context IN (
    'standard', 'visitor', 'parcel', 'commercial_delivery', 'heavy_freight',
    'emergency', 'accessible'
  ));