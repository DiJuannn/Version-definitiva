import { describe, expect, it } from "vitest";
import {
  KEYBAR,
  LINE_MENU,
  PANELS,
  doubtsLabel,
  exportItems,
  isPanelId,
  isSidePanel,
  keybarAction,
  keyboardInset,
  lineKeyHintText,
  lineKeyHints,
  saveIndicator,
  sceneScrollTop,
  screenTime,
} from "@/components/screenplay/editor-chrome";
import { BLOCK_TYPES } from "@/lib/screenplay/blocks";

describe("paneles junto a la página", () => {
  it("se llaman con el vocabulario común y explican qué son", () => {
    expect(PANELS.map((p) => p.label)).toEqual(["Tu historia", "Ideas sueltas", "Esta escena", "Rodaje"]);
    for (const p of PANELS) expect(p.description.length).toBeGreaterThan(20);
  });

  it("conserva los ids guardados de antes (localStorage)", () => {
    for (const id of ["estructura", "ideas", "notas", "radiografia"]) expect(isPanelId(id)).toBe(true);
    expect(isPanelId("")).toBe(false);
    expect(isPanelId("estructuraX")).toBe(false);
  });

  it("solo «Esta escena» y «Rodaje» van a la derecha (u hoja inferior en pantallas estrechas)", () => {
    expect(isSidePanel("notas")).toBe(true);
    expect(isSidePanel("radiografia")).toBe(true);
    expect(isSidePanel("estructura")).toBe(false);
    expect(isSidePanel(null)).toBe(false);
  });
});

describe("tipo de línea", () => {
  it("el menú tiene cada tipo una sola vez, con lo de todos los días primero", () => {
    const all = LINE_MENU.flatMap((g) => g.types);
    expect([...all].sort()).toEqual([...BLOCK_TYPES].sort());
    expect(LINE_MENU[0].types.slice(0, 3)).toEqual(["sceneHeading", "action", "character"]);
  });

  it("las pistas se leen como frases: «Enter → Lo que se ve · Tab → Quién habla»", () => {
    expect(lineKeyHintText("action", false)).toBe("Enter → Lo que se ve · Tab → Quién habla");
    expect(lineKeyHintText("character", false)).toBe("Enter → Lo que dice · Tab → Lo que se ve");
    expect(lineKeyHintText("dialogue", false)).toBe("Enter → Lo que se ve · Tab → Cómo lo dice");
  });

  it("en una línea vacía, Enter cambia esa línea (y lo dice)", () => {
    const [enter] = lineKeyHints("character", true);
    expect(enter.label).toBe("Lo que se ve");
    expect(enter.change).toBe(true);
    // «Lugar y hora» vacío no cambia: la línea nueva va debajo.
    expect(lineKeyHints("sceneHeading", true)[0]).toMatchObject({ label: "Lo que se ve", change: false });
  });
});

describe("barra encima del teclado (B7)", () => {
  it("tiene Lugar · Lo que se ve · Quién habla · (Cómo)", () => {
    expect(KEYBAR.map((k) => k.label)).toEqual(["Lugar", "Lo que se ve", "Quién habla", "(Cómo)"]);
  });

  it("en una línea vacía cambia el tipo; con texto abre una línea nueva debajo", () => {
    expect(keybarAction("", "action", "character")).toBe("set");
    expect(keybarAction("   ", "action", "action")).toBe("none");
    expect(keybarAction("Lucía cierra la ventana.", "action", "character")).toBe("insert");
    expect(keybarAction("Lucía", "action", "action")).toBe("insert");
    expect(keybarAction("", null, "action")).toBe("none");
  });

  it("se coloca encima del teclado (visualViewport) y no por la barra del navegador", () => {
    expect(keyboardInset(844, { height: 500, offsetTop: 0 })).toBe(344);
    expect(keyboardInset(844, { height: 820, offsetTop: 0 })).toBe(0);
    expect(keyboardInset(844, { height: 500, offsetTop: 100 })).toBe(244);
    expect(keyboardInset(844, null)).toBe(0);
  });
});

describe("ir a una escena (M1)", () => {
  it("deja el encabezado arriba, debajo de las barras fijas", () => {
    // Encabezado a 900 px de la ventana, con 7000 px bajados y barras hasta 113 px.
    expect(sceneScrollTop({ elementTop: 900, scrollY: 7000, chromeBottom: 113 })).toBe(7763);
    // Tras desplazar, el encabezado queda a chromeBottom + 24 px.
    const top = sceneScrollTop({ elementTop: 900, scrollY: 7000, chromeBottom: 113 });
    expect(900 + 7000 - top).toBe(113 + 24);
    expect(sceneScrollTop({ elementTop: 50, scrollY: 0, chromeBottom: 113 })).toBe(0);
  });
});

describe("guardado (M12)", () => {
  it("cada estado tiene texto corto, explicación y color", () => {
    expect(saveIndicator("saved", "online")).toMatchObject({ short: "Guardado", tone: "ok" });
    expect(saveIndicator("dirty", "online")).toMatchObject({ short: "Sin guardar", tone: "busy" });
    expect(saveIndicator("saving", "online").tone).toBe("busy");
    expect(saveIndicator("error", "online", "Sin permiso")).toMatchObject({ label: "Sin permiso", tone: "error" });
    expect(saveIndicator("saved", "offline")).toMatchObject({ short: "Sin conexión", tone: "warn" });
  });
});

describe("descargar (M5, M6)", () => {
  it("el PDF se abre en otra pestaña y el Fountain se descarga aquí", () => {
    const items = exportItems("abc", 11);
    expect(items.find((i) => i.id === "fountain")).toMatchObject({ mode: "download", href: "/api/guiones/abc/fountain" });
    expect(items.filter((i) => i.mode === "tab").map((i) => i.id)).toEqual(["pdf-a4", "pdf-letter"]);
  });

  it("dice cuántas páginas tendrá el PDF, con la portada aparte", () => {
    expect(exportItems("abc", 11)[0].detail).toBe("Tamaño A4 · 11 págs. + portada");
    expect(exportItems("abc", 1)[0].detail).toContain("1 pág. + portada");
    expect(exportItems("abc", 0)[0].detail).toContain("solo la portada");
  });
});

describe("textos sin jerga", () => {
  it("el punto naranja lleva texto (P2)", () => {
    expect(doubtsLabel(1)).toBe("1 escena con dudas");
    expect(doubtsLabel(4)).toBe("4 escenas con dudas");
  });

  it("los octavos se dicen como tiempo en pantalla", () => {
    expect(screenTime(1)).toBe("≈ 8 s");
    expect(screenTime(6)).toBe("≈ 45 s");
    expect(screenTime(8)).toBe("≈ 1 min");
    expect(screenTime(20)).toBe("≈ 3 min");
    expect(screenTime(0)).toBe("≈ 1 s");
  });
});
