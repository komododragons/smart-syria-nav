CREATE TABLE public.api_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.api_clients(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY['address.resolved'],
  is_active boolean NOT NULL DEFAULT true,
  environment text NOT NULL DEFAULT 'live',
  delivery_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  last_delivery_at timestamptz,
  last_status integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_webhooks_url_https CHECK (url ~* '^https://'),
  CONSTRAINT api_webhooks_env CHECK (environment IN ('live','test'))
);

CREATE INDEX api_webhooks_client_idx ON public.api_webhooks (client_id) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_webhooks TO authenticated;
GRANT ALL ON public.api_webhooks TO service_role;

ALTER TABLE public.api_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhooks owner manage"
ON public.api_webhooks FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.api_clients c WHERE c.id = client_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.api_clients c WHERE c.id = client_id AND c.owner_id = auth.uid()));