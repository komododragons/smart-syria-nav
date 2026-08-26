/**
 * Server-only helpers for verifier workflow, duplicate detection/merge,
 * developer API keys and audit views. Never imported by components.
 */
import { createHash, randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { haversineMeters } from "./addresses.server";

type AdminClient = SupabaseClient<Database>;

// ---------- API keys ----------

export function generateApiKey(environment: string): { key: string; prefix: string; hash: string } {
  const key = `san_${environment === "live" ? "live" : "test"}_${randomBytes(24).toString("base64url")}`;
  return { key, prefix: key.slice(0, 16), hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Resolve a raw API key to its active api_client id, or null when the key is
 * unknown, revoked, or its client is inactive.
 */
export async function verifyApiKey(supa: AdminClient, rawKey: string): Promise<string | null> {
  if (!rawKey.startsWith("san_")) return null;
  const { data: keyRow } = await supa
    .from("api_keys")
    .select("client_id")
    .eq("key_hash", hashApiKey(rawKey))
    .eq("revoked", false)
    .maybeSingle();
  if (!keyRow) return null;
  const { data: clientRow } = await supa
    .from("api_clients")
    .select("id")
    .eq("id", keyRow.client_id)
    .eq("is_active", true)
    .maybeSingle();
  return clientRow?.id ?? null;
}

// ---------- Duplicate detection ----------

const DUPLICATE_RADIUS_M = 30;
const DUPLICATE_NODE_TYPES = ["property", "building", "warehouse", "farm", "factory", "hospital", "school", "hotel"];

export async function detectDuplicatePairs(supa: AdminClient): Promise<{ inserted: number; scanned: number }> {
  const { data: nodes } = await supa
    .from("location_nodes")
    .select("id, node_type, display_name, latitude, longitude")
    .eq("is_active", true)
    .in("node_type", DUPLICATE_NODE_TYPES)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .limit(800);

  const list = (nodes ?? []) as {
    id: string;
    node_type: string;
    latitude: number;
    longitude: number;
  }[];

  const { data: existing } = await supa.from("duplicate_candidates").select("node_a, node_b").limit(2000);
  const known = new Set(
    (existing ?? []).flatMap((r) => [`${r.node_a}:${r.node_b}`, `${r.node_b}:${r.node_a}`]),
  );

  const rows: { node_a: string; node_b: string; distance_meters: number }[] = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i]!;
      const b = list[j]!;
      if (a.node_type !== b.node_type) continue;
      if (known.has(`${a.id}:${b.id}`)) continue;
      const d = haversineMeters(
        { lat: a.latitude, lng: a.longitude },
        { lat: b.latitude, lng: b.longitude },
      );
      if (d <= DUPLICATE_RADIUS_M) {
        rows.push({ node_a: a.id, node_b: b.id, distance_meters: Math.round(d * 10) / 10 });
        known.add(`${a.id}:${b.id}`);
      }
    }
  }

  if (rows.length) {
    const { error } = await supa.from("duplicate_candidates").insert(rows);
    if (error) throw new Error(error.message);
  }
  return { inserted: rows.length, scanned: list.length };
}

/** Merges duplicate node `removeId` into `keepId`: moves children, entrances,
 * businesses, retires its smart codes with redirects, then deactivates it. */
export async function mergeDuplicateNodes(
  supa: AdminClient,
  keepId: string,
  removeId: string,
): Promise<{ redirected_codes: number }> {
  const { data: keepCodes } = await supa
    .from("smart_addresses")
    .select("code")
    .eq("node_id", keepId)
    .eq("status", "active")
    .limit(1);
  const targetCode = keepCodes?.[0]?.code ?? null;

  await supa.from("location_nodes").update({ parent_id: keepId }).eq("parent_id", removeId);
  await supa.from("access_points").update({ node_id: keepId }).eq("node_id", removeId);
  await supa.from("businesses").update({ node_id: keepId }).eq("node_id", removeId);

  const { data: removedCodes } = await supa
    .from("smart_addresses")
    .select("id, code")
    .eq("node_id", removeId);

  let redirected = 0;
  for (const row of removedCodes ?? []) {
    await supa.from("smart_addresses").update({ status: "merged" }).eq("id", row.id);
    if (targetCode) {
      await supa.from("smart_address_redirects").insert({
        old_code: row.code,
        new_code: targetCode,
        reason: "duplicate_merge",
      });
      redirected += 1;
    }
  }

  await supa
    .from("location_nodes")
    .update({ is_active: false, lifecycle_status: "merged" })
    .eq("id", removeId);

  return { redirected_codes: redirected };
}
