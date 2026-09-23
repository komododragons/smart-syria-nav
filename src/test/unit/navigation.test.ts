import { describe, expect, it } from "vitest";

import { buildDestination, selectDestination, type ResolvedAddress } from "@/lib/navigation/navigation.server";
import type { NavEntranceOption } from "@/lib/navigation/types";

const entrance = (overrides: Partial<NavEntranceOption>): NavEntranceOption => ({
  id: "main",
  display_name: "Main entrance",
  access_type: "entrance",
  latitude: 33.51,
  longitude: 36.29,
  is_primary: true,
  is_delivery_entrance: false,
  is_parking_entrance: false,
  is_emergency_entrance: false,
  is_loading_entrance: false,
  wheelchair_accessible: true,
  vehicle_access: true,
  temporarily_closed: false,
  temporary_status: null,
  status_reason: null,
  photo_url: null,
  instructions_ar: null,
  instructions_en: null,
  confidence_score: 90,
  verification_level: "official_verified",
  contexts: [],
  ...overrides,
});

const address: ResolvedAddress = {
  smart_code: "SY-DAM-K7X4",
  smart_address_id: "smart",
  node_id: "node",
  property_name: "Building centre",
  node_type: "building",
  city: "Damascus",
  neighborhood: null,
  street: null,
  landmark: null,
  floor_label: null,
  unit_label: null,
  property_point: { latitude: 33.5, longitude: 36.3 },
  confidence_score: 90,
  verification_level: "official_verified",
  updated_at: new Date().toISOString(),
  is_public: true,
  owner_id: null,
  default_access_point_id: "main",
  entrances: [
    entrance({}),
    entrance({ id: "delivery", display_name: "Rear loading entrance", longitude: 36.291, is_primary: false, is_delivery_entrance: true }),
    entrance({
      id: "east",
      display_name: "East emergency gate",
      longitude: 36.292,
      is_primary: false,
      is_emergency_entrance: true,
      contexts: [{ context: "emergency", allowed: true, approach_ar: "استخدم بوابة الطوارئ الشرقية", approach_en: null, preferred_road: "East road", vehicle_note: null, note: null }],
    }),
  ],
  road_access_points: [],
};

describe("entrance-first navigation", () => {
  it("honours the explicitly selected entrance instead of the building centre", () => {
    const result = selectDestination(address, { mode: "driving", entranceId: "delivery" });
    expect(result.kind).toBe("user_selected_entrance");
    expect(result.point).toEqual({ latitude: 33.51, longitude: 36.291 });
    expect(result.point).not.toEqual(address.property_point);
  });

  it("chooses delivery and contextual emergency entrances", () => {
    expect(selectDestination(address, { mode: "delivery" }).entrance?.id).toBe("delivery");
    const emergency = selectDestination(address, { mode: "driving", context: "emergency" });
    expect(emergency.entrance?.id).toBe("east");
    expect(buildDestination(address, emergency, "driving", "emergency").context_approach).toContain("الشرقية");
  });

  it("falls back to the property only when no entrance exists", () => {
    const result = selectDestination({ ...address, entrances: [] }, { mode: "walking" });
    expect(result.kind).toBe("property_centroid");
    expect(result.warnings).toContain("approximate_route");
  });
});