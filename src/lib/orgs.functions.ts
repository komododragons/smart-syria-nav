import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ORG_ROLES = {
  owner: "مالك",
  admin: "مدير",
  manager: "مسؤول مواقع",
  staff: "موظف",
  viewer: "مشاهد",
} as const;

export type OrgRole = keyof typeof ORG_ROLES;

const MANAGE_ROLES: OrgRole[] = ["owner", "admin", "manager"];
const ADMIN_ROLES: OrgRole[] = ["owner", "admin"];

type Supa = {
  rpc: (fn: "org_role", args: { _org: string; _user: string }) => PromiseLike<{ data: unknown }>;
};

async function orgRole(supa: Supa, org: string, user: string): Promise<OrgRole | null> {
  const { data } = await supa.rpc("org_role", { _org: org, _user: user });
  return (data as OrgRole | null) ?? null;
}

async function assertRole(supa: Supa, org: string, user: string, allowed: OrgRole[]) {
  const role = await orgRole(supa, org, user);
  if (!role || !allowed.includes(role)) throw new Error("forbidden");
  return role;
}

/** Lightweight usage signal for the business analytics tab. No personal data stored. */
export const logAddressEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().min(4).max(32),
        event: z.enum(["resolve", "navigate_start", "delivery_view", "qr_scan", "plate_print"]),
        source: z.string().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.toUpperCase();
    await supabaseAdmin.from("address_events").insert({
      smart_code: code,
      event_type: data.event,
      source: data.source ?? null,
    });

    // Fan the event out to developer webhook subscriptions (public data only).
    const WEBHOOK_FOR = {
      resolve: "address.resolved",
      navigate_start: "address.navigation_started",
      delivery_view: "address.delivery_viewed",
      qr_scan: "address.qr_scanned",
    } as const;
    const webhookEvent = WEBHOOK_FOR[data.event as keyof typeof WEBHOOK_FOR];
    if (webhookEvent) {
      const { dispatchWebhooks } = await import("./api-v1.server");
      await dispatchWebhooks(webhookEvent, { code, source: data.source ?? null });
    }
    return { ok: true as const };
  });

export const myOrganizations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("organization_members")
      .select(
        "role, organizations(id, name_ar, name_en, logo_url, website, contact_phone, contact_email, created_at)",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    type Org = {
      id: string;
      name_ar: string;
      name_en: string | null;
      logo_url: string | null;
      website: string | null;
      contact_phone: string | null;
      contact_email: string | null;
      created_at: string;
    };
    const rows: { role: OrgRole; organization: Org }[] = [];
    for (const row of data ?? []) {
      const org = (Array.isArray(row.organizations) ? row.organizations[0] : row.organizations) as
        | Org
        | undefined
        | null;
      if (org) rows.push({ role: row.role as OrgRole, organization: org });
    }
    return rows;
  });

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name_ar: z.string().min(2).max(160),
        name_en: z.string().max(160).nullable().optional(),
        website: z.string().max(200).nullable().optional(),
        contact_phone: z.string().max(40).nullable().optional(),
        contact_email: z.string().max(160).nullable().optional(),
        logo_url: z.string().max(400).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: org, error } = await context.supabase
      .from("organizations")
      .insert({
        name_ar: data.name_ar,
        name_en: data.name_en ?? null,
        website: data.website ?? null,
        contact_phone: data.contact_phone ?? null,
        contact_email: data.contact_email ?? null,
        logo_url: data.logo_url ?? null,
        owner_id: context.userId,
      })
      .select("id, name_ar")
      .single();
    if (error) throw new Error(error.message);
    return { id: org.id };
  });

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        name_ar: z.string().min(2).max(160),
        name_en: z.string().max(160).nullable().optional(),
        website: z.string().max(200).nullable().optional(),
        contact_phone: z.string().max(40).nullable().optional(),
        contact_email: z.string().max(160).nullable().optional(),
        logo_url: z.string().max(400).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, data.organization_id, context.userId, ADMIN_ROLES);
    const { error } = await context.supabase
      .from("organizations")
      .update({
        name_ar: data.name_ar,
        name_en: data.name_en ?? null,
        website: data.website ?? null,
        contact_phone: data.contact_phone ?? null,
        contact_email: data.contact_email ?? null,
        logo_url: data.logo_url ?? null,
      })
      .eq("id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const orgLocations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        include_archived: z.boolean().default(false),
        search: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const role = await assertRole(context.supabase, data.organization_id, context.userId, [
      ...MANAGE_ROLES,
      "staff",
      "viewer",
    ]);
    let query = context.supabase
      .from("businesses")
      .select(
        "id, name_ar, name_en, branch_label, category, place_category, phone, website, opening_hours, logo_url, verification_level, is_published, is_archived, node_id, smart_address_id, visitor_access_point_id, created_at, smart_addresses(code), location_nodes(id, display_name, governorate, city, district, neighborhood, street, landmark, building_number, latitude, longitude, confidence_score, verification_level, last_verified_at)",
      )
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (!data.include_archived) query = query.eq("is_archived", false);
    if (data.search?.trim()) query = query.ilike("name_ar", `%${data.search.trim()}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return {
      role,
      locations: (rows ?? []).map((row) => ({
        ...row,
        smart_code:
          (Array.isArray(row.smart_addresses) ? row.smart_addresses[0] : row.smart_addresses)?.code ?? null,
        node: Array.isArray(row.location_nodes) ? row.location_nodes[0] : row.location_nodes,
      })),
    };
  });

const locationSchema = z.object({
  organization_id: z.string().uuid(),
  name_ar: z.string().min(2).max(160),
  name_en: z.string().max(160).nullable().optional(),
  branch_label: z.string().max(120).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  place_category: z.string().max(40).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  website: z.string().max(200).nullable().optional(),
  opening_hours: z.string().max(200).nullable().optional(),
  logo_url: z.string().max(400).nullable().optional(),
  governorate: z.string().min(2).max(80),
  governorate_code: z.string().min(2).max(4),
  city: z.string().max(80).nullable().optional(),
  district: z.string().max(80).nullable().optional(),
  neighborhood: z.string().max(120).nullable().optional(),
  street: z.string().max(160).nullable().optional(),
  landmark: z.string().max(160).nullable().optional(),
  building_number: z.string().max(40).nullable().optional(),
  parking_info: z.string().max(300).nullable().optional(),
  loading_info: z.string().max(300).nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  entrance_name: z.string().max(160).nullable().optional(),
  entrance_instructions: z.string().max(500).nullable().optional(),
  is_published: z.boolean().default(true),
});

export const createOrgLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => locationSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, data.organization_id, context.userId, MANAGE_ROLES);
    const { generateSmartCode } = await import("./addresses.server");
    const supa = context.supabase;

    const { data: node, error: nodeErr } = await supa
      .from("location_nodes")
      .insert({
        node_type: "building",
        display_name: data.branch_label ? `${data.name_ar} — ${data.branch_label}` : data.name_ar,
        name_ar: data.name_ar,
        name_en: data.name_en ?? null,
        latitude: data.latitude,
        longitude: data.longitude,
        governorate: data.governorate,
        city: data.city ?? null,
        district: data.district ?? null,
        neighborhood: data.neighborhood ?? null,
        street: data.street ?? null,
        landmark: data.landmark ?? null,
        building_number: data.building_number ?? null,
        parking_info: data.parking_info ?? null,
        loading_info: data.loading_info ?? null,
        visibility: "public",
        verification_level: "user_confirmed",
        confidence_score: 60,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (nodeErr) throw new Error(nodeErr.message);

    let accessPointId: string | null = null;
    if (data.entrance_name || data.entrance_instructions) {
      const { data: ap, error: apErr } = await supa
        .from("access_points")
        .insert({
          node_id: node.id,
          access_type: "main_entrance",
          display_name: data.entrance_name || "المدخل الرئيسي",
          name_ar: data.entrance_name || "المدخل الرئيسي",
          latitude: data.latitude,
          longitude: data.longitude,
          instructions_ar: data.entrance_instructions ?? null,
          accessibility: [],
          always_open: true,
          verification_level: "user_confirmed",
          confidence_score: 60,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (apErr) throw new Error(apErr.message);
      accessPointId = ap.id;
    }

    const code = await generateSmartCode(supa, data.governorate_code);
    const { data: smart, error: codeErr } = await supa
      .from("smart_addresses")
      .insert({
        code,
        node_id: node.id,
        default_access_point_id: accessPointId,
        label: data.branch_label ?? data.name_ar,
        is_public: true,
        created_by: context.userId,
      })
      .select("id, code")
      .single();
    if (codeErr) throw new Error(codeErr.message);

    const { data: biz, error: bizErr } = await supa
      .from("businesses")
      .insert({
        organization_id: data.organization_id,
        name_ar: data.name_ar,
        name_en: data.name_en ?? null,
        branch_label: data.branch_label ?? null,
        category: data.category ?? null,
        place_category: data.place_category ?? null,
        phone: data.phone ?? null,
        website: data.website ?? null,
        opening_hours: data.opening_hours ?? null,
        logo_url: data.logo_url ?? null,
        node_id: node.id,
        smart_address_id: smart.id,
        visitor_access_point_id: accessPointId,
        delivery_access_point_id: accessPointId,
        owner_id: context.userId,
        is_published: data.is_published,
      })
      .select("id")
      .single();
    if (bizErr) throw new Error(bizErr.message);

    await supa.from("audit_logs").insert({
      actor_id: context.userId,
      action: "org_location_created",
      resource_type: "business",
      resource_id: biz.id,
      metadata: { organization_id: data.organization_id, code: smart.code },
    });

    return { business_id: biz.id, code: smart.code };
  });

export const updateOrgLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    locationSchema
      .partial({ governorate_code: true })
      .extend({ business_id: z.string().uuid(), node_id: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, data.organization_id, context.userId, MANAGE_ROLES);
    const supa = context.supabase;

    const { error: bizErr } = await supa
      .from("businesses")
      .update({
        name_ar: data.name_ar,
        name_en: data.name_en ?? null,
        branch_label: data.branch_label ?? null,
        category: data.category ?? null,
        place_category: data.place_category ?? null,
        phone: data.phone ?? null,
        website: data.website ?? null,
        opening_hours: data.opening_hours ?? null,
        logo_url: data.logo_url ?? null,
        is_published: data.is_published,
      })
      .eq("id", data.business_id)
      .eq("organization_id", data.organization_id);
    if (bizErr) throw new Error(bizErr.message);

    const { error: nodeErr } = await supa
      .from("location_nodes")
      .update({
        display_name: data.branch_label ? `${data.name_ar} — ${data.branch_label}` : data.name_ar,
        name_ar: data.name_ar,
        name_en: data.name_en ?? null,
        latitude: data.latitude,
        longitude: data.longitude,
        governorate: data.governorate,
        city: data.city ?? null,
        district: data.district ?? null,
        neighborhood: data.neighborhood ?? null,
        street: data.street ?? null,
        landmark: data.landmark ?? null,
        building_number: data.building_number ?? null,
        parking_info: data.parking_info ?? null,
        loading_info: data.loading_info ?? null,
      })
      .eq("id", data.node_id);
    if (nodeErr) throw new Error(nodeErr.message);

    await supa.from("audit_logs").insert({
      actor_id: context.userId,
      action: "org_location_updated",
      resource_type: "business",
      resource_id: data.business_id,
      metadata: { organization_id: data.organization_id },
    });
    return { ok: true as const };
  });

export const setLocationArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        business_id: z.string().uuid(),
        archived: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, data.organization_id, context.userId, MANAGE_ROLES);
    const { error } = await context.supabase
      .from("businesses")
      .update({ is_archived: data.archived, is_published: data.archived ? false : true })
      .eq("id", data.business_id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: data.archived ? "org_location_archived" : "org_location_restored",
      resource_type: "business",
      resource_id: data.business_id,
      metadata: { organization_id: data.organization_id },
    });
    return { ok: true as const };
  });

/** Attach an already-existing business record (e.g. an approved claim) to the company. */
export const attachBusinessToOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organization_id: z.string().uuid(), business_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, data.organization_id, context.userId, ADMIN_ROLES);
    const { data: row, error } = await context.supabase
      .from("businesses")
      .update({ organization_id: data.organization_id })
      .eq("id", data.business_id)
      .eq("owner_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("not_owner_of_business");
    return { ok: true as const };
  });

/** Businesses this user personally owns that are not yet attached to a company. */
export const myUnattachedBusinesses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("businesses")
      .select("id, name_ar, branch_label, smart_addresses(code)")
      .eq("owner_id", context.userId)
      .is("organization_id", null)
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      name_ar: row.name_ar,
      branch_label: row.branch_label,
      code: (Array.isArray(row.smart_addresses) ? row.smart_addresses[0] : row.smart_addresses)?.code ?? null,
    }));
  });

export const orgMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ organization_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const role = await assertRole(context.supabase, data.organization_id, context.userId, [
      ...MANAGE_ROLES,
      "staff",
      "viewer",
    ]);
    const { data: rows, error } = await context.supabase
      .from("organization_members")
      .select("id, user_id, role, created_at")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const members = await Promise.all(
      (rows ?? []).map(async (row) => {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
        return { ...row, email: u?.user?.email ?? null };
      }),
    );
    return { role, members };
  });

export const addOrgMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        email: z.string().email().max(160),
        role: z.enum(["admin", "manager", "staff", "viewer"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, data.organization_id, context.userId, ADMIN_ROLES);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();
    let found: string | null = null;
    for (let page = 1; page <= 5 && !found; page += 1) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      const users = list?.users ?? [];
      found = users.find((u) => (u.email ?? "").toLowerCase() === email)?.id ?? null;
      if (users.length < 200) break;
    }
    if (!found) throw new Error("user_not_registered");

    const { error } = await context.supabase
      .from("organization_members")
      .insert({ organization_id: data.organization_id, user_id: found, role: data.role });
    if (error) throw new Error(error.message.includes("duplicate") ? "already_member" : error.message);

    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: "org_member_added",
      resource_type: "organization",
      resource_id: data.organization_id,
      metadata: { role: data.role },
    });
    return { ok: true as const };
  });

export const updateOrgMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        member_id: z.string().uuid(),
        role: z.enum(["admin", "manager", "staff", "viewer"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, data.organization_id, context.userId, ADMIN_ROLES);
    const { error } = await context.supabase
      .from("organization_members")
      .update({ role: data.role })
      .eq("id", data.member_id)
      .eq("organization_id", data.organization_id)
      .neq("role", "owner");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const removeOrgMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organization_id: z.string().uuid(), member_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, data.organization_id, context.userId, ADMIN_ROLES);
    const { error } = await context.supabase
      .from("organization_members")
      .delete()
      .eq("id", data.member_id)
      .eq("organization_id", data.organization_id)
      .neq("role", "owner");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const orgAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ organization_id: z.string().uuid(), days: z.number().int().min(1).max(180).default(30) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, data.organization_id, context.userId, [
      ...MANAGE_ROLES,
      "staff",
      "viewer",
    ]);

    const { data: rows, error } = await context.supabase
      .from("businesses")
      .select("id, name_ar, branch_label, smart_addresses(code)")
      .eq("organization_id", data.organization_id)
      .limit(500);
    if (error) throw new Error(error.message);

    const byCode = new Map<string, { name: string; code: string }>();
    for (const row of rows ?? []) {
      const code = (Array.isArray(row.smart_addresses) ? row.smart_addresses[0] : row.smart_addresses)?.code;
      if (code) byCode.set(code, { name: row.branch_label ? `${row.name_ar} — ${row.branch_label}` : row.name_ar, code });
    }
    const codes = [...byCode.keys()];
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();

    const totals = { resolve: 0, navigate_start: 0, delivery_view: 0, qr_scan: 0, plate_print: 0 };
    const perLocation = new Map<string, { name: string; code: string; resolve: number; navigate_start: number }>();
    if (codes.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: events } = await supabaseAdmin
        .from("address_events")
        .select("smart_code, event_type")
        .in("smart_code", codes)
        .gte("created_at", since)
        .limit(20000);
      for (const ev of events ?? []) {
        const type = ev.event_type as keyof typeof totals;
        if (type in totals) totals[type] += 1;
        const meta = byCode.get(ev.smart_code);
        if (!meta) continue;
        const entry =
          perLocation.get(ev.smart_code) ??
          { name: meta.name, code: meta.code, resolve: 0, navigate_start: 0 };
        if (type === "resolve") entry.resolve += 1;
        if (type === "navigate_start") entry.navigate_start += 1;
        perLocation.set(ev.smart_code, entry);
      }
    }

    return {
      days: data.days,
      locations_count: codes.length,
      totals,
      per_location: [...perLocation.values()].sort(
        (a, b) => b.resolve + b.navigate_start - (a.resolve + a.navigate_start),
      ),
    };
  });
