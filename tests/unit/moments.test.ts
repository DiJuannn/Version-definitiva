import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { BEATS, type SceneInfo } from "@/lib/screenplay/story";
import { storyMaps } from "@/lib/screenplay/story-doc";
import {
  KEY_MOMENTS,
  MOMENTS,
  assignRows,
  buildTimeline,
  checkStory,
  layoutBlocks,
  momentBehind,
  placeMoments,
  plural,
  screenTime,
  setMoment,
  spanCenter,
  stripColorOf,
  structureTemplate,
  targetPages,
  whenText,
} from "@/lib/screenplay/moments";

function scene(n: number, eighths: number, heading = `INT. LUGAR ${n} - DÍA`): SceneInfo {
  const time = heading.split(" - ")[1] ?? "";
  return {
    sid: `s${n}`,
    number: n,
    heading,
    place: "",
    time,
    start: n * 3,
    end: n * 3 + 3,
    speakers: [],
    present: [],
    eighths,
    firstAction: "",
  };
}
const many = (count: number, eighths: number) => Array.from({ length: count }, (_, i) => scene(i + 1, eighths));

describe("vocabulario de los momentos", () => {
  it("reutiliza los ids que ya guarda Yjs y añade «Empieza»", () => {
    expect(KEY_MOMENTS.map((m) => m.id)).toEqual(BEATS.map((b) => b.key));
    expect(MOMENTS[0]).toMatchObject({ id: "start", plain: "Empieza", auto: true });
    expect(MOMENTS.map((m) => m.plain)).toEqual(["Empieza", "Algo cambia", "No hay vuelta atrás", "Nada es lo que parecía", "Todo se complica", "El gran final"]);
  });

  it("cada momento explica, pregunta y pone un ejemplo", () => {
    for (const m of MOMENTS) {
      expect(m.what.length).toBeGreaterThan(20);
      expect(m.question).toMatch(/^¿.*\?$/);
      expect(m.example).toMatch(/«.+»/);
    }
  });

  it("plurales («1 escena», no «1 escenas»)", () => {
    expect(plural(1, "escena", "escenas")).toBe("1 escena");
    expect(plural(3, "escena", "escenas")).toBe("3 escenas");
  });

  it("duración en pantalla en vez de octavos", () => {
    expect(screenTime(1)).toBe("≈8 s");
    expect(screenTime(16)).toBe("≈2 min");
  });
});

describe("estructura y duración prevista", () => {
  it("solo «three» pinta momentos: «5 actos» y «Libre» se respetan", () => {
    expect(structureTemplate({})).toBe("three");
    expect(structureTemplate({ template: "five" })).toBe("five");
    expect(structureTemplate({ template: "free" })).toBe("free");
    expect(structureTemplate({ template: "loquesea" })).toBe("three");
  });

  it("por formato, o la que ponga el equipo", () => {
    expect(targetPages({}, "SHORT")).toBe(12);
    expect(targetPages({}, "FEATURE")).toBe(95);
    expect(targetPages({}, null)).toBe(20);
    expect(targetPages({ targetPages: 30 }, "SHORT")).toBe(30);
    expect(targetPages({ targetPages: 9999 }, "SHORT")).toBe(240);
  });

  it("con 3 escenas la línea mide la duración prevista y deja «por escribir»", () => {
    const tl = buildTimeline([scene(1, 16), scene(2, 16), scene(3, 24)], 12);
    expect(tl.written).toBe(56);
    expect(tl.total).toBe(96);
    expect(tl.todo).toBe(40);
    expect(tl.spans[2].b).toBeCloseTo(56 / 96);
  });

  it("si ya se pasó de la duración prevista, la línea es lo escrito", () => {
    const tl = buildTimeline(many(40, 8), 12);
    expect(tl.total).toBe(320);
    expect(tl.todo).toBe(0);
  });
});

describe("momentos sobre SU escena", () => {
  const scenes = many(10, 8);
  const tl = buildTimeline(scenes, 10);

  it("marcado → el centro de su escena; sin marcar → sin escena", () => {
    const placed = placeMoments(scenes, { inciting: "s2", climax: "nope" }, tl);
    const inciting = placed.find((p) => p.moment.id === "inciting")!;
    expect(inciting.placed).toBe(true);
    expect(inciting.at).toBeCloseTo(spanCenter(tl.byId.get("s2")!));
    const climax = placed.find((p) => p.moment.id === "climax")!;
    expect(climax).toMatchObject({ placed: false, sid: null, scene: null });
    const start = placed.find((p) => p.moment.id === "start")!;
    expect(start).toMatchObject({ placed: true, sid: "s1" });
  });

  it("el momento de la escena actual es el último marcado por detrás", () => {
    const placed = placeMoments(scenes, { inciting: "s2", turn1: "s3", midpoint: "s6" }, tl);
    expect(momentBehind(placed, scenes, "s5")?.moment.id).toBe("turn1");
    expect(momentBehind(placed, scenes, "s1")?.moment.id).toBe("start");
  });

  it("40 escenas cortas: la marca cae dentro del bloque de su escena (F2)", () => {
    const short = many(40, 1);
    const width = 400;
    const { boxes } = layoutBlocks(short.map((s) => Math.max(1, s.eighths)), width, { gap: 2, min: 4 });
    const i = 29; // «Todo se complica» marcado en la escena 30
    const x = boxes[i].left + boxes[i].width / 2;
    expect(x).toBeGreaterThanOrEqual(boxes[i].left);
    expect(x).toBeLessThanOrEqual(boxes[i].left + boxes[i].width);
  });
});

// Comprueba lo que promete assignRows: sin solaparse en la misma fila, cada
// etiqueta encima de su palito y ninguna tapando el palito de una de más arriba.
function expectValid(items: { x: number; w: number }[], rows: { left: number; row: number }[], width: number) {
  rows.forEach((r, i) => {
    expect(r.left).toBeGreaterThanOrEqual(-0.5);
    expect(r.left + items[i].w).toBeLessThanOrEqual(width + 0.5);
    expect(items[i].x).toBeGreaterThanOrEqual(r.left);
    expect(items[i].x).toBeLessThanOrEqual(r.left + items[i].w);
    rows.forEach((o, j) => {
      if (i === j) return;
      if (o.row === r.row) expect(o.left >= r.left + items[i].w || o.left + items[j].w <= r.left).toBe(true);
      if (o.row > r.row && Math.abs(items[j].x - items[i].x) > 3)
        expect(items[j].x < r.left || items[j].x > r.left + items[i].w).toBe(true);
    });
  });
}

describe("medidas en píxeles", () => {
  it("los bloques llenan el ancho y respetan el mínimo", () => {
    const { boxes, continuous } = layoutBlocks([1, 1, 40, 1], 300, { gap: 2, min: 6 });
    expect(continuous).toBe(false);
    const last = boxes[boxes.length - 1];
    expect(last.left + last.width).toBeCloseTo(300);
    expect(Math.min(...boxes.map((b) => b.width))).toBeGreaterThanOrEqual(6 - 1e-9);
  });

  it("con muchísimas escenas se funden en una línea continua", () => {
    const { continuous, boxes } = layoutBlocks(Array(120).fill(1), 300, { gap: 2, min: 4 });
    expect(continuous).toBe(true);
    expect(boxes[1].left).toBeCloseTo(boxes[0].width);
  });

  it("etiquetas que no se pisan: la que choca sube de fila, la que cabe no", () => {
    const items = [
      { x: 50, w: 90 },
      { x: 80, w: 120 }, // choca con la primera
      { x: 400, w: 100 }, // cabe abajo
    ];
    const rows = assignRows(items, 600);
    expect(rows[0].row).not.toBe(rows[1].row);
    expect(rows[2].row).toBe(0);
    expectValid(items, rows, 600);
  });

  it("una etiqueta no tapa el palito de otra que ha subido de fila", () => {
    // «Todo se complica» (x=950) y «El gran final» (x=990) muy juntos
    const items = [
      { x: 950, w: 210 },
      { x: 990, w: 150 },
    ];
    const rows = assignRows(items, 1300);
    const [a, b] = rows;
    expect(a.row).not.toBe(b.row);
    const low = a.row < b.row ? 0 : 1;
    const high = 1 - low;
    // la de abajo no cubre el palito de la de arriba
    const lowBox = { l: rows[low].left, r: rows[low].left + items[low].w };
    expect(items[high].x < lowBox.l || items[high].x > lowBox.r).toBe(true);
    // y cada etiqueta sigue encima de su palito
    rows.forEach((r, i) => {
      expect(items[i].x).toBeGreaterThanOrEqual(r.left);
      expect(items[i].x).toBeLessThanOrEqual(r.left + items[i].w);
    });
  });

  it("no se salen por los bordes", () => {
    const rows = assignRows(
      [
        { x: 2, w: 80 },
        { x: 598, w: 80 },
      ],
      600,
    );
    expect(rows[0].left).toBe(0);
    expect(rows[1].left).toBe(520);
  });

  it("en una pantalla estrecha (700 px) los seis momentos caben sin pisarse", () => {
    const items = [0.04, 0.12, 0.25, 0.5, 0.75, 0.9].map((p) => ({ x: p * 700, w: 120 }));
    const rows = assignRows(items, 700);
    expect(Math.max(...rows.map((r) => r.row))).toBeLessThanOrEqual(2);
    expectValid(items, rows, 700);
  });

  it("el caso de «Distorsión»: seis momentos en 1000 px, en tres filas como mucho", () => {
    const xs = [70, 230, 330, 400, 860, 905];
    const ws = [90, 165, 200, 215, 210, 150];
    const items = xs.map((x, i) => ({ x, w: ws[i] }));
    const rows = assignRows(items, 1000);
    expect(Math.max(...rows.map((r) => r.row))).toBeLessThanOrEqual(2);
    expectValid(items, rows, 1000);
  });
});

describe("marcar un momento", () => {
  it("marcar el primer giro mueve el comienzo del Acto II a la escena siguiente", () => {
    const maps = storyMaps(new Y.Doc());
    const scenes = many(6, 8);
    maps.acts.set("s5", "Acto II");
    setMoment(maps, scenes, "three", "turn1", "s2");
    expect(maps.beats.get("turn1")).toBe("s2");
    expect(maps.acts.toJSON()).toEqual({ s3: "Acto II" });
    setMoment(maps, scenes, "three", "turn1", null);
    expect(maps.beats.has("turn1")).toBe(false);
  });

  it("con 5 actos no toca los actos; «Empieza» no se marca", () => {
    const maps = storyMaps(new Y.Doc());
    setMoment(maps, many(6, 8), "five", "turn2", "s4");
    expect(maps.acts.size).toBe(0);
    setMoment(maps, many(6, 8), "three", "start", "s4");
    expect(maps.beats.has("start")).toBe(false);
  });
});

describe("¿Cómo va mi historia?", () => {
  const scenes = many(10, 8); // 10 páginas

  it("llega tarde, a tiempo y falta", () => {
    const check = checkStory({ scenes, beats: { inciting: "s2", turn1: "s6" }, target: 10 });
    const moments = check.items.filter((i) => i.kind === "moment");
    const status = Object.fromEntries(moments.map((i) => [i.placed.moment.id, i.status]));
    expect(status).toMatchObject({ inciting: "ok", turn1: "late", midpoint: "missing", turn2: "missing", climax: "missing" });
    expect(check.done).toBe(2);
  });

  it("«Está bien así» calla el aviso solo para esa escena", () => {
    const quiet = checkStory({ scenes, beats: { turn1: "s6" }, target: 10, dismissed: { turn1: "s6" } });
    expect(quiet.items.find((i) => i.kind === "moment" && i.placed.moment.id === "turn1")).toMatchObject({ status: "ok" });
    const moved = checkStory({ scenes, beats: { turn1: "s7" }, target: 10, dismissed: { turn1: "s6" } });
    expect(moved.items.find((i) => i.kind === "moment" && i.placed.moment.id === "turn1")).toMatchObject({ status: "late" });
  });

  it("orden roto: el gran final antes que «Todo se complica»", () => {
    const check = checkStory({ scenes, beats: { turn2: "s9", climax: "s4" }, target: 10 });
    const climax = check.items.find((i) => i.kind === "moment" && i.placed.moment.id === "climax");
    expect(climax).toMatchObject({ status: "order" });
  });

  it("hueco después de lo escrito, con lo que suele venir", () => {
    const short = many(6, 8); // 6 de ~12 páginas
    const check = checkStory({ scenes: short, beats: { inciting: "s2", turn1: "s3", midpoint: "s6" }, target: 12 });
    const gaps = check.items.filter((i) => i.kind === "gap");
    expect(gaps).toHaveLength(1); // de «No hay vuelta atrás» a «Nada es lo que parecía» es lo normal
    const gap = gaps[0];
    if (gap?.kind === "gap") {
      expect(gap.text).toContain("después de la escena 6");
      expect(gap.next?.id).toBe("turn2");
      expect(gap.text).toContain("«Todo se complica»");
    }
  });

  it("hueco entre dos momentos seguidos muy separados", () => {
    const check = checkStory({ scenes: many(20, 8), beats: { turn1: "s5", midpoint: "s17" }, target: 20 });
    expect(check.items.some((i) => i.kind === "gap" && i.text.startsWith("entre «No hay vuelta atrás»"))).toBe(true);
  });
});

describe("textos", () => {
  it("cuándo suele pasar, en páginas", () => {
    expect(whenText(KEY_MOMENTS[0], 12)).toBe("Suele pasar hacia el 10–15 % (≈ pág. 1–2 de 12).");
  });

  it("colores de rodaje como el plan de rodaje", () => {
    expect(stripColorOf(scene(1, 8, "EXT. CALLE - DÍA"))).toBe("var(--strip-ext-day)");
    expect(stripColorOf(scene(1, 8, "INT. CASA - NOCHE"))).toBe("var(--strip-int-night)");
    expect(stripColorOf(scene(1, 8, "EXT. PLAYA - ATARDECER"))).toBe("var(--strip-twilight)");
  });
});
