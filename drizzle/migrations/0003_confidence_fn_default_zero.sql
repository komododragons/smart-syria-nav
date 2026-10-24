CREATE OR REPLACE FUNCTION public.address_delivery_confidence(_address_code TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((
        SELECT CASE
            WHEN (d.total_deliveries + d.total_failed) = 0 THEN 0
            ELSE LEAST(100, GREATEST(0,
                ROUND(
                    (d.total_deliveries::numeric / (d.total_deliveries + d.total_failed)) * 90
                    + CASE WHEN d.is_field_verified THEN 10 ELSE 0 END
                )::int
            ))
        END
        FROM public.address_deliverability d
        WHERE d.address_code = _address_code
    ), 0)
$$;