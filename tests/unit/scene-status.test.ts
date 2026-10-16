import { describe, expect, it } from "vitest";
import { sceneStatus } from "@/lib/scene-status";

const scene = (breakdown: number, days: number, shots: { shootingDayId: string | null; done: boolean }[]) => ({
  _count: { breakdownElements: breakdown, shootingDayScenes: days },
  shots,
});

describe("estado de una escena", () => {
  it("sin nada", () => {
    expect(sceneStatus(scene(0, 0, []))).toEqual({ broken: false, planned: false, scheduled: false, shot: false });
  });
  it("desglosada y con planos, pero uno sin día", () => {
    expect(sceneStatus(scene(2, 0, [{ shootingDayId: "d1", done: false }, { shootingDayId: null, done: false }]))).toEqual({
      broken: true,
      planned: true,
      scheduled: false,
      shot: false,
    });
  });
  it("sin planos cuenta como programada si la escena entera tiene día", () => {
    expect(sceneStatus(scene(0, 1, [])).scheduled).toBe(true);
  });
  it("rodada cuando todos sus planos lo están", () => {
    expect(sceneStatus(scene(1, 1, [{ shootingDayId: "d1", done: true }])).shot).toBe(true);
  });
});
