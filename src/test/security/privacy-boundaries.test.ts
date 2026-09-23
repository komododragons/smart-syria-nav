import { describe, expect, it } from "vitest";

import { DEFAULT_PRIVACY, filterSharedFields } from "@/lib/privacy.functions";
import { RESIDENTIAL_NODE_TYPES } from "@/lib/place-categories";

describe("residential privacy release gate", () => {
  it("blocks every protected field unless the owner explicitly enables it", () => {
    expect(filterSharedFields(["name", "phone", "unit"], DEFAULT_PRIVACY)).toEqual([]);
  });

  it("keeps all residential hierarchy types outside public search", () => {
    expect(new Set(RESIDENTIAL_NODE_TYPES)).toEqual(new Set(["apartment", "unit", "floor", "residence", "house"]));
  });
});