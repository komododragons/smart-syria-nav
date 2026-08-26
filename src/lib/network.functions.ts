import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
type RoleName = "verifier" | "moderator" | "admin";

async function callerHasRole(supa: Client, userId: string, roles: RoleName[]): Promise<boolean> {
  for (const role of roles) {
    const { data } = await supa.rpc("has_role", { _user_id: userId, _role: role });
    if (data) return true;
  }
  return false;
}

type ConfidenceEventRow = {
  id: string;
  node_id: string | null;
  access_point_id: string | null;
  factor: string;
  delta: number;
  created_at: string;
};

// =============== 5. Verifier workflow ===============

export const verifierQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const allowed = await callerHasRole(context.supabase, context.userId, [
      "verifier",
      "moderator",
      "admin",
    ]);
    if (!allowed) return { authorized: false as const };

    const supa = context.supabase;
    const [nodesRes, apsRes] = await Promise.all([
      supa
        .from("location_nodes")
        .select(
          "id, node_type, display_name, neighborhood, city, governorate, verification_level, confidence_score, latitude, longitude, created_at",
        )
        .eq("is_active", true)
        .eq("visibility", "public")
        .in("verification_level", ["unverified", "user_confirmed"])
        .order("confidence_score", { ascending: true })
        .limit(30),
      supa
        .from("access_points")
        .select(
          "id, display_name, access_type, verification_level, confidence_score, latitude, longitude, location_nodes(display_name, city)",
        )
        .eq("is_active", true)
        .in("verification_level", ["unverified", "user_confirmed"])
        .order("confidence_score", { ascending: true })
        .limit(30),
    ]);

    return {
      authorized: true as const,
      nodes: nodesRes.data ?? [],
      access_points: (apsRes.data ?? []) as unknown as {
        id: string;
        display_name: string;
        access_type: string;
        verification_level: string;
        confidence_score: number;
        latitude: number | null;
        longitude: number | null;
        location_nodes: { display_name: string; city: string | null } | null;
      }[],
    };
  });

export const submitVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        node_id: z.string().uuid().nullable().default(null),
        access_point_id: z.string().uuid().nullable().default(null),
        level: z.enum([
          "user_confirmed",
          "community_confirmed",
          "courier_verified",
          "owner_verified",
          "officially_verified",
        ]),
        method: z.string().min(2).max(60).default("field_visit"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const allowed = await callerHasRole(context.supabase, context.userId, [
      "verifier",
      "moderator",
      "admin",
    ]);
    if (!allowed) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("record_verification", {
      // The SQL function accepts NULL targets; the generated types mark them required.
      _node_id: data.node_id as string,
      _access_point_id: data.access_point_id as string,
      _level: data.level,
      _method: data.method,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "verification_recorded",
      resource_type: data.access_point_id ? "access_point" : "location_node",
      resource_id: data.access_point_id ?? data.node_id ?? "",
      metadata: { level: data.level, method: data.method },
    });
    return { ok: true as const, id };
  });

// =============== 6. Duplicate detection ===============

export const detectDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const allowed = await callerHasRole(context.supabase, context.userId, ["moderator", "admin"]);
    if (!allowed) throw new Error("Forbidden");
    const { detectDuplicatePairs } = await import("./network.server");
    const result = await detectDuplicatePairs(context.supabase);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: "duplicate_scan",
      resource_type: "network",
      resource_id: "",
      metadata: { ...result },
    });
    return result;
  });

export const listDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const allowed = await callerHasRole(context.supabase, context.userId, ["moderator", "admin"]);
    if (!allowed) return { authorized: false as const, candidates: [], nodes: {} };

    const { data } = await context.supabase
      .from("duplicate_candidates")
      .select("id, distance_meters, status, created_at, node_a, node_b")
      .eq("status", "pending")
      .order("distance_meters", { ascending: true })
      .limit(30);

    const candidates = data ?? [];
    const ids = [...new Set(candidates.flatMap((c) => [c.node_a, c.node_b]))];
    let nodes: Record<
      string,
      { display_name: string; node_type: string; city: string | null; neighborhood: string | null }
    > = {};
    if (ids.length) {
      const { data: rows } = await context.supabase
        .from("location_nodes")
        .select("id, display_name, node_type, city, neighborhood")
        .in("id", ids);
      nodes = Object.fromEntries((rows ?? []).map((n) => [n.id, n]));
    }
    return { authorized: true as const, candidates, nodes };
  });

export const reviewDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["merge", "dismiss"]),
        keep: z.enum(["a", "b"]).default("a"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const allowed = await callerHasRole(context.supabase, context.userId, ["moderator", "admin"]);
    if (!allowed) throw new Error("Forbidden");

    const { data: candidate } = await context.supabase
      .from("duplicate_candidates")
      .select("id, node_a, node_b, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!candidate || candidate.status !== "pending") return { ok: false as const };

    if (data.action === "dismiss") {
      await context.supabase
        .from("duplicate_candidates")
        .update({ status: "dismissed" })
        .eq("id", data.id);
      return { ok: true as const, merged: false };
    }

    const keepId = data.keep === "a" ? candidate.node_a : candidate.node_b;
    const removeId = data.keep === "a" ? candidate.node_b : candidate.node_a;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { mergeDuplicateNodes } = await import("./network.server");
    const merge = await mergeDuplicateNodes(supabaseAdmin, keepId, removeId);
    await supabaseAdmin
      .from("duplicate_candidates")
      .update({ status: "merged" })
      .eq("id", data.id);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "duplicate_merged",
      resource_type: "location_node",
      resource_id: keepId,
      metadata: { removed: removeId, ...merge },
    });
    return { ok: true as const, merged: true, ...merge };
  });

// =============== 7. Favorites ===============

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ code: z.string().min(4).max(32), label: z.string().max(80).default("محفوظ") })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supa = context.supabase;
    const { normalizeCode } = await import("./smart-address");
    const code = normalizeCode(data.code);

    const { data: smart } = await supa
      .from("smart_addresses")
      .select("id")
      .ilike("code", code)
      .eq("is_public", true)
      .maybeSingle();
    if (!smart) throw new Error("العنوان غير موجود");

    const { data: existing } = await supa
      .from("favorites")
      .select("id")
      .eq("user_id", context.userId)
      .eq("smart_address_id", smart.id)
      .maybeSingle();

    if (existing) {
      await supa.from("favorites").delete().eq("id", existing.id);
      return { saved: false as const };
    }
    const { error } = await supa.from("favorites").insert({
      user_id: context.userId,
      smart_address_id: smart.id,
      label: data.label,
    });
    if (error) throw new Error(error.message);
    return { saved: true as const };
  });

export const listFavorites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("favorites")
      .select(
        "id, label, created_at, smart_addresses(code, label, location_nodes(display_name, neighborhood, city))",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// =============== 8. Developer API keys ===============

export const listApiClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: clients, error } = await context.supabase
      .from("api_clients")
      .select("id, name, environment, scopes, rate_limit_per_minute, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (clients ?? []).map((c) => c.id);
    let keys: {
      id: string;
      client_id: string;
      key_prefix: string;
      revoked: boolean;
      created_at: string;
    }[] = [];
    if (ids.length) {
      const { data } = await context.supabase
        .from("api_keys")
        .select("id, client_id, key_prefix, revoked, created_at")
        .in("client_id", ids)
        .order("created_at", { ascending: false });
      keys = data ?? [];
    }
    return { clients: clients ?? [], keys };
  });

export const createApiClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(2).max(80),
        environment: z.enum(["live", "test"]).default("live"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: client, error } = await context.supabase
      .from("api_clients")
      .insert({
        name: data.name,
        environment: data.environment,
        owner_id: context.userId,
        scopes: ["resolve"],
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: "api_client_created",
      resource_type: "api_client",
      resource_id: client.id,
      metadata: { name: data.name },
    });
    return client;
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ client_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Ownership check as the caller (RLS), privileged key insert after.
    const { data: client } = await context.supabase
      .from("api_clients")
      .select("id, environment")
      .eq("id", data.client_id)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!client) throw new Error("Forbidden");

    const { generateApiKey } = await import("./network.server");
    const generated = generateApiKey(client.environment);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("api_keys").insert({
      client_id: client.id,
      key_prefix: generated.prefix,
      key_hash: generated.hash,
    });
    if (error) throw new Error(error.message);
    // Full key returned once — only its hash is stored.
    return { key: generated.key, prefix: generated.prefix };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: keyRow } = await context.supabase
      .from("api_keys")
      .select("id, client_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!keyRow) throw new Error("Not found");
    const { data: client } = await context.supabase
      .from("api_clients")
      .select("id")
      .eq("id", keyRow.client_id)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!client) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("api_keys").update({ revoked: true }).eq("id", keyRow.id);
    return { ok: true as const };
  });

// =============== 9. Audit view ===============

export const auditTrail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().max(32).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const isAdmin = await callerHasRole(context.supabase, context.userId, ["admin"]);
    if (!isAdmin) return { authorized: false as const, logs: [], events: [] };

    const supa = context.supabase;
    const { data: logs } = await supa
      .from("audit_logs")
      .select("id, actor_id, action, resource_type, resource_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(60);

    let events: ConfidenceEventRow[] = [];
    const code = data.code?.trim();
    if (code) {
      const { normalizeCode } = await import("./smart-address");
      const { data: smart } = await supa
        .from("smart_addresses")
        .select("node_id, default_access_point_id")
        .ilike("code", normalizeCode(code))
        .maybeSingle();
      if (smart) {
        const { data: ev } = await supa
          .from("confidence_events")
          .select("id, node_id, access_point_id, factor, delta, created_at")
          .or(
            `node_id.eq.${smart.node_id}` +
              (smart.default_access_point_id
                ? `,access_point_id.eq.${smart.default_access_point_id}`
                : ""),
          )
          .order("created_at", { ascending: false })
          .limit(30);
        events = ev ?? [];
      }
    }

    return { authorized: true as const, logs: logs ?? [], events };
  });
