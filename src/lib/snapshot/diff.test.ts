import { describe, it, expect } from "vitest";
import { diffSnapshot } from "./diff";
import { UF27, type StateSnapshot } from "../api/schemas";

const snap = (uf: string, risk: StateSnapshot["risk"] = "unknown"): StateSnapshot => ({
  uf,
  risk,
  riskReason: "x",
  alertCount: 0,
  lastSuccessfulFetch: null,
  formulaVersion: "v0-placeholder",
});

describe("diffSnapshot", () => {
  const all27 = UF27.map((u) => snap(u));

  it("null prev → all UFs in changedUFs + rootChanged true (cold start)", () => {
    const out = diffSnapshot(null, all27);
    expect(out.changedUFs.length).toBe(27);
    expect(out.rootChanged).toBe(true);
  });

  it("identical prev/curr → empty changedUFs + rootChanged false (P2 steady state)", () => {
    const out = diffSnapshot(all27, all27);
    expect(out.changedUFs).toEqual([]);
    expect(out.rootChanged).toBe(false);
  });

  it("single UF risk change → only that UF returned + rootChanged true", () => {
    const curr = all27.map((s) => (s.uf === "SP" ? { ...s, risk: "red" as const } : s));
    const out = diffSnapshot(all27, curr);
    expect(out.changedUFs).toEqual(["SP"]);
    expect(out.rootChanged).toBe(true);
  });

  it("multiple UFs change → all listed", () => {
    const curr = all27.map((s) =>
      ["SP", "RJ", "AM"].includes(s.uf) ? { ...s, risk: "yellow" as const } : s,
    );
    const out = diffSnapshot(all27, curr);
    expect(out.changedUFs.sort()).toEqual(["AM", "RJ", "SP"]);
    expect(out.rootChanged).toBe(true);
  });

  it("missing UF in prev (length mismatch) treated as changed", () => {
    const partialPrev = all27.slice(0, 26); // missing TO
    const out = diffSnapshot(partialPrev, all27);
    expect(out.changedUFs).toContain("TO");
  });
});
