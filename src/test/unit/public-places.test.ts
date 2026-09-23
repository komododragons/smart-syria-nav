import { describe, expect, it } from "vitest";

import { PLACE_CATEGORY_VALUES, RESIDENTIAL_NODE_TYPES } from "@/lib/place-categories";

describe("public directory privacy", () => {
  it("does not define residential place categories", () => {
    expect(PLACE_CATEGORY_VALUES).not.toEqual(expect.arrayContaining(["home", "house", "apartment", "residence"]));
    expect(RESIDENTIAL_NODE_TYPES).toEqual(expect.arrayContaining(["house", "apartment", "unit", "floor"]));
  });
});