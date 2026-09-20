import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CLAIM_METHODS = {
  document: "وثيقة رسمية (سجل تجاري، عقد، فاتورة)",
  phone: "رقم الهاتف المعلن للعمل",
  email: "البريد الإلكتروني الرسمي",
  on_site: "تحقق ميداني من الموقع",
  other: "طريقة أخرى",
} as const;

export const CLAIM_STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبولة",
  rejected: "مرفوضة",
  withdrawn: "مسحوبة",
  superseded: "أُلغيت لصالح مطالبة أخرى",
};

const claimInput = z.object({
  business_id: z.string().uuid(),
  claimant_name: z.string().min(2).max(120),
  claimant_role: z.string().min(2).max(80),
  contact_phone: z.string().min(5).max(40),
  contact_email: z.string().email().max(160).optional().or(z.literal("")),
  claim_method: z.enum(["document", "phone", "email", "on_site", "other"]),
  evidence: z.string().max(1200).optional(),
  evidence_urls: z.array(z.string().max(400)).max(8).optional(),
});

async function isReviewer(supa: {
  rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" | "moderator" }) => Promise<{ data: unknown }>;
}, userId: string) {
  const [{ data: admin }, { data: mod }] = await Promise.all([
    supa.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supa.rpc("has_role", { _user_id: userId, _role: "moderator" }),
  ]);
  return { admin: Boolean(admin), reviewer: Boolean(admin) || Boolean(mod) };
}

export const submitClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => claimInput.parse(input))
  .handler(async ({ data, context }) => {
    const supa = context.supabase;

    const { data: biz } = await supa
      .from("businesses")
      .select("id, name_ar, owner_id")
      .eq("id", data.business_id)
      .maybeSingle();
    if (!biz) return { status: "not_found" as const };
    if (biz.owner_id === context.userId) return { status: "already_owner" as const };

    const { data: mine } = await supa
      .from("business_claims")
      .select("id, status")
      .eq("business_id", data.business_id)
      .eq("claimant_id", context.userId)
      .eq("status", "pending")
      .maybeSingle();
    if (mine) return { status: "already_pending" as const };

    const { count: competing } = await supa
      .from("business_claims")
      .select("*", { count: "exact", head: true })
      .eq("business_id", data.business_id)
      .eq("status", "pending");

    const { data: inserted, error } = await supa
      .from("business_claims")
      .insert({
        business_id: data.business_id,
        claimant_id: context.userId,
        claimant_name: data.claimant_name,
        claimant_role: data.claimant_role,
        contact_phone: data.contact_phone,
        contact_email: data.contact_email || null,
        claim_method: data.claim_method,
        evidence: data.evidence?.trim() || null,
        evidence_urls: data.evidence_urls ?? [],
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supa.from("audit_logs").insert({
      actor_id: context.userId,
      action: "business_claim_submitted",
      resource_type: "business_claim",
      resource_id: inserted.id,
      metadata: {
        business_id: data.business_id,
        business_name: biz.name_ar,
        claim_method: data.claim_method,
        evidence_files: (data.evidence_urls ?? []).length,
        competing_pending: competing ?? 0,
      },
    });

    return {
      status: "submitted" as const,
      id: inserted.id,
      conflict: (competing ?? 0) > 0,
    };
  });

export const myClaims = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("business_claims")
      .select(
        "id, business_id, status, claim_method, claimant_role, review_notes, granted_level, created_at, reviewed_at, businesses(name_ar, name_en)",
      )
      .eq("claimant_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { claims: data ?? [] };
  });

export const withdrawClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supa = context.supabase;
    const { data: row, error } = await supa
      .from("business_claims")
      .update({ status: "withdrawn" })
      .eq("id", data.id)
      .eq("claimant_id", context.userId)
      .eq("status", "pending")
      .select("id, business_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false as const };

    await supa.from("audit_logs").insert({
      actor_id: context.userId,
      action: "business_claim_withdrawn",
      resource_type: "business_claim",
      resource_id: row.id,
      metadata: { business_id: row.business_id },
    });
    return { ok: true as const };
  });

export const claimQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ status: z.enum(["pending", "approved", "rejected", "all"]).default("pending") })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const supa = context.supabase;
    const { reviewer, admin } = await isReviewer(supa as never, context.userId);
    if (!reviewer) return { authorized: false as const };

    let q = supa
      .from("business_claims")
      .select(
        "id, business_id, claimant_id, claimant_name, claimant_role, contact_phone, contact_email, claim_method, evidence, evidence_urls, status, review_notes, granted_level, created_at, reviewed_at, businesses(name_ar, name_en, category, phone, owner_id, verification_level)",
      )
      .order("created_at", { ascending: false })
      .limit(60);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const claims = rows ?? [];

    // conflict detection: businesses with more than one pending claim
    const { data: pendingAll } = await supa
      .from("business_claims")
      .select("business_id")
      .eq("status", "pending");
    const pendingCount = new Map<string, number>();
    for (const row of pendingAll ?? []) {
      pendingCount.set(row.business_id, (pendingCount.get(row.business_id) ?? 0) + 1);
    }

    // signed links for uploaded evidence (private bucket)
    const withEvidence = await Promise.all(
      claims.map(async (c) => {
        const paths = (c.evidence_urls ?? []).filter(Boolean);
        let files: { path: string; url: string }[] = [];
        if (paths.length) {
          const { data: signed } = await supa.storage
            .from("claim-evidence")
            .createSignedUrls(paths, 60 * 30);
          files = (signed ?? [])
            .filter((s) => s.signedUrl)
            .map((s) => ({ path: s.path ?? "", url: s.signedUrl }));
        }
        return {
          ...c,
          files,
          competing_pending: pendingCount.get(c.business_id) ?? 0,
        };
      }),
    );

    return { authorized: true as const, is_admin: admin, claims: withEvidence };
  });

export const reviewBusinessClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        notes: z.string().max(600).optional(),
        granted_level: z
          .enum([
            "user_confirmed",
            "community_confirmed",
            "business_verified",
            "organization_verified",
            "official_verified",
          ])
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supa = context.supabase;
    const { reviewer } = await isReviewer(supa as never, context.userId);
    if (!reviewer) throw new Error("Forbidden");

    const level = data.granted_level ?? "business_verified";
    const { data: claim, error } = await supa
      .from("business_claims")
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        review_notes: data.notes?.trim() || null,
        granted_level: data.decision === "approved" ? level : null,
      })
      .eq("id", data.id)
      .eq("status", "pending")
      .select("id, business_id, claimant_id, claimant_name")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!claim) return { ok: false as const, reason: "not_pending" as const };

    let superseded = 0;
    if (data.decision === "approved") {
      const { data: prev } = await supa
        .from("businesses")
        .select("owner_id, verification_level")
        .eq("id", claim.business_id)
        .maybeSingle();

      await supa
        .from("businesses")
        .update({ owner_id: claim.claimant_id, verification_level: level })
        .eq("id", claim.business_id);

      // conflict handling: close competing pending claims on the same business
      const { data: others } = await supa
        .from("business_claims")
        .update({
          status: "superseded",
          reviewed_by: context.userId,
          reviewed_at: new Date().toISOString(),
          review_notes: "أُغلقت تلقائياً بعد قبول مطالبة أخرى لنفس العمل",
        })
        .eq("business_id", claim.business_id)
        .eq("status", "pending")
        .select("id");
      superseded = others?.length ?? 0;

      await supa.from("audit_logs").insert({
        actor_id: context.userId,
        action: "business_ownership_transferred",
        resource_type: "business",
        resource_id: claim.business_id,
        metadata: {
          claim_id: claim.id,
          previous_owner: prev?.owner_id ?? null,
          new_owner: claim.claimant_id,
          previous_level: prev?.verification_level ?? null,
          new_level: level,
          superseded_claims: superseded,
        },
      });
    }

    await supa.from("audit_logs").insert({
      actor_id: context.userId,
      action: `business_claim_${data.decision}`,
      resource_type: "business_claim",
      resource_id: claim.id,
      metadata: {
        business_id: claim.business_id,
        claimant_id: claim.claimant_id,
        granted_level: data.decision === "approved" ? level : null,
        notes: data.notes?.trim() || null,
      },
    });

    return { ok: true as const, superseded };
  });

export const claimAuditTrail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ business_id: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const supa = context.supabase;
    const { reviewer } = await isReviewer(supa as never, context.userId);
    if (!reviewer) return { authorized: false as const };

    let claimIds: string[] = [];
    if (data.business_id) {
      const { data: rows } = await supa
        .from("business_claims")
        .select("id")
        .eq("business_id", data.business_id);
      claimIds = (rows ?? []).map((r) => r.id);
    }

    let q = supa
      .from("audit_logs")
      .select("id, action, resource_type, resource_id, metadata, actor_id, created_at")
      .like("action", "business_%")
      .order("created_at", { ascending: false })
      .limit(60);
    if (data.business_id) {
      const ids = [data.business_id, ...claimIds];
      q = q.in("resource_id", ids);
    }
    const { data: logs, error } = await q;
    if (error) throw new Error(error.message);
    return { authorized: true as const, logs: logs ?? [] };
  });
