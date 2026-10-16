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
  UNTITLED_HEADING,
  looksLikeTransition,
  sceneNumbering,
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

  // Las escenas sin encabezado salen con uno de relleno, como en el PDF:
  // así el número de cada escena es el mismo en todas partes.
  const numbers = sceneNumbering(blocks);
  let prev: BlockType | null = null;
  for (const [i, b] of blocks.entries()) {
    const text = b.text.trim() || (b.type === "sceneHeading" && numbers.has(i) ? UNTITLED_HEADING : "");
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

// ------------------------------------------------------------------ pegar

// Texto pegado desde Word, Google Docs, un correo o un .fountain: se
// reconoce como guion. Si trae líneas en blanco entre párrafos, es Fountain
// tal cual. Si no (lo normal al copiar de un procesador de textos: un
// párrafo por línea), cada línea se clasifica por su forma y su contexto:
//
//   INT. BAR - NOCHE          → Lugar y hora
//   Marta entra empapada.     → Lo que se ve
//   MARTA                     → Quién habla (mayúsculas, corta, sin punto final, con algo debajo)
//   (sin aliento)             → Cómo lo dice
//   ¿Has visto a Lucía?       → Lo que dice (una línea tras el nombre o la acotación)
//   CORTE A:                  → Cambio de escena
export function parsePastedText(source: string): ScreenplayBlock[] {
  const text = source.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").replace(/\t/g, "    ");
  const trimmed = text.replace(/^\s*\n|\n\s*$/g, "");
  if (/\n[ \t]*\n/.test(trimmed)) return parseFountain(trimmed).blocks;

  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  const blocks: ScreenplayBlock[] = [];
  const isName = (l: string) => {
    const bare = l.replace(/\(.*?\)/g, "").replace(/^@/, "").trim();
    return (
      (l.startsWith("@") || (/\p{L}/u.test(bare) && bare === bare.toUpperCase())) &&
      bare.length <= 38 &&
      !/[.!?:,;]$/.test(bare) &&
      bare.split(/\s+/).length <= 4
    );
  };
  // Estado: tras un nombre o una acotación viene lo que dice.
  let expect: "any" | "dialogue" | "afterDialogue" = "any";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];

    if (expect === "dialogue") {
      if (/^\(.*\)$/.test(line)) {
        blocks.push({ type: "parenthetical", text: line });
        continue;
      }
      blocks.push({ type: "dialogue", text: line });
      expect = "afterDialogue";
      continue;
    }
    // Una acotación justo después de lo que dice: sigue hablando.
    if (expect === "afterDialogue" && /^\(.*\)$/.test(line) && next !== undefined) {
      blocks.push({ type: "parenthetical", text: line });
      expect = "dialogue";
      continue;
    }
    expect = "any";

    if (/^\[\[[\s\S]*\]\]$/.test(line)) blocks.push({ type: "note", text: line.slice(2, -2).trim() });
    else if (SCENE_PREFIX.test(line) || /^\.[^.]/.test(line)) {
      const heading = line.startsWith(".") && !SCENE_PREFIX.test(line) ? line.slice(1) : line;
      blocks.push({ type: "sceneHeading", text: heading.toUpperCase() });
    } else if (line.startsWith(">") && !line.endsWith("<")) blocks.push({ type: "transition", text: line.slice(1).trim().toUpperCase() });
    else if (looksLikeTransition(line) || /^(FADE (IN|OUT)|FUNDIDO A NEGRO)[.:]?$/.test(line)) blocks.push({ type: "transition", text: line.toUpperCase() });
    else if (line.startsWith("!")) blocks.push({ type: "action", text: line.slice(1).trim() });
    else if (isName(line) && next !== undefined && !SCENE_PREFIX.test(next) && !isName(next)) {
      blocks.push({ type: "character", text: line.replace(/^@/, "").replace(/\s*\^$/, "") });
      expect = "dialogue";
    } else blocks.push({ type: "action", text: line });
  }
  return blocks.filter((b) => b.text);
}
