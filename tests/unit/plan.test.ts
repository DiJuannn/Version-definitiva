import { describe, expect, it } from "vitest";
import { ALL_ACCESS, isPaidPlan, isPro } from "@/lib/plan";

describe("plan", () => {
  it("con el acceso total, todo plan tiene las funciones de PRO", () => {
    expect(ALL_ACCESS).toBe(true);
    expect(isPro("FREE")).toBe(true);
    expect(isPro("PRO")).toBe(true);
    expect(isPro("PRO_LIFETIME")).toBe(true);
  });

  it("isPaidPlan sigue diciendo quién paga de verdad", () => {
    expect(isPaidPlan("FREE")).toBe(false);
    expect(isPaidPlan("PRO")).toBe(true);
    expect(isPaidPlan("PRO_LIFETIME")).toBe(true);
  });
});
