/**
 * Phase 18 — per-context approach instructions for a single access point.
 *
 * Owners (and staff) describe how each routing context should approach the
 * same address: visitors to the main door, freight to the industrial road,
 * ambulances to the east emergency gate.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ROUTING_CONTEXT_VALUES } from "./routing-contexts";

const contextSchema = z.enum(ROUTING_CONTEXT_VALUES as unknown as [string, ...string[]]);
const SELECT =
  "id, access_point_id, context, allowed, approach_ar, approach_en, preferred_road, vehicle_note, note, updated_at";

/** Public: contexts declared on a given access point. */
export const listAccessPointContexts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ accessPointId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { serverPublicClient } = await import("./addresses.server");
    const { data: rows } = await serverPublicClient()
      .from("access_point_contexts")
      .select(SELECT)
      .eq("access_point_id", data.accessPointId)
      .order("context", { ascending: true });
    return rows ?? [];
  });

/** Owner/staff: create or update the instructions for one context. */
export const saveAccessPointContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        accessPointId: z.string().uuid(),
        context: contextSchema,
        allowed: z.boolean().default(true),
        approach_ar: z.string().max(400).nullish(),
        approach_en: z.string().max(400).nullish(),
        preferred_road: z.string().max(160).nullish(),
        vehicle_note: z.string().max(200).nullish(),
        note: z.string().max(400).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const clean = (value: string | null | undefined) => {
      const trimmed = (value ?? "").trim();
      return trimmed.length ? trimmed : null;
    };

    const { error } = await context.supabase.from("access_point_contexts").upsert(
      {
        access_point_id: data.accessPointId,
        context: data.context,
        allowed: data.allowed,
        approach_ar: clean(data.approach_ar),
        approach_en: clean(data.approach_en),
        preferred_road: clean(data.preferred_road),
        vehicle_note: clean(data.vehicle_note),
        note: clean(data.note),
        created_by: context.userId,
      },
      { onConflict: "access_point_id,context" },
    );
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/** Owner/staff: drop the context override, falling back to standard routing. */
export const deleteAccessPointContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ accessPointId: z.string().uuid(), context: contextSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("access_point_contexts")
      .delete()
      .eq("access_point_id", data.accessPointId)
      .eq("context", data.context);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
