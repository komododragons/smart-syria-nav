-- 1. Verified logistics partners
CREATE TABLE IF NOT EXISTS public.logistics_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    api_key_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Delivery events attached to address codes
CREATE TABLE IF NOT EXISTS public.address_delivery_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address_code TEXT NOT NULL,
    partner_slug TEXT NOT NULL,
    tracking_number TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('created', 'in_transit', 'out_for_delivery', 'delivered', 'failed_attempt', 'cancelled')),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    failure_reason TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_events_code ON public.address_delivery_events(address_code);
CREATE INDEX IF NOT EXISTS idx_delivery_events_tracking ON public.address_delivery_events(tracking_number);

-- 3. Address deliverability summary
CREATE TABLE IF NOT EXISTS public.address_deliverability (
    address_code TEXT PRIMARY KEY,
    total_deliveries INTEGER NOT NULL DEFAULT 0,
    total_failed INTEGER NOT NULL DEFAULT 0,
    last_delivered_at TIMESTAMPTZ,
    is_field_verified BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Grants (required for Data API access). Partners table holds key hashes:
-- service_role only. Events: staff read. Deliverability: aggregate stats,
-- signed-in users only (NOT anon: public read would leak private residential codes).
GRANT ALL ON public.logistics_partners TO service_role;
GRANT SELECT ON public.address_delivery_events TO authenticated;
GRANT ALL ON public.address_delivery_events TO service_role;
GRANT SELECT ON public.address_deliverability TO authenticated;
GRANT ALL ON public.address_deliverability TO service_role;

-- 5. RLS
ALTER TABLE public.logistics_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.address_delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.address_deliverability ENABLE ROW LEVEL SECURITY;

-- Staff (moderator/admin) can inspect delivery events
CREATE POLICY "Staff read delivery events" ON public.address_delivery_events
    FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

-- Signed-in users can read aggregate deliverability stats (no PII fields)
CREATE POLICY "Authenticated read deliverability" ON public.address_deliverability
    FOR SELECT TO authenticated
    USING (true);

-- 6. Idempotent event recorder (race-safe via ON CONFLICT)
CREATE OR REPLACE FUNCTION public.record_partner_delivery_event(
    _partner_slug TEXT,
    _address_code TEXT,
    _tracking_number TEXT,
    _status TEXT,
    _occurred_at TIMESTAMPTZ,
    _lat DOUBLE PRECISION,
    _lng DOUBLE PRECISION,
    _failure_reason TEXT,
    _idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
    v_total_del INT;
    v_is_verified BOOLEAN;
BEGIN
    INSERT INTO public.address_delivery_events (
        address_code, partner_slug, tracking_number, status,
        occurred_at, latitude, longitude, failure_reason, idempotency_key
    ) VALUES (
        _address_code, _partner_slug, _tracking_number, _status,
        COALESCE(_occurred_at, now()), _lat, _lng, _failure_reason, _idempotency_key
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_event_id;

    -- Already recorded: return the existing event
    IF v_event_id IS NULL THEN
        SELECT id INTO v_event_id
        FROM public.address_delivery_events
        WHERE idempotency_key = _idempotency_key;
        RETURN jsonb_build_object(
            'ok', true,
            'status', 'already_recorded',
            'event_id', v_event_id
        );
    END IF;

    INSERT INTO public.address_deliverability (
        address_code, total_deliveries, total_failed, last_delivered_at, is_field_verified, updated_at
    ) VALUES (
        _address_code,
        CASE WHEN _status = 'delivered' THEN 1 ELSE 0 END,
        CASE WHEN _status = 'failed_attempt' THEN 1 ELSE 0 END,
        CASE WHEN _status = 'delivered' THEN COALESCE(_occurred_at, now()) ELSE NULL END,
        CASE WHEN _status = 'delivered' THEN TRUE ELSE FALSE END,
        now()
    )
    ON CONFLICT (address_code) DO UPDATE SET
        total_deliveries = address_deliverability.total_deliveries + CASE WHEN _status = 'delivered' THEN 1 ELSE 0 END,
        total_failed = address_deliverability.total_failed + CASE WHEN _status = 'failed_attempt' THEN 1 ELSE 0 END,
        last_delivered_at = CASE WHEN _status = 'delivered' THEN EXCLUDED.last_delivered_at ELSE address_deliverability.last_delivered_at END,
        is_field_verified = CASE WHEN _status = 'delivered' THEN TRUE ELSE address_deliverability.is_field_verified END,
        updated_at = now()
    RETURNING total_deliveries, is_field_verified INTO v_total_del, v_is_verified;

    RETURN jsonb_build_object(
        'ok', true,
        'status', 'recorded',
        'event_id', v_event_id,
        'address_code', _address_code,
        'total_deliveries', v_total_del,
        'is_field_verified', v_is_verified
    );
END;
$$;

-- Only the service role may record events (partners call via server route)
REVOKE EXECUTE ON FUNCTION public.record_partner_delivery_event(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_partner_delivery_event(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) TO service_role;

-- 7. Address delivery confidence score calculator (0-100).
-- Success rate drives the score; a confirmed field delivery adds a bonus.
CREATE OR REPLACE FUNCTION public.address_delivery_confidence(_address_code TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE
        WHEN d.address_code IS NULL THEN 0
        WHEN (d.total_deliveries + d.total_failed) = 0 THEN 0
        ELSE LEAST(100, GREATEST(0,
            ROUND(
                (d.total_deliveries::numeric / (d.total_deliveries + d.total_failed)) * 90
                + CASE WHEN d.is_field_verified THEN 10 ELSE 0 END
            )::int
        ))
    END
    FROM (SELECT * FROM public.address_deliverability WHERE address_code = _address_code) d
$$;

REVOKE EXECUTE ON FUNCTION public.address_delivery_confidence(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.address_delivery_confidence(TEXT) TO authenticated, service_role;