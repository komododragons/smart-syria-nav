import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const querySchema = z.object({ reference: z.string().min(4).max(40) });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

/**
 * Checkout resolution endpoint for e-commerce platforms (WooCommerce, Shopify,
 * custom stores, marketplaces, delivery apps). Accepts a public smart code or a
 * temporary share token and returns only checkout-safe fields.
 */
export const Route = createFileRoute("/api/public/checkout")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = querySchema.safeParse({
          reference: url.searchParams.get("reference") ?? url.searchParams.get("code") ?? "",
        });
        if (!parsed.success) {
          return new Response(JSON.stringify({ status: "invalid_request" }), {
            status: 400,
            headers: CORS,
          });
        }

        const { resolveForCheckout } = await import("@/lib/checkout.server");
        const result = await resolveForCheckout(parsed.data.reference);
        const status =
          result.status === "ok" ? 200 : result.status === "not_found" ? 404 : result.status === "private" ? 403 : 410;
        return new Response(JSON.stringify(result), { status, headers: CORS });
      },
    },
  },
});
