import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, shortcutLabel } from "@/lib/screenplay/blocks";
import { guideKeys, lineGuideText, lineGuideVisible } from "@/components/screenplay/line-guide-text";
import { shortcutGroups } from "@/components/screenplay/ShortcutsSheet";

describe("Guía de la línea", () => {
  it("nombre llano, técnico pequeño y pista", () => {
    const g = lineGuideText("sceneHeading", true);
    expect(g.name).toBe("Lugar y hora");
    expect(g.technical).toBe("encabezado");
    expect(g.hint).toContain("INT. COCINA - NOCHE");
    expect(g.tip).toContain("INT. = dentro");
  });

  it("Enter y Tab dicen lo que hace el editor en cada caso", () => {
    expect(guideKeys("action", true)).toEqual([
      { key: "Enter", text: "línea nueva de «Lo que se ve»" },
      { key: "Tab", text: "que hable alguien («Quién habla»)" },
    ]);
    expect(guideKeys("character", false)[0]).toEqual({ key: "Enter", text: "línea nueva de «Lo que dice»" });
    // Tras lo que dice alguien se vuelve a «Lo que se ve» (sin trampa del Enter).
    expect(guideKeys("dialogue", false)[0]).toEqual({ key: "Enter", text: "línea nueva de «Lo que se ve»" });
    expect(guideKeys("dialogue", true)).toEqual([
      { key: "Enter", text: "esta línea pasa a «Lo que se ve»" },
      { key: "Tab", text: "un gesto antes de hablar («Cómo lo dice»)" },
    ]);
    expect(guideKeys("sceneHeading", true)[0].text).toBe("lo dejas para luego y sigues con «Lo que se ve»");
  });

  it("todas las líneas tienen guía completa", () => {
    for (const t of BLOCK_TYPES) {
      for (const empty of [true, false]) {
        const g = lineGuideText(t, empty);
        expect(g.name && g.hint).toBeTruthy();
        expect(g.keys.map((k) => k.key)).toEqual(["Enter", "Tab"]);
      }
    }
  });

  it("sale sola hasta 3 escenas, salvo que se apague o se fije", () => {
    expect(lineGuideVisible("auto", 0)).toBe(true);
    expect(lineGuideVisible("auto", 2)).toBe(true);
    expect(lineGuideVisible("auto", 3)).toBe(false);
    expect(lineGuideVisible("always", 40)).toBe(true);
    expect(lineGuideVisible("off", 0)).toBe(false);
  });
});

describe("Hoja de atajos", () => {
  it("enseña los Ctrl+Alt+1…8 reales del motor, con nombres llanos", () => {
    const rows = shortcutGroups(false).find((g) => g.title === "Tipo de línea")!.rows;
    expect(rows).toHaveLength(8);
    expect(rows[0].keys).toEqual([shortcutLabel("sceneHeading", false)]);
    expect(rows[0].keys[0]).toBe("Ctrl+Alt+1");
    expect(rows[0].what).toBe("Lugar y hora · encabezado");
    expect(rows[6].what).toBe("Plano");
  });

  it("en Mac, con ⌘ ⌥ ⇧", () => {
    const all = shortcutGroups(true).flatMap((g) => g.rows.flatMap((r) => r.keys));
    expect(all).toContain("⌘⌥1");
    expect(all).toContain("⌘⇧F");
    expect(all).toContain("⌘/");
    expect(all.some((k) => k.includes("Ctrl"))).toBe(false);
  });
});
