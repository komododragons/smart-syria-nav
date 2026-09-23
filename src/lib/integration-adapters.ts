/**
 * Sector-neutral integration contracts.
 *
 * These adapters describe how a partner workflow maps to Syriasan's existing
 * address and entrance model. They intentionally contain no vendor SDKs,
 * credentials, connection state, or outbound network calls.
 */
import type { RoutingContext } from "./routing-contexts";

export const INTEGRATION_SECTORS = [
  "general",
  "courier",
  "ecommerce",
  "banking",
  "fintech",
  "insurance",
  "utilities",
  "healthcare",
  "hospitality",
  "government",
  "municipality",
  "emergency",
  "logistics",
] as const;

export type IntegrationSector = (typeof INTEGRATION_SECTORS)[number];

export const INTEGRATION_CAPABILITIES = [
  "resolve_public_address",
  "select_contextual_entrance",
  "route_to_entrance",
  "validate_address_code",
  "render_qr",
  "receive_signed_webhooks",
  "report_destination_outcome",
] as const;

export type IntegrationCapability = (typeof INTEGRATION_CAPABILITIES)[number];

export type IntegrationAdapter = {
  sector: IntegrationSector;
  defaultContext: RoutingContext;
  capabilities: readonly IntegrationCapability[];
  credentialMode: "none_until_provider_configured";
};

const BASE_CAPABILITIES = [
  "resolve_public_address",
  "select_contextual_entrance",
  "validate_address_code",
  "render_qr",
  "receive_signed_webhooks",
] as const satisfies readonly IntegrationCapability[];

const ARRIVAL_CAPABILITIES = [
  ...BASE_CAPABILITIES,
  "route_to_entrance",
  "report_destination_outcome",
] as const satisfies readonly IntegrationCapability[];

function adapter(
  sector: IntegrationSector,
  defaultContext: RoutingContext,
  capabilities: readonly IntegrationCapability[] = BASE_CAPABILITIES,
): IntegrationAdapter {
  return { sector, defaultContext, capabilities, credentialMode: "none_until_provider_configured" };
}

export const INTEGRATION_ADAPTERS: Readonly<Record<IntegrationSector, IntegrationAdapter>> = {
  general: adapter("general", "standard"),
  courier: adapter("courier", "parcel", ARRIVAL_CAPABILITIES),
  ecommerce: adapter("ecommerce", "parcel", ARRIVAL_CAPABILITIES),
  banking: adapter("banking", "visitor"),
  fintech: adapter("fintech", "visitor"),
  insurance: adapter("insurance", "visitor"),
  utilities: adapter("utilities", "commercial_delivery", ARRIVAL_CAPABILITIES),
  healthcare: adapter("healthcare", "visitor", ARRIVAL_CAPABILITIES),
  hospitality: adapter("hospitality", "visitor", ARRIVAL_CAPABILITIES),
  government: adapter("government", "visitor", ARRIVAL_CAPABILITIES),
  municipality: adapter("municipality", "commercial_delivery", ARRIVAL_CAPABILITIES),
  emergency: adapter("emergency", "emergency", ARRIVAL_CAPABILITIES),
  logistics: adapter("logistics", "heavy_freight", ARRIVAL_CAPABILITIES),
};

export function integrationAdapter(sector: string | null | undefined): IntegrationAdapter {
  if (sector && sector in INTEGRATION_ADAPTERS) {
    return INTEGRATION_ADAPTERS[sector as IntegrationSector];
  }
  return INTEGRATION_ADAPTERS.general;
}

export const INTEGRATION_CONTRACT = {
  name: "syriasan-integration",
  version: "2026-09-23",
  addressModel: ["site", "building", "entrance", "floor", "unit"],
  privacy: {
    publicApi: "public_and_business_locations_only",
    privateResidential: "temporary_owner_controlled_share_only",
    forbiddenPublicFields: [
      "resident_name",
      "phone",
      "floor",
      "unit",
      "personal_delivery_notes",
      "private_access_instructions",
    ],
  },
  outcomeEvents: ["address_used", "navigation_started", "destination_reached"],
} as const;