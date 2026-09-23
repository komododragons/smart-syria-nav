import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RESIDENTIAL_NODE_TYPES } from "./place-categories";

const sectionSchema = z.enum([
  "overview", "addresses", "businesses", "verification", "claims", "corrections",
  "reports", "imports", "api", "organizations", "users", "security", "analytics", "health",
]);

const filterSchema = z.object({
  section: sectionSchema.default("overview"),
  governorate: z.string().max(80).default(""),
  city: z.string().max(80).default(""),
  verification: z.string().max(50).default(""),
  category: z.string().max(80).default(""),
  status: z.string().max(50).default(""),
  from: z.string().max(10).default(""),
  to: z.string().max(10).default(""),
});

export async function callerIsAdministrator(supa: any, userId: string) {
  const { data } = await supa.rpc("has_role", { _user_id: userId, _role: "admin" });
  return Boolean(data);
}

export const reviewCommercialAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ review_id: z.string().uuid(), decision: z.enum(["dismissed", "conversion_requested"]), note: z.string().max(1000).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await callerIsAdministrator(context.supabase, context.userId))) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("commercial_address_reviews").update({ status: data.decision, decision_note: data.note ?? null, reviewed_by: context.userId, reviewed_at: new Date().toISOString() }).eq("id", data.review_id).select("smart_address_id").single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "commercial_address_reviewed", resource_type: "smart_address", resource_id: row.smart_address_id, metadata: { decision: data.decision } });
    return { ok: true as const };
  });

function dates(query: any, filters: z.infer<typeof filterSchema>) {
  let next = query;
  if (filters.from) next = next.gte("created_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to) next = next.lte("created_at", `${filters.to}T23:59:59.999Z`);
  return next;
}

export const adminControlCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filterSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    if (!(await callerIsAdministrator(context.supabase, context.userId))) return { authorized: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const count = async (table: string, apply: (q: any) => any = (q) => q) => {
      const result = await apply(db.from(table).select("*", { count: "exact", head: true }));
      return result.count ?? 0;
    };

    const [addresses, businesses, pendingVerification, pendingClaims, pendingCorrections, openReports, runningImports, apiRequests, organizations, users] = await Promise.all([
      count("smart_addresses"),
      count("businesses", (q) => q.eq("is_archived", false)),
      count("location_nodes", (q) => q.in("verification_level", ["unverified", "user_confirmed"]).eq("is_active", true)),
      count("business_claims", (q) => q.eq("status", "pending")),
      count("correction_reports", (q) => q.eq("status", "pending")),
      count("route_reports", (q) => q.in("status", ["open", "reviewing"])),
      count("imports", (q) => q.in("status", ["pending", "processing"])),
      count("api_usage", (q) => q.gte("created_at", new Date(Date.now() - 86_400_000).toISOString())),
      count("organizations"),
      count("profiles"),
    ]);

    let rows: any[] = [];
    switch (data.section) {
      case "addresses": {
        if (data.status === "commercial_review") {
          const reviewResult = await db.from("commercial_address_reviews").select("id, smart_address_id, reasons, score, status, owner_response, reviewed_at, created_at, smart_addresses(code, address_classification, location_nodes(display_name, governorate, city))").in("status", ["open", "owner_confirmed_private", "conversion_requested"]).order("score", { ascending: false }).limit(100);
          rows = reviewResult.data ?? [];
          break;
        }
        let q = db.from("smart_addresses").select("id, code, status, is_public, address_classification, classification_status, created_at, location_nodes(display_name, node_type, governorate, city, verification_level, place_category)").order("created_at", { ascending: false }).limit(100);
        q = dates(q, data);
        if (data.status) q = q.eq("status", data.status);
        const result = await q;
        rows = (result.data ?? []).filter((row: any) => {
          const node = Array.isArray(row.location_nodes) ? row.location_nodes[0] : row.location_nodes;
          return (!data.governorate || node?.governorate === data.governorate) && (!data.city || node?.city === data.city) && (!data.verification || node?.verification_level === data.verification) && (!data.category || node?.place_category === data.category);
        });
        break;
      }
      case "businesses": {
        let q = db.from("businesses").select("id, name_ar, name_en, category, place_category, verification_level, is_published, is_archived, created_at, location_nodes(governorate, city)").order("created_at", { ascending: false }).limit(100);
        q = dates(q, data);
        if (data.verification) q = q.eq("verification_level", data.verification);
        if (data.category) q = q.eq("place_category", data.category);
        if (data.status === "published") q = q.eq("is_published", true).eq("is_archived", false);
        if (data.status === "archived") q = q.eq("is_archived", true);
        const result = await q;
        rows = (result.data ?? []).filter((row: any) => {
          const node = Array.isArray(row.location_nodes) ? row.location_nodes[0] : row.location_nodes;
          return (!data.governorate || node?.governorate === data.governorate) && (!data.city || node?.city === data.city);
        });
        break;
      }
      case "verification": {
        let q = db.from("location_nodes").select("id, display_name, node_type, governorate, city, verification_level, confidence_score, created_at").eq("is_active", true).order("created_at", { ascending: false }).limit(100);
        q = dates(q, data);
        if (data.governorate) q = q.eq("governorate", data.governorate);
        if (data.city) q = q.eq("city", data.city);
        if (data.verification) q = q.eq("verification_level", data.verification);
        else q = q.in("verification_level", ["unverified", "user_confirmed"]);
        rows = (await q).data ?? [];
        break;
      }
      case "claims": case "corrections": case "reports": case "imports": {
        const config = {
          claims: ["business_claims", "id, status, claimant_name, claimant_role, claim_method, created_at, businesses(name_ar)"],
          corrections: ["correction_reports", "id, status, issue_type, smart_code, target_field, created_at"],
          reports: ["route_reports", "id, status, category, description, created_at, resolved_at"],
          imports: ["imports", "id, filename, source, status, total_rows, success_rows, error_rows, created_at, organizations(name_ar)"],
        }[data.section] as [string, string];
        let q = db.from(config[0]).select(config[1]).order("created_at", { ascending: false }).limit(100);
        q = dates(q, data);
        if (data.status) q = q.eq("status", data.status);
        rows = (await q).data ?? [];
        break;
      }
      case "api": {
        let q = db.from("api_usage").select("id, endpoint, method, status_code, response_ms, scope, created_at, api_clients(name, environment)").order("created_at", { ascending: false }).limit(100);
        q = dates(q, data);
        if (data.status === "success") q = q.lt("status_code", 400);
        if (data.status === "error") q = q.gte("status_code", 400);
        rows = (await q).data ?? [];
        break;
      }
      case "organizations": {
        let q = db.from("organizations").select("id, name_ar, name_en, contact_email, created_at, organization_members(count)").order("created_at", { ascending: false }).limit(100);
        q = dates(q, data);
        rows = (await q).data ?? [];
        break;
      }
      case "users": {
        let q = db.from("profiles").select("id, full_name, preferred_language, created_at, user_roles(role)").order("created_at", { ascending: false }).limit(100);
        q = dates(q, data);
        rows = (await q).data ?? [];
        break;
      }
      case "security": {
        let q = db.from("audit_logs").select("id, actor_id, action, resource_type, resource_id, created_at").order("created_at", { ascending: false }).limit(100);
        q = dates(q, data);
        rows = (await q).data ?? [];
        break;
      }
      case "analytics": {
        const since = data.from ? `${data.from}T00:00:00.000Z` : new Date(Date.now() - 30 * 86_400_000).toISOString();
        rows = (await db.from("address_events").select("event_type, created_at").gte("created_at", since).limit(5000)).data ?? [];
        break;
      }
      case "health": {
        const since = new Date(Date.now() - 86_400_000).toISOString();
        const [apiErrors, failedImports, providerFailures, latestAudit] = await Promise.all([
          count("api_usage", (q) => q.gte("created_at", since).gte("status_code", 500)),
          count("imports", (q) => q.eq("status", "failed")),
          count("navigation_provider_health", (q) => q.gte("created_at", since).eq("healthy", false)),
          db.from("audit_logs").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ]);
        rows = [{ api_errors_24h: apiErrors, failed_imports: failedImports, provider_failures_24h: providerFailures, latest_audit_at: latestAudit.data?.created_at ?? null }];
        break;
      }
      default: {
        const recent = await db.from("audit_logs").select("id, action, resource_type, resource_id, created_at").order("created_at", { ascending: false }).limit(12);
        rows = recent.data ?? [];
      }
    }

    return {
      authorized: true as const,
      filters: data,
      metrics: { addresses, businesses, pendingVerification, pendingClaims, pendingCorrections, openReports, runningImports, apiRequests, organizations, users },
      rows,
      privacy: { residential_types_excluded_from_public_analytics: [...RESIDENTIAL_NODE_TYPES] },
      generated_at: new Date().toISOString(),
    };
  });