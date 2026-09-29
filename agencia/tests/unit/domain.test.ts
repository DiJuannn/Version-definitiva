import { describe, expect, it } from "vitest";
import { canTransitionPiece, manualPieceTransitions, pieceRisk } from "@/lib/domain/piece-status";
import { canTransitionVersion, isDecidable } from "@/lib/domain/version-status";
import { allowedCorrectionTargets, canTransitionCorrection } from "@/lib/domain/correction-status";
import { formatClock, formatTimecode, frameCenterSeconds, msToFrame, parseTime } from "@/lib/domain/timecode";
import { annotationSchema, contentRect, simplifyPath, toNormalized, fromNormalized } from "@/lib/domain/annotation";
import { computeMargin, parseMoneyToCents } from "@/lib/domain/money";
import { missingBriefFields, briefCompleteness } from "@/lib/domain/brief";
import { detectStylePatterns } from "@/lib/domain/style";

describe("estados de pieza", () => {
  it("solo coordinación asigna; el sistema puede encadenar estados automáticos", () => {
    expect(canTransitionPiece("PENDING_ASSIGNMENT", "ASSIGNED", "COORDINATOR")).toBe(true);
    expect(canTransitionPiece("PENDING_ASSIGNMENT", "ASSIGNED", "EDITOR")).toBe(false);
    expect(canTransitionPiece("CLIENT_REVIEW", "APPROVED", "SYSTEM")).toBe(true);
    expect(canTransitionPiece("COMPLETED", "IN_EDIT", "SYSTEM")).toBe(false);
  });
  it("el editor solo puede pedir manualmente empezar a editar o corregir", () => {
    expect(manualPieceTransitions("ASSIGNED", "EDITOR")).toEqual(["IN_EDIT"]);
    expect(manualPieceTransitions("CHANGES_REQUESTED", "EDITOR")).toEqual(["IN_CORRECTION"]);
    expect(manualPieceTransitions("CLIENT_REVIEW", "CLIENT")).toEqual([]);
  });
  it("detecta retrasos y riesgo según estado", () => {
    const now = new Date("2026-01-10T12:00:00Z");
    expect(pieceRisk("IN_EDIT", new Date("2026-01-09T12:00:00Z"), now)).toBe("late");
    expect(pieceRisk("IN_EDIT", new Date("2026-01-11T00:00:00Z"), now)).toBe("at_risk");
    expect(pieceRisk("APPROVED", new Date("2026-01-11T00:00:00Z"), now)).toBe("ok");
    expect(pieceRisk("COMPLETED", new Date("2026-01-01T00:00:00Z"), now)).toBe("none");
  });
});

describe("estados de versión y corrección", () => {
  it("una versión aprobada no se sustituye silenciosamente", () => {
    expect(canTransitionVersion("APPROVED", "SUPERSEDED")).toBe(false);
    expect(canTransitionVersion("CLIENT_REVIEW", "APPROVED")).toBe(true);
    expect(isDecidable("SUPERSEDED")).toBe(false);
  });
  it("«resuelta» es del equipo y «verificada» del revisor", () => {
    expect(canTransitionCorrection("PENDING", "RESOLVED", "team")).toBe(true);
    expect(canTransitionCorrection("PENDING", "RESOLVED", "reviewer")).toBe(false);
    expect(canTransitionCorrection("RESOLVED", "VERIFIED", "reviewer")).toBe(true);
    expect(allowedCorrectionTargets("VERIFIED", "reviewer")).toEqual(["PENDING"]);
  });
});

describe("tiempo y fotogramas", () => {
  it("formatea reloj y timecode", () => {
    expect(formatClock(83_456, true)).toBe("01:23.456");
    expect(formatClock(3_723_000)).toBe("1:02:03");
    expect(formatTimecode(10_000, 25)).toBe("00:00:10:00");
    expect(formatTimecode(1_560, 25)).toBe("00:00:01:14");
  });
  it("convierte ms↔fotograma sin caer al anterior por coma flotante", () => {
    expect(msToFrame(40, 25)).toBe(1);
    expect(msToFrame(1000 / 30 * 7, 30)).toBe(7);
    expect(msToFrame(frameCenterSeconds(12, 23.976) * 1000, 23.976)).toBe(12);
  });
  it("interpreta tiempos escritos", () => {
    expect(parseTime("1:23")).toBe(83_000);
    expect(parseTime("00:00:05:12", 25)).toBe(5_480);
    expect(parseTime("00:00:05:12")).toBeNull();
    expect(parseTime("abc")).toBeNull();
  });
});

describe("anotaciones", () => {
  it("el área de imagen descuenta barras negras (vertical en contenedor horizontal)", () => {
    const r = contentRect(1600, 900, 1080, 1920);
    expect(r.height).toBe(900);
    expect(r.width).toBeCloseTo(506.25);
    expect(r.x).toBeCloseTo((1600 - 506.25) / 2);
  });
  it("las coordenadas normalizadas son independientes del tamaño del reproductor", () => {
    const big = contentRect(1600, 900, 1080, 1920);
    const small = contentRect(390, 400, 1080, 1920);
    const n = toNormalized(big.x + big.width * 0.25, big.y + big.height * 0.75, big);
    expect(n[0]).toBeCloseTo(0.25);
    expect(n[1]).toBeCloseTo(0.75);
    const [sx, sy] = fromNormalized(n[0], n[1], small);
    expect((sx - small.x) / small.width).toBeCloseTo(0.25);
    expect((sy - small.y) / small.height).toBeCloseTo(0.75);
  });
  it("valida y limita el dibujo", () => {
    expect(annotationSchema.safeParse({ v: 1, shapes: [{ t: "arrow", color: "#FFD23F", w: 0.004, pts: [[0.1, 0.1], [0.5, 0.5]] }] }).success).toBe(true);
    expect(annotationSchema.safeParse({ v: 1, shapes: [{ t: "arrow", color: "red", w: 0.004, pts: [[0.1, 0.1]] }] }).success).toBe(false);
    expect(annotationSchema.safeParse({ v: 1, shapes: [{ t: "pen", color: "#FFFFFF", w: 0.004, pts: [[3, 3]] }] }).success).toBe(false);
    const path = Array.from({ length: 500 }, (_, i) => [i / 5000, 0] as [number, number]);
    expect(simplifyPath(path).length).toBeLessThan(100);
  });
});

describe("dinero y márgenes", () => {
  it("convierte importes escritos a céntimos", () => {
    expect(parseMoneyToCents("1.234,56")).toBe(123456);
    expect(parseMoneyToCents("1234.5")).toBe(123450);
    expect(parseMoneyToCents("99")).toBe(9900);
    expect(parseMoneyToCents("1,2,3")).toBeNull();
  });
  it("margen estimado y final con descuentos; impuestos aparte", () => {
    const lines = [
      { kind: "REVENUE" as const, amountCents: 100000, currency: "EUR", status: "CONFIRMED" as const, taxBps: 2100 },
      { kind: "DISCOUNT" as const, amountCents: 10000, currency: "EUR", status: "CONFIRMED" as const },
      { kind: "EDITOR_COST" as const, amountCents: 30000, currency: "EUR", status: "ESTIMATED" as const },
      { kind: "OTHER_COST" as const, amountCents: 5000, currency: "EUR", status: "SETTLED" as const },
    ];
    const est = computeMargin(lines, "estimated");
    expect(est.ok && est.value.margin).toBe(55000);
    expect(est.ok && est.value.marginPct).toBe(61.1);
    expect(est.ok && est.value.tax).toBe(21000);
    const fin = computeMargin(lines, "final");
    expect(fin.ok && fin.value.margin).toBe(85000);
  });
  it("no suma monedas distintas", () => {
    const r = computeMargin(
      [
        { kind: "REVENUE", amountCents: 100, currency: "EUR", status: "CONFIRMED" },
        { kind: "EDITOR_COST", amountCents: 50, currency: "USD", status: "CONFIRMED" },
      ],
      "estimated",
    );
    expect(r.ok).toBe(false);
  });
});

describe("brief y estilo", () => {
  it("detecta lo que falta en el brief", () => {
    const missing = missingBriefFields({ objective: "x", contentType: "Reel" }).map((f) => f.key);
    expect(missing).toContain("audience");
    expect(missing).not.toContain("objective");
    expect(briefCompleteness({})).toBe(0);
  });
  it("sugiere reglas solo con repetición en varios proyectos", () => {
    const c = (id: string, body: string, projectId: string) => ({ id, body, projectId });
    expect(detectStylePatterns([c("1", "quita el zoom", "a"), c("2", "sin zoom aquí", "a"), c("3", "otro zoom", "a")])).toHaveLength(0);
    const found = detectStylePatterns([c("1", "quita el zoom", "a"), c("2", "sin zoom aquí", "b"), c("3", "otro zoom", "b")]);
    expect(found[0]?.field).toBe("zooms");
    expect(found[0]?.evidence).toEqual(["1", "2", "3"]);
  });
});
