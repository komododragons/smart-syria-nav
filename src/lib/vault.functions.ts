import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Address Vault categories (Phase 13). */
export const VAULT_CATEGORIES = [
  "home",
  "work",
  "parents",
  "warehouse",
  "office",
  "other",
] as const;
export type VaultCategory = (typeof VAULT_CATEGORIES)[number];

export const VAULT_CATEGORY_META: Record<VaultCategory, { ar: string; emoji: string }> = {
  home: { ar: "المنزل", emoji: "🏠" },
  work: { ar: "العمل", emoji: "💼" },
  parents: { ar: "بيت الأهل", emoji: "👨‍👩‍👧" },
  warehouse: { ar: "المستودع", emoji: "🏭" },
  office: { ar: "المكتب", emoji: "🏢" },
  other: { ar: "أخرى", emoji: "📍" },
};

const categorySchema = z.enum(VAULT_CATEGORIES);

export const listVault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("favorites")
      .select(
        "id, label, category, note, sort_order, created_at, smart_address_id, smart_addresses(id, code, label, is_public, created_by, location_nodes(display_name, city, neighborhood, street, building_number, landmark))",
      )
      .eq("user_id", context.userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => {
      const smart = row.smart_addresses;
      const node = smart?.location_nodes;
      return {
        id: row.id,
        label: row.label,
        category: (row.category ?? "other") as VaultCategory,
        note: row.note,
        sort_order: row.sort_order ?? 0,
        created_at: row.created_at,
        smart_address_id: row.smart_address_id,
        code: smart?.code ?? null,
        is_public: smart?.is_public ?? false,
        owned: smart?.created_by === context.userId,
        place: node?.display_name ?? null,
        city: node?.city ?? null,
        neighborhood: node?.neighborhood ?? null,
        street: node?.street ?? null,
        building_number: node?.building_number ?? null,
        landmark: node?.landmark ?? null,
      };
    });
  });

export const saveToVault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().min(4).max(32),
        label: z.string().min(1).max(80),
        category: categorySchema.default("other"),
        note: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supa = context.supabase;
    const { normalizeCode } = await import("./smart-address");
    const code = normalizeCode(data.code);

    // RLS decides visibility: a private address is only selectable by its owner.
    const { data: smart } = await supa
      .from("smart_addresses")
      .select("id")
      .ilike("code", code)
      .maybeSingle();
    if (!smart) throw new Error("العنوان غير موجود أو غير متاح لك");

    const { data: existing } = await supa
      .from("favorites")
      .select("id")
      .eq("user_id", context.userId)
      .eq("smart_address_id", smart.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supa
        .from("favorites")
        .update({
          label: data.label.trim(),
          category: data.category,
          note: data.note?.trim() || null,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id, updated: true as const };
    }

    const { data: row, error } = await supa
      .from("favorites")
      .insert({
        user_id: context.userId,
        smart_address_id: smart.id,
        label: data.label.trim(),
        category: data.category,
        note: data.note?.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, updated: false as const };
  });

export const updateVaultEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        label: z.string().min(1).max(80).optional(),
        category: categorySchema.optional(),
        note: z.string().max(300).nullable().optional(),
        sort_order: z.number().int().min(0).max(999).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      label?: string;
      category?: string;
      note?: string | null;
      sort_order?: number;
    } = {};
    if (data.label !== undefined) patch['label'] = data.label.trim();
    if (data.category !== undefined) patch['category'] = data.category;
    if (data.note !== undefined) patch['note'] = data.note?.trim() || null;
    if (data.sort_order !== undefined) patch['sort_order'] = data.sort_order;
    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { error } = await context.supabase
      .from("favorites")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const removeVaultEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("favorites")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Share a vault entry as a temporary, field-limited link.
 * Only the owner of the underlying smart address may share its private details.
 */
export const shareFromVault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(async (input: unknown) => {
    const { SHARE_FIELDS } = await import("./addresses.functions");
    return z
      .object({
        entry_id: z.string().uuid(),
        purpose: z.string().min(2).max(40).default("parcel_delivery"),
        hours: z.number().int().min(1).max(8760).default(24),
        one_use: z.boolean().default(false),
        shared_fields: z.array(z.enum(SHARE_FIELDS)).min(1).max(9),
        contact_phone: z.string().max(32).optional(),
        contact_name: z.string().max(80).optional(),
      })
      .parse(input);
  })
  .handler(async ({ data, context }) => {
    const supa = context.supabase;
    const { data: entry, error: entryError } = await supa
      .from("favorites")
      .select("id, label, smart_address_id, smart_addresses(id, created_by)")
      .eq("id", data.entry_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (entryError) throw new Error(entryError.message);
    if (!entry?.smart_address_id) throw new Error("العنصر غير موجود في خزنتك");
    if (entry.smart_addresses?.created_by !== context.userId) {
      throw new Error("يمكن لمالك العنوان فقط إنشاء رابط مشاركة لتفاصيله");
    }

    const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    const token = `SY-TMP-${Array.from(
      { length: 5 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("")}`;
    const expires = new Date(Date.now() + data.hours * 3600_000).toISOString();
    const fields = data.shared_fields;

    const { data: row, error } = await supa
      .from("temporary_addresses")
      .insert({
        token,
        smart_address_id: entry.smart_address_id,
        purpose: data.purpose,
        expires_at: expires,
        max_uses: data.one_use ? 1 : null,
        created_by: context.userId,
        label: entry.label,
        shared_fields: fields,
        contact_phone: fields.includes("phone") ? data.contact_phone?.trim() || null : null,
        contact_name: fields.includes("name") ? data.contact_name?.trim() || null : null,
      })
      .select("token, expires_at, purpose, max_uses, shared_fields")
      .single();
    if (error) throw new Error(error.message);

    await supa.from("audit_logs").insert({
      actor_id: context.userId,
      action: "vault_address_shared",
      resource_type: "temporary_address",
      resource_id: token,
      metadata: { purpose: data.purpose, hours: data.hours, shared_fields: fields },
    });

    return row;
  });

export const listVaultShares = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ smart_address_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("temporary_addresses")
      .select("id, token, expires_at, revoked, use_count, max_uses, shared_fields, label, purpose")
      .eq("smart_address_id", data.smart_address_id)
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const revokeVaultShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("temporary_addresses")
      .update({ revoked: true })
      .eq("id", data.id)
      .eq("created_by", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
