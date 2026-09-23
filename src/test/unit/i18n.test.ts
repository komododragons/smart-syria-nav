import { describe, expect, it } from "vitest";

import { formatAddressLine, formatDistance, formatDuration } from "@/lib/i18n";

describe("Arabic and English presentation", () => {
  const address = { unit: "3", floor: "2", building: "17", street: "بغداد", city: "دمشق" };

  it("uses natural Arabic address order", () => {
    expect(formatAddressLine(address, "ar")).toBe("وحدة 3 · الطابق 2 · بناء 17 · شارع بغداد · دمشق · سوريا");
  });

  it("uses English punctuation and labels", () => {
    expect(formatAddressLine({ ...address, street: "Baghdad", city: "Damascus" }, "en")).toBe(
      "Unit 3, Floor 2, Bldg. 17, Baghdad St., Damascus, Syria",
    );
    expect(formatDistance(1500, "en")).toBe("1.5 km");
    expect(formatDuration(3900, "ar")).toBe("ساعة و5 دقيقة");
  });
});