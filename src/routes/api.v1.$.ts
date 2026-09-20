import { createFileRoute } from "@tanstack/react-router";

/**
 * Friendly alias so developers can call `/api/v1/...` as documented.
 * Identical behaviour to `/api/public/v1/...`.
 */
export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => (await import("@/lib/api-v1.server")).handleApiV1(request),
      GET: async ({ request }) => (await import("@/lib/api-v1.server")).handleApiV1(request),
      POST: async ({ request }) => (await import("@/lib/api-v1.server")).handleApiV1(request),
    },
  },
});
