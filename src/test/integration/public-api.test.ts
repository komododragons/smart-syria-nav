import { describe, expect, it } from "vitest";

const origin = process.env["TEST_APP_ORIGIN"] ?? "http://localhost:8080";
const forbidden = ["owner_id", "created_by", "private_notes", "contact_phone", "contact_name", "unit_label", "delivery_notes"];

describe("public address contracts", () => {
  it("resolves a public address using an allow-listed, cacheable payload", async () => {
    const response = await fetch(`${origin}/api/public/resolve?code=SY-DAM-9M4Q&purpose=visitor`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("public");
    const body = await response.json();
    expect(body.code).toBe("SY-DAM-9M4Q");
    for (const key of forbidden) expect(JSON.stringify(body)).not.toContain(key);
  });

  it("does not cache or disclose unknown addresses", async () => {
    const response = await fetch(`${origin}/api/public/resolve?code=SY-DAM-ZZZZ&purpose=visitor`);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    for (const key of forbidden) expect(text).not.toContain(key);
  });

  it("requires authentication for developer API data endpoints", async () => {
    const response = await fetch(`${origin}/api/public/v1/resolve/SY-DAM-9M4Q`);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "missing_api_key" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});