import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Phase 23 — the user's own privacy switches.
 * These are hard limits: a share link can never carry a field the owner
 * turned off here, no matter what the caller sends.
 */
export type PrivacyPreferences = {
  allow_share_phone: boolean;
  allow_share_unit: boolean;
  allow_share_floor: boolean;
  allow_share_name: boolean;
  allow_share_instructions: boolean;
  allow_share_parking: boolean;
  default_share_hours: number;
  max_share_hours: number;
  require_expiry: boolean;
};

export const DEFAULT_PRIVACY: PrivacyPreferences = {
  allow_share_phone: false,
  allow_share_unit: false,
  allow_share_floor: true,
  allow_share_name: false,
  allow_share_instructions: true,
  allow_share_parking: true,
  default_share_hours: 24,
  max_share_hours: 168,
  require_expiry: true,
};

export const PRIVACY_LABELS_AR: Record<keyof PrivacyPreferences, string> = {
  allow_share_phone: "مشاركة رقم الهاتف",
  allow_share_unit: "مشاركة رقم الشقة/الوحدة",
  allow_share_floor: "مشاركة رقم الطابق",
  allow_share_name: "مشاركة اسم جهة الاتصال",
  allow_share_instructions: "مشاركة تعليمات الوصول الخاصة",
  allow_share_parking: "مشاركة معلومات الوقوف والتحميل",
  default_share_hours: "المدة الافتراضية للرابط (ساعات)",
  max_share_hours: "أقصى مدة مسموحة للرابط (ساعات)",
  require_expiry: "إلزام انتهاء صلاحية لكل رابط",
};

/** Maps a share field name to the preference that governs it. */
export const FIELD_GUARD: Record<string, keyof PrivacyPreferences | null> = {
  location: null,
  building: null,
  entrance: null,
  floor: "allow_share_floor",
  unit: "allow_share_unit",
  instructions: "allow_share_instructions",
  parking: "allow_share_parking",
  phone: "allow_share_phone",
  name: "allow_share_name",
};

type AnyClient = { from: (table: string) => any };

/** Reads the caller's preferences, falling back to the private-by-default set. */
export async function readPrivacy(client: AnyClient, userId: string): Promise<PrivacyPreferences> {
  const { data } = await client
    .from("privacy_preferences")
    .select(
      "allow_share_phone, allow_share_unit, allow_share_floor, allow_share_name, allow_share_instructions, allow_share_parking, default_share_hours, max_share_hours, require_expiry",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return { ...DEFAULT_PRIVACY, ...((data as Partial<PrivacyPreferences> | null) ?? {}) };
}

/** Drops any requested field the owner has switched off. */
export function filterSharedFields<T extends string>(fields: T[], prefs: PrivacyPreferences): T[] {
  return fields.filter((field) => {
    const guard = FIELD_GUARD[field];
    return guard ? prefs[guard] === true : true;
  });
}

/** Clamps a requested link lifetime to the owner's maximum. */
export function clampShareHours(hours: number | undefined, prefs: PrivacyPreferences): number {
  const requested = hours && hours > 0 ? hours : prefs.default_share_hours;
  return Math.min(requested, prefs.max_share_hours);
}

export const myPrivacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => readPrivacy(context.supabase, context.userId));

const updateSchema = z.object({
  allow_share_phone: z.boolean().optional(),
  allow_share_unit: z.boolean().optional(),
  allow_share_floor: z.boolean().optional(),
  allow_share_name: z.boolean().optional(),
  allow_share_instructions: z.boolean().optional(),
  allow_share_parking: z.boolean().optional(),
  default_share_hours: z.number().int().min(1).max(8760).optional(),
  max_share_hours: z.number().int().min(1).max(8760).optional(),
  require_expiry: z.boolean().optional(),
});

export const updatePrivacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const current = await readPrivacy(context.supabase, context.userId);
    const next: PrivacyPreferences = { ...current };
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) (next as Record<string, unknown>)[key] = value;
    }

    const { error } = await context.supabase
      .from("privacy_preferences")
      .upsert({ user_id: context.userId, ...next }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: "privacy_preferences_updated",
      resource_type: "privacy_preferences",
      resource_id: context.userId,
      metadata: data,
    });

    return next;
  });

/**
 * "Who saw my address" — every live share of the caller's own addresses,
 * with use counts. Aggregate only; no visitor identity is ever stored.
 */
export const mySharingActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = Date.now();

    const { data: temps } = await context.supabase
      .from("temporary_addresses")
      .select(
        "id, token, label, purpose, expires_at, revoked, use_count, max_uses, shared_fields, created_at, smart_addresses(code)",
      )
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: shares } = await context.supabase
      .from("route_shares")
      .select("id, token, share_type, expires_at, revoked, access_count, one_time, created_at")
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);

    const links = (temps ?? []).map((row: any) => {
      const expired = row.expires_at ? new Date(row.expires_at).getTime() < now : false;
      const used_up = row.max_uses !== null && row.use_count >= row.max_uses;
      return {
        id: row.id as string,
        kind: "address" as const,
        token: row.token as string,
        label: (row.label as string | null) ?? null,
        purpose: row.purpose as string,
        code: row.smart_addresses?.code ?? null,
        expires_at: row.expires_at as string | null,
        revoked: Boolean(row.revoked),
        expired,
        active: !row.revoked && !expired && !used_up,
        uses: (row.use_count as number) ?? 0,
        max_uses: (row.max_uses as number | null) ?? null,
        shared_fields: (row.shared_fields as string[]) ?? [],
        created_at: row.created_at as string,
      };
    });

    const routes = (shares ?? []).map((row: any) => {
      const expired = row.expires_at ? new Date(row.expires_at).getTime() < now : false;
      return {
        id: row.id as string,
        kind: "route" as const,
        token: row.token as string,
        label: null,
        purpose: row.share_type as string,
        code: null,
        expires_at: row.expires_at as string | null,
        revoked: Boolean(row.revoked),
        expired,
        active: !row.revoked && !expired,
        uses: (row.access_count as number) ?? 0,
        max_uses: row.one_time ? 1 : null,
        shared_fields: [] as string[],
        created_at: row.created_at as string,
      };
    });

    const all = [...links, ...routes].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return {
      links: all,
      active_count: all.filter((l) => l.active).length,
      total_uses: all.reduce((sum, l) => sum + l.uses, 0),
    };
  });

/** Revokes any share the caller owns, of either kind. */
export const revokeShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), kind: z.enum(["address", "route"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const table = data.kind === "address" ? "temporary_addresses" : "route_shares";
    const { error } = await context.supabase
      .from(table)
      .update({ revoked: true })
      .eq("id", data.id)
      .eq("created_by", context.userId);
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: "share_revoked",
      resource_type: table,
      resource_id: data.id,
      metadata: { kind: data.kind },
    });
    return { ok: true as const };
  });

/** Revokes every live share the caller owns — the panic switch. */
export const revokeAllShares = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("temporary_addresses")
      .update({ revoked: true })
      .eq("created_by", context.userId)
      .eq("revoked", false);
    await context.supabase
      .from("route_shares")
      .update({ revoked: true })
      .eq("created_by", context.userId)
      .eq("revoked", false);

    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: "all_shares_revoked",
      resource_type: "privacy",
      resource_id: context.userId,
      metadata: {},
    });
    return { ok: true as const };
  });
