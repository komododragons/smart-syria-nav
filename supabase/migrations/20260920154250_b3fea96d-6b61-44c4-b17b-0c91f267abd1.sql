ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'مفتاح API',
  ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.api_usage
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'GET',
  ADD COLUMN IF NOT EXISTS response_ms integer,
  ADD COLUMN IF NOT EXISTS scope text;

CREATE INDEX IF NOT EXISTS api_usage_client_time_idx ON public.api_usage (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON public.api_keys (key_hash);

UPDATE public.api_clients
SET scopes = ARRAY['addresses:read','resolve','search','validate','geocode','route','qr']
WHERE scopes IS NULL OR scopes = '{}' OR scopes = ARRAY['resolve'];