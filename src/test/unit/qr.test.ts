import { describe, expect, it } from "vitest";

import { extractSyriasanCode } from "@/lib/qr";

describe("QR scanning", () => {
  it.each([
    ["sy-dam-k7x4", "SY-DAM-K7X4"],
    ["https://syriasan.com/a/SY-DAM-K7X4", "SY-DAM-K7X4"],
    ["https://www.syriasan.com/d/SY-RDA-82KF", "SY-RDA-82KF"],
  ])("extracts a canonical address from %s", (payload, expected) => {
    expect(extractSyriasanCode(payload)).toBe(expected);
  });

  it.each(["", "hello", "https://evil.example/a/SY-DAM-K7X4", "https://syriasan.com/plans"])(
    "rejects unrelated payload %s",
    (payload) => expect(extractSyriasanCode(payload)).toBeNull(),
  );
});