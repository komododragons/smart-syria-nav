/**
 * Plan + entitlement server functions (Phase 22). No pricing anywhere: these
 * expose which plan an account is on, what it unlocks, and how much of each
 * limit is used. Billing can be layered on later without touching callers.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  entitlementsEnforced,
  organizationPlan,
  pricingPublished,
  resolvedPlan,
  strongerPlan,
  userPlan,
} from "./plans.server";
import { PLANS, type PlanId } from "./plans";

/** The signed-in user's effective plan, entitlements and usage against limits. */
export const myEntitlements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organization_id: z.string().uuid().nullish() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const supa = context.supabase;
    const personal = await userPlan(supa, context.userId);
    let organization = null as Awaited<ReturnType<typeof organizationPlan>> | null;
    if (data.organization_id) organization = await organizationPlan(supa, data.organization_id);

    const plan: PlanId = organization
      ? strongerPlan(resolvedPlan(personal), resolvedPlan(organization))
      : resolvedPlan(personal);

    // Usage counters, all scoped by RLS to what the caller may already see.
    const countOf = async (table: string, build: (q: any) => any) => {
      const { count } = await build((supa.from as any)(table).select("id", { count: "exact", head: true }));
      return count ?? 0;
    };

    const [locations, teamMembers, apiKeys, webhooks] = await Promise.all([
      data.organization_id
        ? countOf("businesses", (q: any) =>
            q.eq("organization_id", data.organization_id).eq("is_archived", false),
          )
        : countOf("location_nodes", (q: any) => q.eq("created_by", context.userId).eq("is_active", true)),
      data.organization_id
        ? countOf("organization_members", (q: any) => q.eq("organization_id", data.organization_id))
        : Promise.resolve(1),
      countOf("api_clients", (q: any) => q.eq("owner_id", context.userId).eq("is_active", true)),
      countOf("api_webhooks", (q: any) => q.eq("is_active", true)),
    ]);

    return {
      plan,
      definition: PLANS[plan],
      personal: { ...personal, effective: resolvedPlan(personal) },
      organization: organization ? { ...organization, effective: resolvedPlan(organization) } : null,
      usage: {
        locations,
        team_members: teamMembers,
        api_keys: apiKeys,
        webhooks,
      },
      // platform_settings is admin-read-only, so read the flags server-side.
      enforced: await entitlementsEnforced(settingsClient as never),
      pricing_published: await pricingPublished(settingsClient as never),
    };
  });

async function assertAdmin(supa: any, userId: string) {
  const { data } = await supa.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

/** Admin view of every assigned plan plus the enforcement switch. */
export const planAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { authorized: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plans } = await supabaseAdmin
      .from("account_plans")
      .select(
        "id, subject_type, user_id, organization_id, plan, status, source, started_at, expires_at, notes, updated_at, organizations(name_ar)",
      )
      .order("updated_at", { ascending: false })
      .limit(200);

    const { data: orgs } = await supabaseAdmin
      .from("organizations")
      .select("id, name_ar")
      .order("created_at", { ascending: false })
      .limit(200);

    const counts: Record<string, number> = { free: 0, business: 0, developer: 0, enterprise: 0 };
    for (const row of plans ?? []) counts[row.plan] = (counts[row.plan] ?? 0) + 1;

    return {
      authorized: true as const,
      plans: plans ?? [],
      organizations: orgs ?? [],
      counts,
      enforced: await entitlementsEnforced(supabaseAdmin as never),
      pricing_published: await pricingPublished(supabaseAdmin as never),
    };
  });

/** Assign or update the plan of a user or an organization (admins only). */
export const setAccountPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject_type: z.enum(["user", "organization"]),
        subject_id: z.string().uuid(),
        plan: z.enum(["free", "business", "developer", "enterprise"]),
        status: z.enum(["active", "trialing", "past_due", "canceled"]).default("active"),
        source: z.enum(["manual", "grant", "self_serve", "partner"]).default("manual"),
        expires_at: z.string().nullish(),
        notes: z.string().max(500).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const row = {
      subject_type: data.subject_type,
      user_id: data.subject_type === "user" ? data.subject_id : null,
      organization_id: data.subject_type === "organization" ? data.subject_id : null,
      plan: data.plan,
      status: data.status,
      source: data.source,
      expires_at: data.expires_at ?? null,
      notes: data.notes ?? null,
      updated_by: context.userId,
    };

    const { error } = await supabaseAdmin
      .from("account_plans")
      .upsert(row, {
        onConflict: data.subject_type === "user" ? "user_id" : "organization_id",
      });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "plan_assigned",
      resource_type: data.subject_type === "user" ? "user" : "organization",
      resource_id: data.subject_id,
      metadata: { plan: data.plan, status: data.status, source: data.source },
    });

    return { ok: true as const };
  });

/** Flip entitlement enforcement / pricing visibility (admins only). */
export const setEntitlementSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ enforced: z.boolean().optional(), pricing_published: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "entitlements")
      .maybeSingle();
    const value = {
      ...((current?.value as Record<string, unknown> | null) ?? {}),
      ...(data.enforced === undefined ? {} : { enforced: data.enforced }),
      ...(data.pricing_published === undefined ? {} : { pricing_published: data.pricing_published }),
    };

    const { error } = await supabaseAdmin
      .from("platform_settings")
      .upsert({ key: "entitlements", value, updated_by: context.userId }, { onConflict: "key" });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "entitlement_settings_updated",
      resource_type: "platform_settings",
      resource_id: "entitlements",
      metadata: value,
    });

    return { ok: true as const, value };
  });
