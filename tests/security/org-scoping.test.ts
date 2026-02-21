import { describe, expect, it } from "vitest";
import { scopedOrgWhere } from "@/lib/services/org-scope";

describe("org scoping helpers", () => {
  it("always injects orgId into where clauses", () => {
    const where = scopedOrgWhere<{ id: string; orgId?: string }>({ id: "veh_1" }, "org_abc");
    expect(where).toEqual({
      id: "veh_1",
      orgId: "org_abc",
    });
  });

  it("overrides missing org filters with explicit orgId", () => {
    const where = scopedOrgWhere(undefined, "org_xyz");
    expect(where).toEqual({
      orgId: "org_xyz",
    });
  });
});
