/**
 * Privacy-preserving platform analytics for Syriasan staff.
 *
 * Everything here is aggregate. `address_events` stores no user identity, and
 * private residential addresses are excluded from every per-address breakdown,
 * so individual residential behaviour is never observable.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAFF_ROLES = ["admin", "moderator", "verifier"] as const;

async function isStaff(supa: any, userId: string) {
  const results = await Promise.all(
    STAFF_ROLES.map((role) => supa.rpc("has_role", { _user_id: userId, _role: role })),
  );
  return results.some((r: { data: unknown }) => Boolean(r.data));
}

export const platformAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ days: z.number().int().min(1).max(180).default(30) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.supabase, context.userId))) return { authorized: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sinceDate = new Date(Date.now() - data.days * 86_400_000);
    const since = sinceDate.toISOString();

    const from = supabaseAdmin.from as unknown as (table: string) => any;
    const count = async (
      table: string,
      build: (q: any) => any = (q) => q,
    ): Promise<number> => {
      const { count: n } = await build(from(table).select("id", { count: "exact", head: true }));
      return n ?? 0;
    };

    const [
      activeAddresses,
      verifiedNodes,
      businessLocations,
      apiRequests,
      addressesCreated,
      correctionsSubmitted,
      correctionsApplied,
      newNodes,
      apiResolutions,
    ] = await Promise.all([
      count("smart_addresses", (q) => q.eq("status", "active")),
      count("location_nodes", (q) =>
        q
          .eq("is_active", true)
          .in("verification_level", [
            "business_verified",
            "organization_verified",
            "syriasan_verified",
            "field_verified",
          ]),
      ),
      count("businesses", (q) => q.eq("is_published", true).eq("is_archived", false)),
      count("api_usage", (q) => q.gte("created_at", since)),
      count("smart_addresses", (q) => q.gte("created_at", since)),
      count("correction_reports", (q) => q.gte("created_at", since)),
      count("correction_reports", (q) => q.eq("applied", true).gte("applied_at", since)),
      count("location_nodes", (q) => q.gte("created_at", since)),
      count("api_usage", (q) => q.eq("endpoint", "/api/v1/resolve").gte("created_at", since).lt("status_code", 400)),
    ]);

    const { data: integrationEvents } = await supabaseAdmin
      .from("integration_events")
      .select("event_type, correlation_id, smart_code")
      .gte("occurred_at", since)
      .limit(50000);
    const reached = new Set<string>();
    const externalCodes = new Set<string>();
    for (const event of integrationEvents ?? []) {
      externalCodes.add(event.smart_code);
      if (event.event_type === "destination_reached") reached.add(event.correlation_id);
    }

    // Aggregate usage events for the window.
    const { data: events } = await supabaseAdmin
      .from("address_events")
      .select("event_type, smart_code, created_at")
      .gte("created_at", since)
      .limit(50000);

    const totals: Record<string, number> = {
      resolve: 0,
      qr_scan: 0,
      navigate_start: 0,
      delivery_view: 0,
      search_appearance: 0,
      plate_print: 0,
    };
    const byDay = new Map<string, number>();
    const byCode = new Map<string, number>();
    const resolutionByCode = new Map<string, number>();

    for (const ev of events ?? []) {
      const type = ev.event_type as string;
      totals[type] = (totals[type] ?? 0) + 1;
      const day = String(ev.created_at).slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      if (type === "resolve" || type === "navigate_start" || type === "delivery_view") {
        byCode.set(ev.smart_code, (byCode.get(ev.smart_code) ?? 0) + 1);
      }
      if (type === "resolve") resolutionByCode.set(ev.smart_code, (resolutionByCode.get(ev.smart_code) ?? 0) + 1);
    }

    // Top addresses: public, business-facing codes only — homes never appear.
    const candidates = [...byCode.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60)
      .map(([code]) => code);
    let topAddresses: { code: string; label: string; count: number }[] = [];
    if (candidates.length) {
      const { RESIDENTIAL_NODE_TYPES } = await import("./place-categories");
      const { data: rows } = await supabaseAdmin
        .from("smart_addresses")
        .select("code, is_public, location_nodes(display_name, city, node_type, visibility)")
        .in("code", candidates)
        .eq("is_public", true);
      for (const row of rows ?? []) {
        const node = (Array.isArray(row.location_nodes) ? row.location_nodes[0] : row.location_nodes) as
          | { display_name: string; city: string | null; node_type: string; visibility: string }
          | null;
        if (!node || node.visibility !== "public") continue;
        if (RESIDENTIAL_NODE_TYPES.includes(node.node_type)) continue;
        topAddresses.push({
          code: row.code,
          label: [node.display_name, node.city].filter(Boolean).join(" — "),
          count: byCode.get(row.code) ?? 0,
        });
      }
      topAddresses = topAddresses.sort((a, b) => b.count - a.count).slice(0, 10);
    }

    const series: { day: string; count: number }[] = [];
    for (let i = data.days - 1; i >= 0; i -= 1) {
      const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      series.push({ day, count: byDay.get(day) ?? 0 });
    }

    // Delivery-mode usage share of all navigation intent in the window.
    const navIntent = totals["navigate_start"]! + totals["delivery_view"]!;
    const deliveryShare = navIntent ? Math.round((totals["delivery_view"]! / navIntent) * 100) : 0;

    return {
      authorized: true as const,
      days: data.days,
      network: {
        active_addresses: activeAddresses,
        verified_addresses: verifiedNodes,
        business_locations: businessLocations,
        addresses_created: addressesCreated,
        locations_created: newNodes,
      },
      usage: {
        resolve: totals["resolve"] ?? 0,
        qr_scan: totals["qr_scan"] ?? 0,
        navigate_start: totals["navigate_start"] ?? 0,
        delivery_view: totals["delivery_view"] ?? 0,
        search_appearance: totals["search_appearance"] ?? 0,
        api_requests: apiRequests,
        delivery_share: deliveryShare,
        corrections_submitted: correctionsSubmitted,
        successful_corrections: correctionsApplied,
        api_address_resolutions: apiResolutions,
        repeat_address_usage: [...resolutionByCode.values()].filter((count) => count > 1).length,
        external_application_addresses: externalCodes.size,
        successful_destinations_reached: reached.size,
      },
      series,
      top_addresses: topAddresses,
    };
  });
