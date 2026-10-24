import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const DeliveryEventSchema = z.object({
  address_code: z.string().min(4).max(32),
  tracking_number: z.string().min(3).max(64),
  status: z.enum([
    "created",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "failed_attempt",
    "cancelled",
  ]),
  occurred_at: z.string().datetime().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  failure_reason: z.string().max(100).optional(),
});

const JSON_HEADERS = { "Content-Type": "application/json" };

async function sha256Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Delivery event ingestion for registered logistics partners. The Bearer
 * token is the partner's API key; only its SHA-256 hash is stored and
 * compared. Events are recorded idempotently via record_partner_delivery_event.
 */
export const Route = createFileRoute("/api/public/deliveries/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Verify Bearer token against logistics_partners
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();

        if (!token) {
          return new Response(
            JSON.stringify({ error: "unauthorized", message: "Bearer token required" }),
            { status: 401, headers: JSON_HEADERS },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const tokenHash = await sha256Hex(token);
        const { data: partner } = await supabaseAdmin
          .from("logistics_partners")
          .select("partner_slug, is_active")
          .eq("api_key_hash", tokenHash)
          .eq("is_active", true)
          .maybeSingle();

        if (!partner) {
          return new Response(
            JSON.stringify({ error: "forbidden", message: "Invalid or inactive partner key" }),
            { status: 403, headers: JSON_HEADERS },
          );
        }

        // 2. Parse & validate body
        let bodyJson: unknown;
        try {
          bodyJson = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), {
            status: 400,
            headers: JSON_HEADERS,
          });
        }

        const parsed = DeliveryEventSchema.safeParse(bodyJson);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: "validation_error", details: parsed.error.issues }),
            { status: 400, headers: JSON_HEADERS },
          );
        }

        const data = parsed.data;
        const idempotencyKey =
          request.headers.get("X-Idempotency-Key") ||
          `${partner.partner_slug}:${data.tracking_number}:${data.status}`;

        // 3. Record the event (idempotent)
        const { data: result, error: rpcError } = await supabaseAdmin.rpc(
          "record_partner_delivery_event",
          {
            _partner_slug: partner.partner_slug,
            _address_code: data.address_code,
            _tracking_number: data.tracking_number,
            _status: data.status,
            _occurred_at: data.occurred_at
              ? new Date(data.occurred_at).toISOString()
              : new Date().toISOString(),
            _lat: data.latitude ?? null,
            _lng: data.longitude ?? null,
            _failure_reason: data.failure_reason ?? null,
            _idempotency_key: idempotencyKey,
          },
        );

        if (rpcError) {
          return new Response(JSON.stringify({ error: "server_error" }), {
            status: 500,
            headers: JSON_HEADERS,
          });
        }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: JSON_HEADERS,
        });
      },
    },
  },
});
