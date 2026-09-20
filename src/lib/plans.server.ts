/**
 * Server-side entitlement resolution and enforcement (Phase 22).
 *
 * Enforcement is behind the `entitlements.enforced` platform setting so the
 * architecture can ship today and be switched on when pricing launches.
 * While it is off, `requireEntitlement` / `requireCapacity` observe and allow.
 */
import {
  effectivePlan,
  hasEntitlement,
  limitFor,
  type Entitlement,
  type LimitKey,
  type PlanId,
  type PlanStatus,
} from "./plans";

export type PlanRecord = {
  plan: PlanId;
  status: PlanStatus;
  source: string;
  started_at: string;
  expires_at: string | null;
  notes: string | null;
};

const DEFAULT_PLAN: PlanRecord = {
  plan: "free",
  status: "active",
  source: "manual",
  started_at: new Date(0).toISOString(),
  expires_at: null,
  notes: null,
};

type AnyClient = {
  from: (table: string) => any;
};

export async function entitlementsEnforced(client: AnyClient): Promise<boolean> {
  const { data } = await client
    .from("platform_settings")
    .select("value")
    .eq("key", "entitlements")
    .maybeSingle();
  return Boolean((data?.value as { enforced?: boolean } | null)?.enforced);
}

export async function pricingPublished(client: AnyClient): Promise<boolean> {
  const { data } = await client
    .from("platform_settings")
    .select("value")
    .eq("key", "entitlements")
    .maybeSingle();
  return Boolean((data?.value as { pricing_published?: boolean } | null)?.pricing_published);
}

async function readPlan(client: AnyClient, column: "user_id" | "organization_id", id: string) {
  const { data } = await client
    .from("account_plans")
    .select("plan, status, source, started_at, expires_at, notes")
    .eq(column, id)
    .maybeSingle();
  return (data as PlanRecord | null) ?? { ...DEFAULT_PLAN };
}

export async function userPlan(client: AnyClient, userId: string): Promise<PlanRecord> {
  return readPlan(client, "user_id", userId);
}

export async function organizationPlan(client: AnyClient, orgId: string): Promise<PlanRecord> {
  return readPlan(client, "organization_id", orgId);
}

/** The plan actually in force right now (expired/canceled falls back to free). */
export function resolvedPlan(record: PlanRecord): PlanId {
  return effectivePlan(record.plan, record.status, record.expires_at);
}

/**
 * The account's plan for a given action: an organization's plan wins over the
 * member's personal plan, and the higher of the two is used.
 */
export function strongerPlan(a: PlanId, b: PlanId): PlanId {
  const rank: PlanId[] = ["free", "business", "developer", "enterprise"];
  return rank.indexOf(a) >= rank.indexOf(b) ? a : b;
}

export class EntitlementError extends Error {
  constructor(
    public readonly entitlement: Entitlement | LimitKey,
    public readonly requiredPlan: PlanId | null,
    message: string,
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

/** Throws only while enforcement is switched on; otherwise returns the verdict. */
export async function requireEntitlement(
  client: AnyClient,
  plan: PlanId,
  entitlement: Entitlement,
): Promise<{ allowed: boolean; enforced: boolean }> {
  const allowed = hasEntitlement(plan, entitlement);
  const enforced = await entitlementsEnforced(client);
  if (!allowed && enforced) {
    throw new EntitlementError(entitlement, null, `الخطة الحالية لا تشمل هذه الميزة (${entitlement}).`);
  }
  return { allowed, enforced };
}

export async function requireCapacity(
  client: AnyClient,
  plan: PlanId,
  key: LimitKey,
  used: number,
): Promise<{ allowed: boolean; enforced: boolean; limit: number }> {
  const limit = limitFor(plan, key);
  const allowed = limit < 0 || used < limit;
  const enforced = await entitlementsEnforced(client);
  if (!allowed && enforced) {
    throw new EntitlementError(key, null, `تم بلوغ الحد المسموح في الخطة الحالية (${key}: ${limit}).`);
  }
  return { allowed, enforced, limit };
}
