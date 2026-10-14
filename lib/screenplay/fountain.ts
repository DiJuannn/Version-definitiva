// Fountain (https://fountain.io): formato abierto de guion en texto plano.
// Importar y exportar en Fountain hace que el guion nunca quede encerrado en
// Taller: se abre en Highland, WriterSolo, Beat, Final Draft (importando)…
//
// Solo se cubre lo que el editor sabe representar. Lo que Fountain tiene y
// el editor no (secciones #, sinopsis =, saltos ===, énfasis *…*) se
// convierte en nota o se pasa a texto plano, nunca se pierde el contenido.

import {
  SCENE_PREFIX,
  TRANSITION_PATTERN,
  type BlockType,
  type ScreenplayBlock,
} from "@/lib/screenplay/blocks";

export type TitlePage = {
  title?: string;
  credit?: string;
  author?: string;
  source?: string;
  draftDate?: string;
  contact?: string;
};

const TITLE_KEYS: Record<string, keyof TitlePage> = {
  title: "title",
  título: "title",
  titulo: "title",
  credit: "credit",
  author: "author",
  authors: "author",
  autor: "author",
  autora: "author",
  source: "source",
  "draft date": "draftDate",
  contact: "contact",
  contacto: "contact",
};

const isUpper = (s: string) => /\p{L}/u.test(s) && s === s.toUpperCase();

// *cursiva*, **negrita**, _subrayado_ → texto sin marcas.
function stripEmphasis(s: string): string {
  return s
    .replace(/\\([*_])/g, "\u0000$1")
    .replace(/\*{1,3}(?=\S)(.+?)(?<=\S)\*{1,3}/g, "$1")
    .replace(/_(?=\S)(.+?)(?<=\S)_/g, "$1")
    .replace(/\u0000/g, "");
}

function parseTitlePage(lines: string[]): { titlePage: TitlePage; rest: string[] } {
  const first = lines.findIndex((l) => l.trim() !== "");
  if (first === -1 || !/^[^\s:][^:]*:/.test(lines[first])) return { titlePage: {}, rest: lines };
  const key = lines[first].split(":")[0].trim().toLowerCase();
  if (!(key in TITLE_KEYS)) return { titlePage: {}, rest: lines };

  const titlePage: TitlePage = {};
  let current: keyof TitlePage | null = null;
  let i = first;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") break;
    const m = line.match(/^([^\s:][^:]*):\s*(.*)$/);
    if (m && !/^\s/.test(line)) {
      current = TITLE_KEYS[m[1].trim().toLowerCase()] ?? null;
      if (current && m[2]) titlePage[current] = stripEmphasis(m[2].trim());
    } else if (current) {
      const prev = titlePage[current];
      titlePage[current] = prev ? `${prev}\n${stripEmphasis(line.trim())}` : stripEmphasis(line.trim());
    }
  }
  return { titlePage, rest: lines.slice(i) };
}

export function parseFountain(source: string): { titlePage: TitlePage; blocks: ScreenplayBlock[] } {
  // Fuera "boneyard" (/* … */) y normalizados los saltos de línea.
  const text = source.replace(/\r\n?/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const { titlePage, rest } = parseTitlePage(text.split("\n"));
  const lines = rest;
  const blocks: ScreenplayBlock[] = [];
  const push = (type: BlockType, raw: string) => {
    const t = stripEmphasis(raw).trim();
    if (t) blocks.push({ type, text: t });
  };

  let inDialogue = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    const prevBlank = i === 0 || lines[i - 1].trim() === "";
    const nextLine = lines[i + 1];
    const nextBlank = nextLine === undefined || nextLine.trim() === "";

    if (line === "") {
      inDialogue = false;
      continue;
    }

    if (inDialogue) {
      if (/^\(.*\)$/.test(line)) push("parenthetical", line);
      else push("dialogue", line);
      continue;
    }

    // Nota de línea entera [[ … ]], sección # y sinopsis = → nota.
    if (/^\[\[[\s\S]*\]\]$/.test(line)) {
      push("note", line.slice(2, -2));
      continue;
    }
    if (/^#+\s*/.test(line)) {
      push("note", line.replace(/^#+\s*/, ""));
      continue;
    }
    if (/^=(?!==)/.test(line)) {
      push("note", line.slice(1));
      continue;
    }
    if (/^={3,}$/.test(line)) continue; // salto de página forzado

    // Acción forzada con "!".
    if (line.startsWith("!")) {
      push("action", line.slice(1));
      continue;
    }

    // Encabezado: INT./EXT./… o forzado con "." (pero no "...").
    if (prevBlank && (SCENE_PREFIX.test(line) || /^\.[^.]/.test(line))) {
      const heading = line.startsWith(".") && !SCENE_PREFIX.test(line) ? line.slice(1) : line;
      push("sceneHeading", heading.replace(/\s*#[^#]*#\s*$/, "").toUpperCase());
      continue;
    }

    // Centrado >texto< → acción.
    if (/^>.*<$/.test(line)) {
      push("action", line.slice(1, -1));
      continue;
    }

    // Transición: forzada con ">" o mayúsculas acabadas en TO:/A:.
    if (line.startsWith(">")) {
      push("transition", line.slice(1).toUpperCase());
      continue;
    }
    if (prevBlank && nextBlank && isUpper(line) && (TRANSITION_PATTERN.test(line) || /^(FADE (IN|OUT)|FUNDIDO A NEGRO)[.:]?$/.test(line))) {
      push("transition", line);
      continue;
    }

    // Personaje: forzado con "@", o mayúsculas con texto debajo.
    if (line.startsWith("@") || (prevBlank && !nextBlank && isUpper(line.replace(/\(.*?\)/g, "")) && !/[.!?]$/.test(line.replace(/\(.*?\)/g, "").trim()))) {
      push("character", line.replace(/^@/, "").replace(/\s*\^$/, ""));
      inDialogue = true;
      continue;
    }

    // Lírica (~) y todo lo demás: acción. Las líneas seguidas se juntan.
    const actionText = line.replace(/^~\s*/, "");
    const last = blocks[blocks.length - 1];
    if (!prevBlank && last?.type === "action") last.text += `\n${stripEmphasis(actionText)}`;
    else push("action", actionText);
  }

  return { titlePage, blocks };
}

// ------------------------------------------------------------------ exportar

export function toFountain(blocks: ScreenplayBlock[], titlePage: TitlePage = {}): string {
  const out: string[] = [];

  const tp: [string, string | undefined][] = [
    ["Title", titlePage.title],
    ["Credit", titlePage.credit],
    ["Author", titlePage.author],
    ["Source", titlePage.source],
    ["Draft date", titlePage.draftDate],
    ["Contact", titlePage.contact],
  ];
  const tpLines = tp
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => {
      const parts = v!.trim().split("\n");
      return parts.length === 1 ? `${k}: ${parts[0]}` : `${k}:\n${parts.map((p) => `    ${p}`).join("\n")}`;
    });
  if (tpLines.length) out.push(tpLines.join("\n"));

  let prev: BlockType | null = null;
  for (const b of blocks) {
    const text = b.text.trim();
    if (!text) continue;
    const inDialogue = (b.type === "dialogue" || b.type === "parenthetical") &&
      (prev === "character" || prev === "dialogue" || prev === "parenthetical");
    if (!inDialogue && out.length) out.push("");

    switch (b.type) {
      case "sceneHeading": {
        const upper = text.toUpperCase();
        out.push(SCENE_PREFIX.test(upper) ? upper : `.${upper}`);
        break;
      }
      case "character": {
        const upper = text.toUpperCase();
        out.push(/\p{L}/u.test(upper.replace(/\(.*?\)/g, "")) ? upper : `@${upper}`);
        break;
      }
      case "parenthetical":
        out.push(text.startsWith("(") ? text : `(${text})`);
        break;
      case "dialogue":
        out.push(text);
        break;
      case "transition": {
        const upper = text.toUpperCase();
        out.push(/ TO:$/.test(upper) ? upper : `> ${upper}`);
        break;
      }
      case "shot":
        out.push(`!${text.toUpperCase()}`);
        break;
      case "note":
        out.push(`[[${text}]]`);
        break;
      case "action": {
        // Una acción toda en mayúsculas se leería como personaje o transición.
        const lines = text.split("\n");
        out.push(isUpper(lines[0]) ? `!${text}` : text);
        break;
      }
    }
    prev = b.type;
  }

  return `${out.join("\n").trim()}\n`;
}
