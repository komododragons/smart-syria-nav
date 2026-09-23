import { describe, expect, it } from "vitest";

import {
  ADDRESS_CLASSIFICATIONS,
  commercialContentSignals,
  isCommercialClassification,
  isPublicClassification,
} from "@/lib/address-classification";

describe("address classification", () => {
  it("defines the eight required classifications", () => {
    expect(ADDRESS_CLASSIFICATIONS).toHaveLength(8);
  });

  it("keeps private residences outside the public layer", () => {
    expect(isPublicClassification("private_residence")).toBe(false);
    expect(isCommercialClassification("private_residence")).toBe(false);
  });

  it("keeps buildings public without treating them as a business", () => {
    expect(isPublicClassification("building_residential_complex")).toBe(true);
    expect(isCommercialClassification("building_residential_complex")).toBe(false);
  });

  it("detects explicit Arabic and structured commercial signals", () => {
    expect(commercialContentSignals({ name: "شركة الأمل", openingHours: "8-5", phone: "+963" })).toEqual([
      "commercial_term",
      "opening_hours",
      "public_phone",
    ]);
  });
});