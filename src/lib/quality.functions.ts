import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  QUALITY_STALE_DAYS,
  scoreAddress,
  type QualityEntrance,
  type QualityInputNode,
  type QualityResult,
} from "./quality.server";

type Client = SupabaseClient<Database>;

async function isStaff(supa: Client, userId: string): Promise<boolean> {
  for (const role of ["verifier", "moderator", "admin"] as const) {
    const { data } = await supa.rpc("has_role", { _user_id: userId, _role: role });
    if (data) return true;
  }
  return false;
}

const OPEN_STATUSES = ["pending", "open", "new", "reported", "under_review"];

/**
 * Internal address-quality dashboard: scores public addresses and groups the
 * ones needing attention. Staff only — never surfaced to public consumers.
 */
export const qualityDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supa = context.supabase;
    if (!(await isStaff(supa, context.userId))) return { authorized: false as const };

    const { data: nodesRaw } = await supa
      .from("location_nodes")
      .select(
        "id, display_name, node_type, city, governorate, street, neighborhood, landmark, building_number, latitude, longitude, verification_level, last_verified_at, confidence_score",
      )
      .eq("is_active", true)
      .eq("visibility", "public")
      .order("confidence_score", { ascending: true })
      .limit(400);

    const nodes = (nodesRaw ?? []) as QualityInputNode[];
    const nodeIds = nodes.map((n) => n.id);

    const [apsRes, dupRes, corrRes, routeRes, bizRes] = await Promise.all([
      nodeIds.length
        ? supa
            .from("access_points")
            .select(
              "node_id, latitude, longitude, vehicle_access, wheelchair_accessible, instructions_ar, instructions_en",
            )
            .in("node_id", nodeIds)
            .eq("is_active", true)
        : Promise.resolve({ data: [] as QualityEntrance[] }),
      supa
        .from("duplicate_candidates")
        .select("id, node_a, node_b, distance_meters, status, created_at")
        .in("status", OPEN_STATUSES)
        .order("distance_meters", { ascending: true })
        .limit(60),
      supa
        .from("correction_reports")
        .select("id, node_id, smart_code, issue_type, details, status, created_at")
        .in("status", OPEN_STATUSES)
        .order("created_at", { ascending: false })
        .limit(60),
      supa
        .from("route_reports")
        .select("id, node_id, category, description, status, created_at")
        .in("status", OPEN_STATUSES)
        .order("created_at", { ascending: false })
        .limit(60),
      supa
        .from("businesses")
        .select("id, name_ar, name_en, category, verification_level, node_id, created_at")
        .eq("is_published", true)
        .eq("is_archived", false)
        .in("verification_level", ["unverified", "community_submitted", "user_confirmed"])
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    const entrancesByNode = new Map<string, QualityEntrance[]>();
    for (const row of (apsRes.data ?? []) as QualityEntrance[]) {
      const list = entrancesByNode.get(row.node_id) ?? [];
      list.push(row);
      entrancesByNode.set(row.node_id, list);
    }

    const duplicates = dupRes.data ?? [];
    const duplicateNodes = new Set<string>();
    for (const d of duplicates) {
      duplicateNodes.add(d.node_a);
      duplicateNodes.add(d.node_b);
    }

    const scored: QualityResult[] = nodes.map((node) =>
      scoreAddress(node, entrancesByNode.get(node.id) ?? [], duplicateNodes.has(node.id)),
    );

    const average = scored.length
      ? Math.round(scored.reduce((sum, s) => sum + s.score, 0) / scored.length)
      : 0;

    const nodeNames: Record<string, string> = {};
    for (const node of nodes) nodeNames[node.id] = node.display_name;

    return {
      authorized: true as const,
      stale_days: QUALITY_STALE_DAYS,
      summary: {
        evaluated: scored.length,
        average_score: average,
        poor: scored.filter((s) => s.grade === "poor").length,
        excellent: scored.filter((s) => s.grade === "excellent").length,
      },
      incomplete: scored
        .filter((s) => s.score < 65)
        .sort((a, b) => a.score - b.score)
        .slice(0, 40),
      missing_coordinates: scored.filter((s) => !s.has_coordinates).slice(0, 40),
      stale: scored
        .filter((s) => s.stale_days == null || s.stale_days > QUALITY_STALE_DAYS)
        .sort((a, b) => (b.stale_days ?? 9999) - (a.stale_days ?? 9999))
        .slice(0, 40),
      duplicates: duplicates.map((d) => ({
        id: d.id,
        distance_meters: d.distance_meters,
        created_at: d.created_at,
        name_a: nodeNames[d.node_a] ?? "عقدة",
        name_b: nodeNames[d.node_b] ?? "عقدة",
      })),
      unverified_businesses: bizRes.data ?? [],
      reports: [
        ...(corrRes.data ?? []).map((r) => ({
          id: r.id,
          kind: "correction" as const,
          label: r.issue_type,
          details: r.details ?? r.smart_code,
          node_name: r.node_id ? (nodeNames[r.node_id] ?? null) : null,
          created_at: r.created_at,
        })),
        ...(routeRes.data ?? []).map((r) => ({
          id: r.id,
          kind: "route" as const,
          label: r.category,
          details: r.description,
          node_name: r.node_id ? (nodeNames[r.node_id] ?? null) : null,
          created_at: r.created_at,
        })),
      ].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    };
  });
