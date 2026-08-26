import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const querySchema = z.object({
  code: z.string().min(4).max(32),
  purpose: z.string().min(2).max(40).default("visitor"),
  wheelchair: z.enum(["true", "false"]).default("false"),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=60",
};

/**
 * Public purpose-aware resolution API for couriers, emergency services and
 * logistics platforms. Only public smart addresses resolve here; private
 * residential addresses return `private` with no hierarchy disclosed.
 *
 * Optional `x-api-key` header: keys issued from /developers are validated
 * against the network key store and each request is metered into api_usage.
 * Anonymous requests stay allowed but unmetered.
 */
export const Route = createFileRoute("/api/public/resolve")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        let clientId: string | null = null;
        const apiKey = request.headers.get("x-api-key");
        if (apiKey) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { verifyApiKey } = await import("@/lib/network.server");
          clientId = await verifyApiKey(supabaseAdmin, apiKey);
          if (!clientId) {
            return new Response(
              JSON.stringify({ error: "invalid_api_key" }),
              { status: 401, headers: CORS },
            );
          }
        }

        const url = new URL(request.url);
        const parsed = querySchema.safeParse({
          code: url.searchParams.get("code") ?? "",
          purpose: url.searchParams.get("purpose") ?? undefined,
          wheelchair: url.searchParams.get("wheelchair") ?? undefined,
        });
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: "invalid_request", details: parsed.error.issues }),
            { status: 400, headers: CORS },
          );
        }

        const { resolvePublicCode } = await import("@/lib/addresses.server");
        const result = await resolvePublicCode(parsed.data.code, parsed.data.purpose as never, {
          requireWheelchair: parsed.data.wheelchair === "true",
        });

        const statusCode = result.status === "ok" ? 200 : result.status === "not_found" ? 404 : 403;
        if (clientId) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          void supabaseAdmin
            .from("api_usage")
            .insert({ client_id: clientId, endpoint: "/api/public/resolve", status_code: statusCode })
            .then(() => undefined, () => undefined);
        }

        if (result.status !== "ok") {
          return new Response(JSON.stringify(result), {
            status: statusCode,
            headers: CORS,
          });
        }

        return new Response(
          JSON.stringify({
            code: result.code,
            purpose: result.purpose,
            confidence: result.confidence,
            verification_level: result.verification_level,
            destination: {
              display_name: result.site.display_name,
              governorate: result.site.governorate,
              city: result.site.city,
              neighborhood: result.site.neighborhood,
              street: result.site.street,
              landmark: result.site.landmark,
            },
            hierarchy: result.chain.map((node) => ({
              node_type: node.node_type,
              label: node.unit_label ?? node.floor_label ?? node.display_name,
            })),
            recommended_access_point: result.recommended
              ? {
                  name: result.recommended.display_name,
                  access_type: result.recommended.access_type,
                  latitude: result.recommended.latitude,
                  longitude: result.recommended.longitude,
                  instructions: result.recommended.instructions,
                  open_now: result.recommended.open_now,
                  hours: result.recommended.hours,
                  accessibility: result.recommended.accessibility,
                }
              : null,
            alternatives: result.alternatives.map((ap) => ({
              name: ap.display_name,
              latitude: ap.latitude,
              longitude: ap.longitude,
              open_now: ap.open_now,
            })),
            prohibited: result.prohibited,
            notes: result.notes,
          }),
          { status: 200, headers: CORS },
        );
      },
    },
  },
});
