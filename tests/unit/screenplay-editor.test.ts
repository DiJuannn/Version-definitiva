import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import type { DecorationSet } from "@tiptap/pm/view";
import {
  enterCommand,
  escapeCommand,
  getNotice,
  getSuggestions,
  moveSuggestionCommand,
  pasteTextTr,
  runNoticeActionCommand,
  sceneIndex,
  screenplayNodes,
  screenplayPlugins,
  setLineTypeCommand,
  shiftTabCommand,
  tabCommand,
  arrowRightCommand,
} from "@/lib/screenplay/editor-extensions";
import { ENTER_NEXT, TAB_NEXT, type BlockType } from "@/lib/screenplay/blocks";

const schema = getSchema([Document, Text, ...screenplayNodes]);

type B = [BlockType, string, string?];

function makeState(blocks: B[], cursor?: { block: number; offset?: number }) {
  const nodes = blocks.map(([type, text, sid]) =>
    schema.nodes[type].create(type === "sceneHeading" ? { sid: sid ?? `s${Math.random()}` } : null, text ? schema.text(text) : null),
  );
  const doc = schema.nodes.doc.create(null, nodes);
  let state = EditorState.create({ schema, doc, plugins: screenplayPlugins({ inlineNotices: true }) });
  const target = cursor ?? { block: blocks.length - 1 };
  let pos = 0;
  for (let i = 0; i < target.block; i++) pos += doc.child(i).nodeSize;
  const node = doc.child(target.block);
  const offset = target.offset ?? node.content.size;
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, pos + 1 + offset)));
  return state;
}

// Un editor mínimo sin DOM: aplica comandos y escribe como el teclado.
class Ed {
  state: EditorState;
  constructor(blocks: B[], cursor?: { block: number; offset?: number }) {
    this.state = makeState(blocks, cursor);
  }
  dispatch = (tr: Transaction) => {
    this.state = this.state.apply(tr);
  };
  run(cmd: (s: EditorState, d?: (tr: Transaction) => void) => boolean) {
    return cmd(this.state, this.dispatch);
  }
  type(text: string) {
    for (const ch of text) this.dispatch(this.state.tr.insertText(ch));
    return this;
  }
  enter() {
    this.run(enterCommand);
    return this;
  }
  tab() {
    this.run(tabCommand);
    return this;
  }
  blocks(): [string, string][] {
    const out: [string, string][] = [];
    this.state.doc.forEach((n) => out.push([n.type.name, n.textContent]));
    return out;
  }
  get current() {
    return this.state.selection.$from.parent.type.name;
  }
}

describe("Enter y Tab", () => {
  it.each(Object.entries(ENTER_NEXT) as [BlockType, BlockType][])("Enter al final de %s → %s", (type, next) => {
    const text = type === "parenthetical" ? "(bajito)" : type === "sceneHeading" ? "INT. CASA - DÍA" : type === "character" ? "LUCÍA" : type === "transition" ? "CORTE A:" : "Algo";
    const ed = new Ed([["sceneHeading", "INT. BAR - NOCHE"], [type, text]]);
    ed.enter();
    expect(ed.current).toBe(next);
  });

  it.each(Object.entries(TAB_NEXT) as [BlockType, BlockType][])("Tab en %s → %s", (type, next) => {
    const ed = new Ed([["sceneHeading", "INT. BAR - NOCHE"], [type, type === "parenthetical" ? "(x)" : "x"]]);
    ed.tab();
    expect(ed.current).toBe(next);
  });

  it("Shift+Tab deshace el camino de Tab", () => {
    const ed = new Ed([["sceneHeading", "INT. BAR - NOCHE"], ["character", "LUCÍA"]]);
    ed.run(shiftTabCommand);
    expect(ed.current).toBe("action");
  });

  it("trampa del Enter: tras un diálogo, un Enter vuelve a «Lo que se ve»", () => {
    const ed = new Ed([["sceneHeading", "INT. COCINA - DÍA"], ["action", "Hace sol."]]);
    ed.enter().tab().type("Lucía").enter().type("Algún día será mía.").enter();
    expect(ed.current).toBe("action");
    ed.type("Lucía cierra la ventana.");
    expect(ed.blocks().slice(-3)).toEqual([
      ["character", "Lucía"],
      ["dialogue", "Algún día será mía."],
      ["action", "Lucía cierra la ventana."],
    ]);
  });

  it("intercambio rápido de diálogos: Enter y Tab", () => {
    const ed = new Ed([["sceneHeading", "INT. COCINA - DÍA"], ["dialogue", "Hola."]]);
    ed.enter().tab();
    expect(ed.current).toBe("character");
  });

  it("una línea vacía de «Quién habla» vuelve a «Lo que se ve» con un Enter", () => {
    const ed = new Ed([["sceneHeading", "INT. COCINA - DÍA"], ["character", ""]]);
    ed.enter();
    expect(ed.blocks()).toEqual([
      ["sceneHeading", "INT. COCINA - DÍA"],
      ["action", ""],
    ]);
  });

  it("una descripción escrita como «Quién habla» pasa a «Lo que se ve» con aviso", () => {
    const ed = new Ed([["sceneHeading", "INT. COCINA - DÍA"], ["character", "Lucía cierra la ventana y suspira."]]);
    ed.enter();
    expect(ed.blocks()).toEqual([
      ["sceneHeading", "INT. COCINA - DÍA"],
      ["action", "Lucía cierra la ventana y suspira."],
      ["action", ""],
    ]);
    expect(getNotice(ed.state)?.kind).toBe("character-to-action");
    ed.run(runNoticeActionCommand);
    expect(ed.blocks()[1]).toEqual(["character", "Lucía cierra la ventana y suspira."]);
    // Un nombre largo en mayúsculas es un nombre.
    const pro = new Ed([["sceneHeading", "INT. COCINA - DÍA"], ["character", "EL HOMBRE DEL SOMBRERO GRIS"]]);
    pro.enter();
    expect(pro.current).toBe("dialogue");
  });

  it("«(» en un diálogo vacío y Enter en una acotación vacía", () => {
    const ed = new Ed([["sceneHeading", "INT. BAR - NOCHE"], ["dialogue", ""]]);
    ed.run(setLineTypeCommand("parenthetical"));
    expect(ed.blocks()[1]).toEqual(["parenthetical", "()"]);
    ed.enter();
    expect(ed.blocks()[1]).toEqual(["dialogue", ""]);
  });

  it("Enter al principio de una línea con texto deja un hueco encima sin robar el id de la escena", () => {
    const ed = new Ed([["sceneHeading", "INT. BAR - NOCHE", "keep"]], { block: 0, offset: 0 });
    ed.enter();
    const [a, b] = [ed.state.doc.child(0), ed.state.doc.child(1)];
    expect(a.textContent).toBe("");
    expect(b.textContent).toBe("INT. BAR - NOCHE");
    expect(b.attrs.sid).toBe("keep");
    expect(a.attrs.sid).not.toBe("keep");
  });

  it("partir una línea por la mitad conserva el tipo de las dos mitades", () => {
    const ed = new Ed([["sceneHeading", "INT. BAR - NOCHE"], ["dialogue", "Hola, qué tal"]], { block: 1, offset: 5 });
    ed.enter();
    expect(ed.blocks().slice(1)).toEqual([
      ["dialogue", "Hola,"],
      ["dialogue", " qué tal"],
    ]);
  });
});

describe("CORTE A: (B3)", () => {
  it("20 veces seguidas: transición y luego un encabezado aparte, sin errores", () => {
    const ed = new Ed([["sceneHeading", "INT. BAR - NOCHE"], ["character", "MARTA"], ["dialogue", "Vámonos."]]);
    for (let i = 0; i < 20; i++) {
      ed.enter();
      expect(ed.current).toBe("action");
      ed.type("CORTE A");
      ed.dispatch(ed.state.tr.insertText(":"));
      ed.enter();
      expect(ed.current).toBe("sceneHeading");
      ed.type(`ext. calle ${i} - día`).enter().tab().type("MARTA").enter().type("Ya.");
    }
    const kinds = ed.blocks().filter(([, t]) => /CORTE/i.test(t));
    expect(kinds).toHaveLength(20);
    expect(kinds.every(([type]) => type === "transition")).toBe(true);
    expect(ed.blocks().some(([, t]) => /CORTE A:.*EXT/i.test(t))).toBe(false);
  });

  it("en minúsculas también («corte a:»)", () => {
    const ed = new Ed([["sceneHeading", "INT. BAR - NOCHE"], ["action", "corte a:"]]);
    ed.enter();
    expect(ed.blocks()[1][0]).toBe("transition");
    expect(ed.current).toBe("sceneHeading");
  });

  it("«Le dijo a:» no es una transición", () => {
    const ed = new Ed([["sceneHeading", "INT. BAR - NOCHE"], ["action", "Le dijo a:"]]);
    ed.enter();
    expect(ed.blocks()[1][0]).toBe("action");
  });
});

describe("primera frase escrita como «Lugar y hora» (B4)", () => {
  it("se queda como «Lo que se ve», con un encabezado vacío encima y aviso", () => {
    const ed = new Ed([["sceneHeading", "", "s1"]], { block: 0 });
    ed.type("Mi abuela vive sola en un pueblo de montaña.").enter();
    expect(ed.blocks()).toEqual([
      ["sceneHeading", ""],
      ["action", "Mi abuela vive sola en un pueblo de montaña."],
      ["action", ""],
    ]);
    expect(ed.state.doc.child(0).attrs.sid).toBe("s1");
    expect(ed.current).toBe("action");
    const notice = getNotice(ed.state);
    expect(notice?.kind).toBe("heading-to-action");
    expect(notice?.message).toMatch(/Lo que se ve/);
    // Deshacer: vuelve a ser el encabezado (con su id).
    ed.run(runNoticeActionCommand);
    expect(ed.blocks()[0]).toEqual(["sceneHeading", "MI ABUELA VIVE SOLA EN UN PUEBLO DE MONTAÑA."]);
    expect(ed.state.doc.child(0).attrs.sid).toBe("s1");
  });

  it.each(["INT. COCINA - NOCHE", "cocina de Lucía - noche", "COCINA", "CASA DE LA ABUELA DE LUCÍA", "int. casa"])("«%s» se queda como encabezado", (text) => {
    const ed = new Ed([["sceneHeading", text]], { block: 0 });
    ed.enter();
    expect(ed.blocks()[0][0]).toBe("sceneHeading");
    expect(ed.current).toBe("action");
  });

  it("Enter en el primer «Lugar y hora» vacío lo deja para luego y baja a «Lo que se ve»", () => {
    const ed = new Ed([["sceneHeading", ""]], { block: 0 });
    ed.enter();
    expect(ed.blocks()).toEqual([
      ["sceneHeading", ""],
      ["action", ""],
    ]);
  });
});

describe("autocompletado (B5 y 4.2)", () => {
  const cast: B[] = [
    ["sceneHeading", "INT. CASA DE LUCÍA - NOCHE"],
    ["character", "ANABEL"],
    ["dialogue", "Hola."],
    ["character", "ANABEL"],
    ["dialogue", "Otra vez."],
    ["character", "ANDRÉS"],
    ["dialogue", "Sí."],
    ["action", "AUREL (23) entra sin llamar."],
    ["sceneHeading", "EXT. CALLE - DÍA"],
  ];

  it("lista de candidatos ordenada por uso, con los nombrados en la acción", () => {
    const ed = new Ed([...cast, ["character", ""]]);
    ed.type("A");
    const s = getSuggestions(ed.state);
    expect(s?.items).toEqual(["ANABEL", "ANDRÉS", "AUREL"]);
  });

  it("Enter no acepta: se puede escribir ANA aunque exista ANABEL", () => {
    const ed = new Ed([...cast, ["character", ""]]);
    ed.type("ANA").enter();
    expect(ed.blocks().at(-2)).toEqual(["character", "ANA"]);
    expect(ed.current).toBe("dialogue");
  });

  it("Tab y → aceptan", () => {
    const a = new Ed([...cast, ["character", ""]]);
    a.type("ANA").tab();
    expect(a.blocks().at(-1)).toEqual(["character", "ANABEL"]);
    const b = new Ed([...cast, ["character", ""]]);
    b.type("ANA");
    b.run(arrowRightCommand);
    expect(b.blocks().at(-1)).toEqual(["character", "ANABEL"]);
  });

  it("Esc la descarta hasta el siguiente carácter; entonces Tab cambia el tipo", () => {
    const ed = new Ed([...cast, ["character", ""]]);
    ed.type("AN");
    ed.run(escapeCommand);
    expect(getSuggestions(ed.state)).toBeNull();
    ed.tab();
    expect(ed.blocks().at(-1)).toEqual(["action", "AN"]);
    const again = new Ed([...cast, ["character", ""]]);
    again.type("AN");
    again.run(escapeCommand);
    again.type("D");
    expect(getSuggestions(again.state)?.items).toEqual(["ANDRÉS"]);
  });

  it("con las flechas se elige y entonces Enter sí acepta", () => {
    const ed = new Ed([...cast, ["character", ""]]);
    ed.type("AN");
    ed.run(moveSuggestionCommand(1));
    expect(getSuggestions(ed.state)?.index).toBe(1);
    ed.enter();
    expect(ed.blocks().at(-2)).toEqual(["character", "ANDRÉS"]);
  });

  it("lugares ya usados con el prefijo escrito, y DÍA/NOCHE tras el guion (lista cerrada: Enter acepta)", () => {
    const ed = new Ed([...cast, ["sceneHeading", ""]]);
    ed.type("ext. ca");
    expect(getSuggestions(ed.state)?.items[0]).toBe("EXT. CALLE - DÍA");
    ed.type("lle -");
    const s = getSuggestions(ed.state);
    expect(s?.kind).toBe("time");
    expect(s?.items[0]).toBe(" DÍA");
    ed.type(" no").enter();
    expect(ed.blocks().at(-2)).toEqual(["sceneHeading", "EXT. CALLE - NOCHE"]);
  });

  it("INT./EXT. al empezar", () => {
    const ed = new Ed([["sceneHeading", ""]], { block: 0 });
    ed.type("e");
    expect(getSuggestions(ed.state)?.items).toEqual(["EXT. "]);
    ed.tab();
    expect(ed.blocks()[0]).toEqual(["sceneHeading", "EXT. "]);
  });
});

describe("pegar (B2)", () => {
  const sample = "INT. BAR - NOCHE\nMarta entra empapada.\nMARTA\n¿Has visto a Lucía?";

  it("texto de Word (un párrafo por línea) se reconoce como guion, con aviso", () => {
    const ed = new Ed([["sceneHeading", ""]], { block: 0 });
    ed.dispatch(pasteTextTr(ed.state, sample)!);
    expect(ed.blocks()).toEqual([
      ["sceneHeading", "INT. BAR - NOCHE"],
      ["action", "Marta entra empapada."],
      ["character", "MARTA"],
      ["dialogue", "¿Has visto a Lucía?"],
    ]);
    const n = getNotice(ed.state);
    expect(n?.message).toBe("Pegado como guion: 1 escena, 1 personaje. ¿No era eso?");
    ed.run(runNoticeActionCommand);
    expect(ed.blocks().map(([t]) => t)).toEqual(["action", "action", "action", "action"]);
  });

  it("Fountain con líneas en blanco", () => {
    const ed = new Ed([["sceneHeading", "INT. CASA - DÍA"], ["action", ""]]);
    ed.dispatch(pasteTextTr(ed.state, "EXT. CALLE - NOCHE\n\nLlueve.\n\nMARTA\n(sin aliento)\nCorre.\n\nCORTE A:\n")!);
    expect(ed.blocks().slice(1)).toEqual([
      ["sceneHeading", "EXT. CALLE - NOCHE"],
      ["action", "Llueve."],
      ["character", "MARTA"],
      ["parenthetical", "(sin aliento)"],
      ["dialogue", "Corre."],
      ["transition", "CORTE A:"],
    ]);
  });

  it("una sola línea va a la línea actual sin cambiarle el tipo", () => {
    const ed = new Ed([["sceneHeading", "INT. CASA - DÍA"], ["dialogue", "Hola, "]]);
    ed.dispatch(pasteTextTr(ed.state, "INT. OTRO SITIO")!);
    expect(ed.blocks()[1]).toEqual(["dialogue", "Hola, INT. OTRO SITIO"]);
    expect(getNotice(ed.state)).toBeNull();
  });

  it("solo descripciones: sin aviso", () => {
    const ed = new Ed([["sceneHeading", "INT. CASA - DÍA"], ["action", "Uno."]]);
    ed.dispatch(pasteTextTr(ed.state, "Dos.\nTres.")!);
    expect(ed.blocks().slice(1)).toEqual([
      ["action", "Uno."],
      ["action", "Dos."],
      ["action", "Tres."],
    ]);
    expect(getNotice(ed.state)).toBeNull();
  });
});

describe("mayúsculas del encabezado al salir de la línea (P9)", () => {
  it("«díA» → «DÍA» al pasar a otra línea, no mientras se escribe", () => {
    const ed = new Ed([["sceneHeading", ""]], { block: 0 });
    ed.type("int. casa - día");
    expect(ed.blocks()[0][1]).toBe("int. casa - día");
    ed.enter();
    expect(ed.blocks()[0][1]).toBe("INT. CASA - DÍA");
  });
});

describe("números de escena en el editor (M3, M7)", () => {
  const numbers = (state: EditorState) => {
    const plugin = state.plugins.find((p) => (p as unknown as { key: string }).key.startsWith("sp-scene-numbers"))!;
    const set = plugin.props.decorations!.call(plugin, state) as DecorationSet;
    return set.find().map((d) => (d.spec as { key: string }).key).filter((k) => k.endsWith("left"));
  };

  it("cuentan las escenas sin encabezado con algo escrito, igual que el PDF", () => {
    const ed = new Ed([
      ["sceneHeading", "INT. A - DÍA"],
      ["action", "x"],
      ["sceneHeading", ""],
      ["note", "Una idea."],
      ["sceneHeading", ""],
      ["sceneHeading", "INT. B - DÍA"],
    ]);
    expect(numbers(ed.state)).toEqual(["scene-1-left", "scene-2-left", "scene-3-left"]);
    expect(sceneIndex(ed.state).headings.map((h) => h.number)).toEqual([1, 2, null, 3]);
  });

  it("al escribir dentro de una escena no se rehacen (se desplazan)", () => {
    const ed = new Ed([["sceneHeading", "INT. A - DÍA"], ["action", "x"], ["sceneHeading", "INT. B - DÍA"], ["action", ""]]);
    const plugin = ed.state.plugins.find((p) => (p as unknown as { key: string }).key.startsWith("sp-scene-numbers"))!;
    const before = plugin.getState(ed.state) as { sig: string };
    ed.type("hola");
    const after = plugin.getState(ed.state) as { sig: string };
    expect(after.sig).toBe(before.sig);
    expect(numbers(ed.state)).toEqual(["scene-1-left", "scene-2-left"]);
  });

  it("si se reemplaza todo el documento con la misma estructura (Yjs al cargar), siguen ahí", () => {
    const ed = new Ed([["sceneHeading", ""], ["action", "x"], ["sceneHeading", "INT. B - DÍA"], ["action", "y"]]);
    const doc = ed.state.doc;
    ed.dispatch(ed.state.tr.replaceWith(0, doc.content.size, doc.content));
    expect(numbers(ed.state)).toEqual(["scene-1-left", "scene-2-left"]);
  });

  it("rendimiento: una tecla en un guion de ~110 páginas tarda menos de 16 ms en el estado", () => {
    const blocks: B[] = [];
    for (let i = 0; i < 400; i++) {
      blocks.push(["sceneHeading", `INT. LUGAR ${i} - DÍA`]);
      blocks.push(["action", "Marta cruza la habitación sin decir nada y se sienta junto a la ventana."]);
      blocks.push(["character", i % 2 ? "MARTA" : "ANABEL"]);
      blocks.push(["dialogue", "No sé si puedo seguir con esto, de verdad que no lo sé."]);
      blocks.push(["character", "LUCÍA"]);
      blocks.push(["dialogue", "Pues decide pronto."]);
    }
    blocks.push(["character", ""]);
    const ed = new Ed(blocks);
    const plugins = ed.state.plugins;
    const deco = () => plugins.forEach((p) => p.props.decorations?.call(p, ed.state));
    ed.type("AN"); // calentar
    deco();
    const times: number[] = [];
    for (const ch of "ABEL MARTA") {
      const t0 = performance.now();
      ed.dispatch(ed.state.tr.insertText(ch));
      deco();
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    expect(times[Math.floor(times.length / 2)]).toBeLessThan(16);
  });
});
