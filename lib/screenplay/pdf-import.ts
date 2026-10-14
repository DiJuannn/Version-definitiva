// Importar un guion en PDF (exportado de Final Draft, Celtx, WriterDuet… o
// escrito en un procesador de texto) sin IA: se lee el texto con su
// posición en la página y se reconoce cada línea por dónde está y cómo es.
//
// - Encabezado: empieza por INT./EXT. (con o sin número delante: "3.EXT.").
// - Personaje: línea en mayúsculas, corta y sangrada (o centrada).
// - Acotación: entre paréntesis, dentro de un diálogo.
// - Diálogo: lo que sigue a un personaje hasta una línea en blanco.
// - Transición: "CORTE A:", "FUNDIDO A NEGRO."… o pegada a la derecha.
// - Acción: el resto, desde el margen izquierdo.
// Las cabeceras y pies que se repiten en todas las páginas se quitan.

import { SCENE_PREFIX, TRANSITION_PATTERN, type BlockType, type ScreenplayBlock } from "@/lib/screenplay/blocks";

type Line = { page: number; x: number; y: number; right: number; text: string; pageWidth: number; pageHeight: number };

const HEADING = /^(\d+[A-Z]?\s*[.)-]?\s*)?((?:INT|EXT)\.?\s*\/\s*(?:INT|EXT)|INT|EXT|I\/E|EST)\.?\s*(.*)$/i;
const isCaps = (s: string) => /\p{L}/u.test(s) && s === s.toUpperCase();
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

async function readLines(data: Uint8Array): Promise<Line[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data, useSystemFonts: false, disableFontFace: true });
  const doc = await task.promise;
  const lines: Line[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { width, height } = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    // Trozos de texto agrupados por altura (misma línea).
    const rows = new Map<number, { x: number; w: number; s: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = Math.round(item.transform[5] / 2) * 2;
      const row = rows.get(y) ?? [];
      row.push({ x, w: item.width, s: item.str });
      rows.set(y, row);
    }
    for (const [y, parts] of [...rows.entries()].sort((a, b) => b[0] - a[0])) {
      parts.sort((a, b) => a.x - b.x);
      let text = "";
      let end = parts[0].x;
      for (const part of parts) {
        if (text && part.x - end > 1.5 && !text.endsWith(" ") && !part.s.startsWith(" ")) text += " ";
        text += part.s;
        end = part.x + part.w;
      }
      lines.push({ page: p, x: parts[0].x, y, right: end, text: norm(text), pageWidth: width, pageHeight: height });
    }
    page.cleanup();
  }
  await task.destroy();
  return lines;
}

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(Math.round(v), (counts.get(Math.round(v)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 72;
}

export async function parseScreenplayPdf(
  data: Uint8Array,
): Promise<{ title: string | null; author: string | null; blocks: ScreenplayBlock[] }> {
  let lines = await readLines(data);
  const pages = new Set(lines.map((l) => l.page)).size;

  // Fuera cabeceras/pies repetidos y números de página (solo arriba y abajo
  // del todo: un "AUREL" que se repite en cada página es un personaje).
  const edge = (l: Line) => l.y > l.pageHeight * 0.88 || l.y < l.pageHeight * 0.08;
  const seen = new Map<string, Set<number>>();
  for (const l of lines.filter(edge)) {
    const key = l.text.toLowerCase();
    if (!seen.has(key)) seen.set(key, new Set());
    seen.get(key)!.add(l.page);
  }
  // Una cabecera repetida tipo "Grup: …" o "Autor: …" dice quién lo escribe.
  const repeated = (l: Line) => (seen.get(l.text.toLowerCase())?.size ?? 0) >= Math.max(3, pages * 0.5);
  const headerText = lines
    .filter((l) => l.page === 1 && edge(l) && repeated(l))
    .map((l) => l.text)
    .join(" ");
  const byline = headerText.match(/^(grup|grupo|autor(?:a|es|as)?|escrito por|guion de|guión de|written by)\s*:?\s*(.+)$/i);
  const author = byline ? byline[2].trim().slice(0, 200) : null;

  lines = lines.filter((l) => {
    if (!edge(l)) return true;
    if (/^(p[áa]g(ina)?\.?\s*)?\d+\s*\.?$/i.test(l.text)) return false;
    return pages < 3 || (seen.get(l.text.toLowerCase())?.size ?? 0) < Math.max(3, pages * 0.5);
  });
  if (!lines.length) return { title: null, author, blocks: [] };

  const margin = mode(lines.filter((l) => /^[\p{Ll}\p{Lu}]/u.test(l.text) && !isCaps(l.text)).map((l) => l.x));
  // Interlineado normal: la distancia más frecuente entre líneas seguidas.
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].page === lines[i - 1].page) gaps.push(lines[i - 1].y - lines[i].y);
  }
  const lineGap = mode(gaps.filter((g) => g > 4 && g < 40)) || 14;

  // Portada: lo que hay antes del primer encabezado.
  const firstHeading = lines.findIndex((l) => HEADING.test(l.text) && SCENE_PREFIX.test(`${l.text.replace(/^\d+[A-Z]?\s*[.)-]?\s*/, "")} `));
  const prelude = firstHeading > 0 ? lines.slice(0, firstHeading) : [];
  const titleLine = prelude.find((l) => isCaps(l.text) && l.text.length <= 60);
  const body = firstHeading >= 0 ? lines.slice(firstHeading) : lines;

  const blocks: ScreenplayBlock[] = [];
  let inDialogue = false;
  let prev: Line | null = null;
  const push = (type: BlockType, text: string) => blocks.push({ type, text });
  const last = () => blocks[blocks.length - 1];

  for (let i = 0; i < body.length; i++) {
    const l = body[i];
    const next = body[i + 1];
    const brokeParagraph = !prev || prev.page !== l.page ? true : prev.y - l.y > lineGap * 1.5;
    const newPage = !prev || prev.page !== l.page;
    const indent = l.x - margin;
    const text = l.text;
    prev = l;

    // Encabezado ("1. EXT. PISTA DE TENIS - DÍA", "3.EXT.CALLE 1 - DÍA").
    const h = text.match(HEADING);
    if (h && indent < 30 && isCaps(text.replace(/\(.*?\)/g, ""))) {
      const kind = h[2].toUpperCase().replace(/\s+/g, "");
      const prefix = kind.endsWith(".") ? kind : `${kind}.`;
      push("sceneHeading", `${prefix} ${h[3].trim()}`.trim());
      inDialogue = false;
      continue;
    }

    // Transición.
    const flushRight = l.pageWidth - l.right < l.pageWidth * 0.2 && indent > l.pageWidth * 0.35;
    if (isCaps(text) && (TRANSITION_PATTERN.test(text) || /^(FUNDIDO A NEGRO|FADE (IN|OUT)|CORTE A|FIN|THE END)[.:]?$/.test(text) || (flushRight && text.endsWith(":")))) {
      push("transition", text);
      inDialogue = false;
      continue;
    }

    // Personaje: mayúsculas, corto, sangrado y con algo debajo.
    const bare = text.replace(/\(.*?\)/g, "").trim();
    const nextIndented = next && next.x - margin > 8; // el diálogo puede seguir en la página siguiente
    if (indent > 40 && isCaps(bare) && bare.length <= 40 && !/[.!?…:]$/.test(bare) && nextIndented) {
      push("character", text);
      inDialogue = true;
      continue;
    }

    if (inDialogue && (!brokeParagraph || (newPage && indent > 8))) {
      const prevBlock = last();
      if (text.startsWith("(") || (prevBlock?.type === "parenthetical" && !prevBlock.text.endsWith(")"))) {
        if (prevBlock?.type === "parenthetical" && !prevBlock.text.endsWith(")")) prevBlock.text += ` ${text}`;
        else push("parenthetical", text);
        continue;
      }
      if (prevBlock?.type === "dialogue") prevBlock.text += ` ${text}`;
      else push("dialogue", text);
      continue;
    }
    inDialogue = false;

    // Acción: se juntan las líneas de un mismo párrafo.
    const prevBlock = last();
    if (!brokeParagraph && prevBlock?.type === "action") {
      // Una línea corta acabada en punto era un salto de línea a propósito.
      const prevLine = body[i - 1];
      const intended = prevLine && /[.:!?…]$/.test(prevLine.text) && prevLine.right < l.pageWidth * 0.62;
      prevBlock.text += intended ? `\n${text}` : ` ${text}`;
    } else {
      push("action", text);
    }
  }

  return { title: titleLine ? titleLine.text : null, author, blocks };
}
