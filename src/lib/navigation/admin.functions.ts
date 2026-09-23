/**
 * Moderation and analytics server functions for the navigation subsystem.
 * Every function verifies the caller holds `moderator` or `admin` through the
 * authenticated client (never through the service-role client).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(context: { supabase: any; userId: string }) {
  const [{ data: isAdmin }, { data: isMod }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "moderator" }),
  ]);
  if (!isAdmin && !isMod) throw new Error("Forbidden");
  return { isAdmin: Boolean(isAdmin) };
}

export const listRouteReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ status: z.enum(["open", "reviewing", "resolved", "rejected", "all"]).default("open") })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    let q = context.supabase
      .from("route_reports")
      .select(
        "id, category, description, status, latitude, longitude, created_at, resolved_at, review_notes, node_id, access_point_id, smart_address_id",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { reports: rows ?? [] };
  });

export const reviewRouteReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "reviewing", "resolved", "rejected"]),
        notes: z.string().max(500).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const resolved = data.status === "resolved" || data.status === "rejected";
    const { error: auditError } = await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: "route_report_reviewed",
      resource_type: "route_report",
      resource_id: data.id,
      metadata: { status: data.status, has_notes: Boolean(data.notes) },
    });
    if (auditError) throw new Error(auditError.message);
    const { error } = await context.supabase
      .from("route_reports")
      .update({
        status: data.status,
        review_notes: data.notes ?? null,
        reviewer_id: context.userId,
        resolved_at: resolved ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Aggregated, privacy-safe navigation usage for the last 14 days. */
export const navigationAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { data: events } = await context.supabase
      .from("navigation_events")
      .select("event, travel_mode, destination_kind, city, provider, success, created_at")
      .gte("created_at", since)
      .limit(5000);

    const rows = (events ?? []) as {
      event: string;
      travel_mode: string | null;
      destination_kind: string | null;
      city: string | null;
      success: boolean | null;
    }[];

    const tally = (pick: (r: (typeof rows)[number]) => string | null) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const k = pick(r);
        if (!k) continue;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    };

    const failures = rows.filter((r) => r.success === false).length;
    const { count: openReports } = await context.supabase
      .from("route_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");
    const { count: activeShares } = await context.supabase
      .from("route_shares")
      .select("id", { count: "exact", head: true })
      .eq("revoked", false);

    return {
      total: rows.length,
      failures,
      openReports: openReports ?? 0,
      activeShares: activeShares ?? 0,
      byEvent: tally((r) => r.event),
      byMode: tally((r) => r.travel_mode),
      byDestinationKind: tally((r) => r.destination_kind),
      byCity: tally((r) => r.city),
    };
  });
