import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";

// Excel del presupuesto (función PRO). Las columnas de subtotal, total con IVA
// y desvío son FÓRMULAS de Excel, no números fijos: quien lo abre puede cambiar
// una cantidad o un precio y todos los totales se recalculan solos. Cada
// fórmula lleva además su resultado ya calculado para que lo vean bien
// también los visores que no recalculan (vista previa del móvil, Google Drive…).

const EURO = '#,##0.00" €"';
const INK = "FF0A0A0A";
const PAPER = "FFF2EFE8";
const ACCENT = "FFA08FD0";

type ExportProject = { name: string; budgetTarget: unknown };

const categoryInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      actor: { select: { name: true } },
      location: { select: { name: true } },
      crewMember: { select: { name: true } },
      breakdownElement: { select: { name: true } },
    },
  },
};

export async function loadBudgetForExport(projectId: string) {
  return prisma.budgetCategory.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    include: categoryInclude,
  });
}

type ExportCategory = Awaited<ReturnType<typeof loadBudgetForExport>>[number];

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export async function buildBudgetWorkbook(
  project: ExportProject,
  categories: ExportCategory[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Versión definitiva";
  workbook.created = new Date();
  // Excel recalcula todo al abrir: así los ceros y los resultados vacíos nunca salen mal.
  workbook.calcProperties = { fullCalcOnLoad: true };

  const sheet = workbook.addWorksheet("Presupuesto", {
    views: [{ state: "frozen", ySplit: 4 }],
    properties: { defaultRowHeight: 18 },
  });
  sheet.columns = [
    { key: "concept", width: 38 },
    { key: "linked", width: 24 },
    { key: "qty", width: 10 },
    { key: "unit", width: 15 },
    { key: "tax", width: 9 },
    { key: "subtotal", width: 15 },
    { key: "total", width: 17 },
    { key: "actual", width: 15 },
    { key: "diff", width: 17 },
    { key: "notes", width: 36 },
  ];

  sheet.mergeCells("A1:J1");
  const title = sheet.getCell("A1");
  title.value = `PRESUPUESTO · ${project.name}`;
  title.font = { name: "Calibri", size: 16, bold: true, color: { argb: PAPER } };
  title.fill = fill(INK);
  title.alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(1).height = 32;

  sheet.mergeCells("A2:J2");
  const stamp = sheet.getCell("A2");
  stamp.value = `Exportado el ${new Date().toLocaleDateString("es-ES")} desde Versión definitiva · Cantidad, precio, IVA y gasto real se pueden editar: los totales se recalculan solos.`;
  stamp.font = { size: 9, italic: true, color: { argb: "FF6B6B6B" } };
  stamp.alignment = { indent: 1 };

  const header = sheet.getRow(4);
  header.values = [
    "Concepto",
    "Vinculado a",
    "Cantidad",
    "Precio unitario",
    "IVA %",
    "Subtotal",
    "Total con IVA",
    "Gasto real",
    "Desvío (previsto − real)",
    "Notas",
  ];
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: PAPER }, size: 10 };
    cell.fill = fill(INK);
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  header.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  let row = 5;
  const subtotalRows: { name: string; itemCount: number; row: number }[] = [];

  for (const category of categories) {
    const catRow = sheet.getRow(row);
    catRow.getCell(1).value = category.name.toUpperCase();
    catRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill("FFE6E1F2");
      cell.font = { bold: true, color: { argb: INK }, size: 11 };
    });
    for (let c = 1; c <= 10; c += 1) catRow.getCell(c).fill = fill("FFE6E1F2");
    row += 1;

    const firstItemRow = row;
    for (const item of category.items) {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const taxRate = Number(item.taxRate);
      const subtotal = quantity * unitPrice;
      const total = subtotal * (1 + taxRate / 100);
      const actual = item.actualAmount !== null ? Number(item.actualAmount) : null;
      const linked = [
        item.actor?.name,
        item.location?.name,
        item.crewMember?.name,
        item.breakdownElement?.name,
      ]
        .filter(Boolean)
        .join(", ");

      const r = sheet.getRow(row);
      r.getCell(1).value = item.description;
      r.getCell(2).value = linked || null;
      r.getCell(3).value = quantity;
      r.getCell(4).value = unitPrice;
      r.getCell(5).value = taxRate;
      r.getCell(6).value = { formula: `C${row}*D${row}`, result: subtotal };
      r.getCell(7).value = { formula: `F${row}*(1+E${row}/100)`, result: total };
      r.getCell(8).value = actual;
      r.getCell(9).value = {
        formula: `IF(H${row}="","",G${row}-H${row})`,
        result: actual === null ? "" : total - actual,
      };
      r.getCell(10).value = item.notes ?? null;

      r.getCell(3).numFmt = "#,##0.##";
      r.getCell(4).numFmt = EURO;
      r.getCell(5).numFmt = '0.##"%"';
      r.getCell(6).numFmt = EURO;
      r.getCell(7).numFmt = EURO;
      r.getCell(8).numFmt = EURO;
      r.getCell(9).numFmt = EURO;
      // Las celdas que se pueden tocar van en azul, como en cualquier hoja de cálculo profesional.
      for (const c of [3, 4, 5, 8]) r.getCell(c).font = { color: { argb: "FF1F4FBF" } };
      r.getCell(1).alignment = { indent: 1, wrapText: true, vertical: "top" };
      r.getCell(10).alignment = { wrapText: true, vertical: "top" };
      r.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = { bottom: { style: "hair", color: { argb: "FFBFBFBF" } } };
      });
      row += 1;
    }
    const lastItemRow = row - 1;

    const itemTotal = category.items.reduce(
      (sum, i) => sum + Number(i.quantity) * Number(i.unitPrice) * (1 + Number(i.taxRate) / 100),
      0,
    );
    const itemSubtotal = category.items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitPrice), 0);
    const itemActual = category.items.reduce((sum, i) => sum + Number(i.actualAmount ?? 0), 0);
    const itemDiff = category.items.reduce(
      (sum, i) =>
        i.actualAmount === null
          ? sum
          : sum + (Number(i.quantity) * Number(i.unitPrice) * (1 + Number(i.taxRate) / 100) - Number(i.actualAmount)),
      0,
    );

    const sub = sheet.getRow(row);
    sub.getCell(1).value = `Total ${category.name}`;
    if (category.items.length > 0) {
      sub.getCell(6).value = { formula: `SUM(F${firstItemRow}:F${lastItemRow})`, result: itemSubtotal };
      sub.getCell(7).value = { formula: `SUM(G${firstItemRow}:G${lastItemRow})`, result: itemTotal };
      sub.getCell(8).value = { formula: `SUM(H${firstItemRow}:H${lastItemRow})`, result: itemActual };
      sub.getCell(9).value = { formula: `SUM(I${firstItemRow}:I${lastItemRow})`, result: itemDiff };
    } else {
      for (const c of [6, 7, 8, 9]) sub.getCell(c).value = 0;
    }
    for (let c = 1; c <= 10; c += 1) {
      const cell = sub.getCell(c);
      cell.font = { bold: true };
      cell.border = { top: { style: "thin", color: { argb: INK } } };
      if (c >= 6 && c <= 9) cell.numFmt = EURO;
    }
    sub.getCell(1).alignment = { indent: 1 };
    subtotalRows.push({ name: category.name, itemCount: category.items.length, row });
    row += 2;
  }

  // Totales generales.
  const grandTotal = categories.reduce(
    (sum, c) =>
      sum + c.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice) * (1 + Number(i.taxRate) / 100), 0),
    0,
  );
  const grandActual = categories.reduce(
    (sum, c) => sum + c.items.reduce((s, i) => s + Number(i.actualAmount ?? 0), 0),
    0,
  );
  const grandSubtotal = categories.reduce(
    (sum, c) => sum + c.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0),
    0,
  );

  const sumOf = (col: string) =>
    subtotalRows.length > 0 ? subtotalRows.map((s) => `${col}${s.row}`).join("+") : "0";

  const totalRow = sheet.getRow(row);
  totalRow.getCell(1).value = "TOTAL PRESUPUESTO";
  totalRow.getCell(6).value = { formula: sumOf("F"), result: grandSubtotal };
  totalRow.getCell(7).value = { formula: sumOf("G"), result: grandTotal };
  totalRow.getCell(8).value = { formula: sumOf("H"), result: grandActual };
  for (let c = 1; c <= 10; c += 1) {
    const cell = totalRow.getCell(c);
    cell.fill = fill(INK);
    cell.font = { bold: true, color: { argb: PAPER }, size: 12 };
    if (c >= 6 && c <= 9) cell.numFmt = EURO;
  }
  totalRow.getCell(1).alignment = { indent: 1 };
  totalRow.height = 26;
  const grandRow = row;
  row += 1;

  const target = project.budgetTarget !== null && project.budgetTarget !== undefined ? Number(project.budgetTarget) : null;
  if (target !== null) {
    const t = sheet.getRow(row);
    t.getCell(1).value = "Presupuesto objetivo";
    t.getCell(7).value = target;
    t.getCell(7).numFmt = EURO;
    t.getCell(7).font = { color: { argb: "FF1F4FBF" } };
    row += 1;
    const left = sheet.getRow(row);
    left.getCell(1).value = "Disponible (objetivo − gasto real)";
    left.getCell(7).value = { formula: `G${row - 1}-H${grandRow}`, result: target - grandActual };
    left.getCell(7).numFmt = EURO;
    left.getCell(7).font = { bold: true };
    row += 1;
  }

  // Hoja de resumen por categorías, enlazada a la hoja principal.
  const summary = workbook.addWorksheet("Resumen por categoría");
  summary.columns = [
    { width: 34 },
    { width: 12 },
    { width: 18 },
    { width: 18 },
    { width: 14 },
  ];
  const sHead = summary.getRow(1);
  sHead.values = ["Categoría", "Partidas", "Previsto (con IVA)", "Gasto real", "% gastado"];
  sHead.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: PAPER } };
    cell.fill = fill(INK);
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  sHead.getCell(1).alignment = { horizontal: "left", indent: 1 };
  sHead.height = 22;

  subtotalRows.forEach((sub, index) => {
    const r = summary.getRow(index + 2);
    const category = categories[index];
    const total = category.items.reduce(
      (s, i) => s + Number(i.quantity) * Number(i.unitPrice) * (1 + Number(i.taxRate) / 100),
      0,
    );
    const actual = category.items.reduce((s, i) => s + Number(i.actualAmount ?? 0), 0);
    r.getCell(1).value = sub.name;
    r.getCell(2).value = sub.itemCount;
    r.getCell(3).value = { formula: `'Presupuesto'!G${sub.row}`, result: total };
    r.getCell(4).value = { formula: `'Presupuesto'!H${sub.row}`, result: actual };
    r.getCell(5).value = { formula: `IF(C${index + 2}=0,0,D${index + 2}/C${index + 2})`, result: total === 0 ? 0 : actual / total };
    r.getCell(3).numFmt = EURO;
    r.getCell(4).numFmt = EURO;
    r.getCell(5).numFmt = "0%";
    r.getCell(1).alignment = { indent: 1 };
    r.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: "FFBFBFBF" } } };
    });
  });
  const endRow = subtotalRows.length + 2;
  const sTotal = summary.getRow(endRow);
  sTotal.getCell(1).value = "TOTAL";
  sTotal.getCell(2).value = { formula: `SUM(B2:B${endRow - 1})`, result: subtotalRows.reduce((n, s) => n + s.itemCount, 0) };
  sTotal.getCell(3).value = { formula: `SUM(C2:C${endRow - 1})`, result: grandTotal };
  sTotal.getCell(4).value = { formula: `SUM(D2:D${endRow - 1})`, result: grandActual };
  sTotal.getCell(5).value = { formula: `IF(C${endRow}=0,0,D${endRow}/C${endRow})`, result: grandTotal === 0 ? 0 : grandActual / grandTotal };
  sTotal.getCell(3).numFmt = EURO;
  sTotal.getCell(4).numFmt = EURO;
  sTotal.getCell(5).numFmt = "0%";
  for (let c = 1; c <= 5; c += 1) {
    const cell = sTotal.getCell(c);
    cell.font = { bold: true, color: { argb: PAPER } };
    cell.fill = fill(INK);
  }
  sTotal.getCell(1).alignment = { indent: 1 };

  // Detalle accesorio: acento de marca en la pestaña.
  sheet.properties.tabColor = { argb: ACCENT };
  summary.properties.tabColor = { argb: ACCENT };

  // Impresión: apaisado, ajustado al ancho de una página.
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function budgetXlsxFilename(projectName: string): string {
  const safe = projectName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `presupuesto-${safe || "proyecto"}.xlsx`;
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
