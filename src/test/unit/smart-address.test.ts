import { describe, expect, it } from "vitest";

import { isValidCodeShape, normalizeArabic, normalizeCode } from "@/lib/smart-address";

describe("smart address parsing", () => {
  it("normalizes and validates Syriasan codes", () => {
    expect(normalizeCode(" sy-dam-k7x4 ")).toBe("SY-DAM-K7X4");
    expect(isValidCodeShape("SY-DAM-K7X4")).toBe(true);
    expect(isValidCodeShape("not-an-address")).toBe(false);
  });

  it("matches common Arabic spelling variants", () => {
    expect(normalizeArabic("إدلب")).toBe(normalizeArabic("ادلب"));
    expect(normalizeArabic("صيدليّة النُّور")).toBe("صيدليه النور");
  });
});