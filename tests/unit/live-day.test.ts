import { describe, expect, it } from "vitest";
import { computeDayTimeline, type PlanBlock, type PlanShot } from "@/lib/schedule-plan";
import { liveForecast, madridNowOn } from "@/lib/live-day";

const shot = (id: string, min: number, extra: Partial<PlanShot> = {}): PlanShot => ({
  id,
  sceneId: "s1",
  sceneNumber: "1",
  number: id,
  shotSize: null,
  movement: null,
  description: null,
  estimatedMin: min,
  intExt: "INT",
  dayPart: "DAY",
  characterIds: ["lyra"],
  done: false,
  ...extra,
});
const block = (id: string, shots: PlanShot[]): PlanBlock => ({ id, kind: "SHOTS", title: null, durationMin: null, startTime: null, notes: null, scene: null, shots });
const day = (blocks: PlanBlock[], callTime = "08:00") =>
  computeDayTimeline({ date: new Date("2026-10-24T12:00:00Z"), callTime, prepMin: 0, blocks });

describe("día de rodaje en directo", () => {
  it("fuera del día: el plan tal cual, sin retraso", () => {
    const f = liveForecast({ timeline: day([block("b", [shot("a", 60), shot("b", 60)])]), now: null, workdayHours: 10 });
    expect(f.started).toBe(false);
    expect(f.delay).toBe(0);
    expect(f.projectedWrap).toBe(10 * 60);
  });

  it("con retraso: lo que toca, el retraso y el fin a este ritmo", () => {
    // Plan: a 08:00-09:00, b 09:00-10:00. Son las 09:30 y solo está hecho a.
    const tl = day([block("b", [shot("a", 60, { done: true }), shot("b", 60), shot("c", 60)])]);
    const f = liveForecast({ timeline: tl, now: 9 * 60 + 30, workdayHours: 10 });
    expect(f.current?.id).toBe("b");
    expect(f.planMark).toBe(9 * 60);
    expect(f.delay).toBe(30);
    expect(f.projectedWrap).toBe(11 * 60 + 30);
  });

  it("adelantados: el fin se adelanta", () => {
    const tl = day([block("b", [shot("a", 60, { done: true }), shot("b", 60)])]);
    const f = liveForecast({ timeline: tl, now: 8 * 60 + 40, workdayHours: 10 });
    expect(f.delay).toBe(-20);
    expect(f.projectedWrap).toBe(9 * 60 + 40);
  });

  it("se cae lo que pasa de las horas de jornada", () => {
    // Jornada de 2 h desde las 08:00 → límite 10:00. Con 30 min de retraso, c acaba a las 11:30.
    const tl = day([block("b", [shot("a", 60, { done: true }), shot("b", 30), shot("c", 60)])]);
    const f = liveForecast({ timeline: tl, now: 9 * 60 + 30, workdayHours: 2 });
    expect(f.drops.map((d) => d.id)).toEqual(["c"]);
    expect(f.drops[0].reason).toBe("limit");
  });

  it("se cae un exterior de día que acaba sin luz", () => {
    const tl = day([block("b", [shot("a", 600, { done: true }), shot("ext", 120, { intExt: "EXT", dayPart: "DAY" })])], "07:00");
    // El sol se pone en Madrid a finales de octubre hacia las 19:00; ext acaba a las 19:00 + retraso.
    const f = liveForecast({ timeline: tl, now: 17 * 60 + 30, workdayHours: 14 });
    expect(f.drops.find((d) => d.id === "ext")?.reason).toBe("light");
  });

  it("avisa del descanso corto del reparto entre jornadas", () => {
    const today = day([block("b", [shot("a", 60, { done: true }), shot("b", 13 * 60)])], "08:00");
    const tomorrow = day([block("b2", [shot("x", 60)])], "07:00");
    const f = liveForecast({ timeline: today, now: 9 * 60, workdayHours: 16, next: { timeline: tomorrow } });
    // Hoy acaba a las 22:00; mañana a las 06:30 en maquillaje → 8 h 30.
    expect(f.rest).toEqual([{ characterId: "lyra", restMinutes: 8 * 60 + 30 }]);
  });

  it("hora de Madrid solo si es el día", () => {
    const at = new Date("2026-10-24T10:31:00Z"); // 12:31 en Madrid (verano)
    expect(madridNowOn("2026-10-24T12:00:00Z", at)).toBe(12 * 60 + 31);
    expect(madridNowOn("2026-10-25T12:00:00Z", at)).toBeNull();
  });
});
