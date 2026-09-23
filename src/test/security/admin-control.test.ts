import { describe, expect, it, vi } from "vitest";

import { callerIsAdministrator } from "@/lib/admin-control.functions";

describe("admin control center authorization", () => {
  it("requires the explicit admin role", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false });
    await expect(callerIsAdministrator({ rpc }, "user-1")).resolves.toBe(false);
    expect(rpc).toHaveBeenCalledWith("has_role", { _user_id: "user-1", _role: "admin" });
  });

  it("allows an administrator", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true });
    await expect(callerIsAdministrator({ rpc }, "admin-1")).resolves.toBe(true);
  });
});