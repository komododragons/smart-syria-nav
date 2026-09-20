import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SELECT =
  "id, issue_type, details, smart_code, status, decision, decision_note, target_field, original_value, suggested_value, applied, applied_at, reviewed_at, created_at, updated_at, node_id, access_point_id, business_id";

/** Moderation queue for community corrections (moderators/admins only). */
export const correctionQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.enum(["pending", "under_review", "approved", "rejected", "all"]).default("pending"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const supa = context.supabase;
    const [{ data: isAdmin }, { data: isModerator }] = await Promise.all([
      supa.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      supa.rpc("has_role", { _user_id: context.userId, _role: "moderator" }),
    ]);
    if (!isAdmin && !isModerator) return { authorized: false as const };

    let builder = supa
      .from("correction_reports")
      .select(`${SELECT}, location_nodes(display_name, city), businesses(name_ar)`)
      .order("created_at", { ascending: false })
      .limit(80);
    if (data.status === "pending") builder = builder.in("status", ["pending", "reviewed"]);
    else if (data.status !== "all") builder = builder.eq("status", data.status);

    const { data: rows, error } = await builder;
    if (error) throw new Error(error.message);

    const counts: Record<string, number> = {};
    const { data: all } = await supa.from("correction_reports").select("status").limit(1000);
    for (const row of all ?? []) {
      const key = row.status === "reviewed" ? "pending" : row.status;
      counts[key] = (counts[key] ?? 0) + 1;
    }

    return { authorized: true as const, reports: rows ?? [], counts };
  });

/** A reporter's own corrections, with the moderation outcome. */
export const myCorrections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("correction_reports")
      .select(SELECT)
      .eq("reporter_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { reports: data ?? [] };
  });
