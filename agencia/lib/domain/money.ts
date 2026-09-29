import type { FinanceKind, FinanceLineStatus } from "@prisma/client";

/**
 * Cálculo de márgenes. Importes en céntimos enteros (sin coma flotante).
 *
 *   Ingreso neto  = Σ REVENUE − Σ DISCOUNT
 *   Costes        = Σ EDITOR_COST + Σ OTHER_COST
 *   Margen        = Ingreso neto − Costes
 *   Margen %      = Margen / Ingreso neto (si ingreso neto > 0)
 *
 * - Margen ESTIMADO: todas las líneas (estimadas, confirmadas y liquidadas).
 * - Margen FINAL: solo líneas CONFIRMED o SETTLED.
 * - Los impuestos NO forman parte del margen (se muestran aparte, informativos).
 * - Si hay líneas en monedas distintas no se suman: se devuelve error.
 */
export type MoneyLine = {
  kind: FinanceKind;
  amountCents: number;
  currency: string;
  status: FinanceLineStatus;
  taxBps?: number;
};

export type MarginSummary = {
  currency: string;
  revenue: number;
  discounts: number;
  netRevenue: number;
  editorCosts: number;
  otherCosts: number;
  costs: number;
  margin: number;
  marginPct: number | null;
  tax: number;
};

export type MarginResult = { ok: true; value: MarginSummary } | { ok: false; error: string; currencies: string[] };

export function computeMargin(lines: MoneyLine[], mode: "estimated" | "final", fallbackCurrency = "EUR"): MarginResult {
  const used = mode === "final" ? lines.filter((l) => l.status !== "ESTIMATED") : lines;
  const currencies = [...new Set(used.map((l) => l.currency))];
  if (currencies.length > 1) {
    return { ok: false, error: "Hay importes en varias monedas; no se pueden sumar sin tipo de cambio.", currencies };
  }
  const sum = (k: FinanceKind) => used.filter((l) => l.kind === k).reduce((a, l) => a + l.amountCents, 0);
  const revenue = sum("REVENUE");
  const discounts = sum("DISCOUNT");
  const editorCosts = sum("EDITOR_COST");
  const otherCosts = sum("OTHER_COST");
  const netRevenue = revenue - discounts;
  const costs = editorCosts + otherCosts;
  const margin = netRevenue - costs;
  const tax = used
    .filter((l) => l.kind === "REVENUE")
    .reduce((a, l) => a + Math.round((l.amountCents * (l.taxBps ?? 0)) / 10_000), 0);
  return {
    ok: true,
    value: {
      currency: currencies[0] ?? fallbackCurrency,
      revenue,
      discounts,
      netRevenue,
      editorCosts,
      otherCosts,
      costs,
      margin,
      marginPct: netRevenue > 0 ? Math.round((margin / netRevenue) * 1000) / 10 : null,
      tax,
    },
  };
}

export function formatMoney(cents: number, currency: string, locale = "es-ES"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/** "1.234,56" / "1234.56" / "1234" → céntimos. Devuelve null si no es válido. */
export function parseMoneyToCents(input: string): number | null {
  const t = input.trim().replace(/\s|€|\$/g, "");
  if (!t) return null;
  let normalized = t;
  if (t.includes(",") && t.includes(".")) {
    normalized = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (t.includes(",")) {
    normalized = t.replace(",", ".");
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [int, dec = ""] = normalized.replace("-", "").split(".");
  const cents = Number(int) * 100 + Number(dec.padEnd(2, "0"));
  return normalized.startsWith("-") ? -cents : cents;
}
