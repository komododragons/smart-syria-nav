import { createFileRoute } from "@tanstack/react-router";

/**
 * Syriasan Developer API v1 — canonical public mount.
 * All routing, authentication, scopes, rate limiting, metering and auditing
 * live in the server-only dispatcher.
 */
export const Route = createFileRoute("/api/public/v1/$")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => (await import("@/lib/api-v1.server")).handleApiV1(request),
      GET: async ({ request }) => (await import("@/lib/api-v1.server")).handleApiV1(request),
      POST: async ({ request }) => (await import("@/lib/api-v1.server")).handleApiV1(request),
    },
  },
});
