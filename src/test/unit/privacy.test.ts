import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRIVACY,
  clampShareHours,
  filterSharedFields,
  type PrivacyPreferences,
} from "@/lib/privacy.functions";

describe("private sharing preferences", () => {
  it("keeps personal fields private by default", () => {
    expect(DEFAULT_PRIVACY).toMatchObject({
      allow_share_phone: false,
      allow_share_unit: false,
      allow_share_name: false,
      require_expiry: true,
    });
    expect(filterSharedFields(["location", "unit", "phone", "name"], DEFAULT_PRIVACY)).toEqual([
      "location",
    ]);
  });

  it("lets owner settings narrow, never widen, caller-requested fields", () => {
    const locked: PrivacyPreferences = {
      ...DEFAULT_PRIVACY,
      allow_share_floor: false,
      allow_share_instructions: false,
      allow_share_parking: false,
    };
    expect(
      filterSharedFields(
        ["location", "building", "entrance", "floor", "unit", "instructions", "parking", "phone", "name"],
        locked,
      ),
    ).toEqual(["location", "building", "entrance"]);
  });

  it("caps expiration at the owner's maximum", () => {
    expect(clampShareHours(undefined, DEFAULT_PRIVACY)).toBe(24);
    expect(clampShareHours(9999, DEFAULT_PRIVACY)).toBe(168);
    expect(clampShareHours(1, DEFAULT_PRIVACY)).toBe(1);
  });
});