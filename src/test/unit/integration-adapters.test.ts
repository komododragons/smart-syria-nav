import { describe, expect, it } from "vitest";

import {
  INTEGRATION_ADAPTERS,
  INTEGRATION_CONTRACT,
  INTEGRATION_SECTORS,
  integrationAdapter,
} from "@/lib/integration-adapters";

describe("future integration adapters", () => {
  it("covers every supported sector without claiming a live provider connection", () => {
    expect(Object.keys(INTEGRATION_ADAPTERS)).toEqual([...INTEGRATION_SECTORS]);
    for (const value of Object.values(INTEGRATION_ADAPTERS)) {
      expect(value.credentialMode).toBe("none_until_provider_configured");
    }
  });

  it("maps arrival-sensitive sectors to the correct entrance context", () => {
    expect(integrationAdapter("courier").defaultContext).toBe("parcel");
    expect(integrationAdapter("logistics").defaultContext).toBe("heavy_freight");
    expect(integrationAdapter("emergency").defaultContext).toBe("emergency");
  });

  it("makes the residential privacy boundary explicit", () => {
    expect(INTEGRATION_CONTRACT.privacy.privateResidential).toBe(
      "temporary_owner_controlled_share_only",
    );
    expect(INTEGRATION_CONTRACT.privacy.forbiddenPublicFields).toContain("unit");
  });
});