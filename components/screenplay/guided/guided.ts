// Camino guiado («Nunca he escrito un guion — guíame»): datos y cálculos
// puros, sin React ni Yjs, para que el arranque, el esqueleto, la barra «Tu
// borrador» y los tests usen exactamente lo mismo.
//
// Regla de fondo: todo lo escribe la persona. Lo que monta la app (la frase
// de la historia y el esqueleto) se hace ensamblando sus propias palabras con
// una plantilla fija; la IA, si está, solo pregunta o propone y se elige.

import { characterName, type ScreenplayBlock } from "@/lib/screenplay/blocks";
import { momentById, type MomentId } from "@/lib/screenplay/moments";

// ------------------------------------------------------------------ dónde se guarda

// Claves dentro del mapa Yjs `structure` (compartido con el equipo).
export const GUIDED_KEY = "guided"; // true si el guion se creó con «guíame»
export const START_KEY = "guidedStart"; // respuestas del arranque
export const SKELETON_KEY = "skeleton"; // el esqueleto de escenas
// Idea suelta que guarda la respuesta «¿Cómo te imaginas el final?».
export const ENDING_IDEA_ID = "guided-ending";

// ------------------------------------------------------------------ las 5 preguntas

export type StartAnswers = {
  idea?: string;
  name?: string; // tal cual se escribió («Nora»)
  trait?: string; // «11 años, terca»
  want?: string;
  obstacle?: string;
  ending?: string;
  q?: number; // pregunta en la que se quedó (0..4)
  skipped?: string[]; // las que se saltaron («No lo sé todavía»)
  done?: boolean; // llegó al esqueleto
};

export type QuestionKey = "idea" | "who" | "want" | "obstacle" | "ending";

export type Question = {
  key: QuestionKey;
  title: string; // con {P} = nombre del protagonista
  help: string;
  examples: string[];
  next: string; // texto del botón que lleva aquí («Siguiente: …»)
};

export const QUESTIONS: readonly Question[] = [
  {
    key: "idea",
    title: "¿De qué va tu historia?",
    help: "En una frase, como se la contarías a un amigo en un bar. No tiene que ser bonita.",
    examples: [
      "Una niña que quiere arreglar la bici de su madre.",
      "Dos hermanos que no se hablan tienen que vaciar la casa del padre.",
      "Un repartidor descubre que siempre le toca la misma casa.",
    ],
    next: "¿de qué va?",
  },
  {
    key: "who",
    title: "¿Quién es el protagonista?",
    help: "Nombre y una cosa que le defina. Si hay varios, elige al que más cambia.",
    examples: ["Nora · 11 años, terca", "Julián · repartidor, no sabe decir que no", "Amaia · cocinera, recién jubilada"],
    next: "¿quién es?",
  },
  {
    key: "want",
    title: "¿Qué quiere {P}?",
    help: "Algo concreto que se pueda ver en pantalla. No «ser feliz»: recuperar la bicicleta, llegar a la boda, que su padre la escuche.",
    examples: [
      "Arreglar la bicicleta roja antes de que la vendan.",
      "Llegar a la boda de su hermana antes del brindis.",
      "Que su padre la escuche una sola vez.",
    ],
    next: "¿qué quiere?",
  },
  {
    key: "obstacle",
    title: "¿Qué se lo impide?",
    help: "Una persona, una norma, el tiempo, sus propios miedos… Sin obstáculo no hay película.",
    examples: ["Su abuelo quiere venderla.", "Solo tiene hasta el sábado.", "Le da miedo pedir ayuda."],
    next: "¿qué se lo impide?",
  },
  {
    key: "ending",
    title: "¿Cómo te imaginas el final?",
    help: "Vale con una imagen o una sensación. Se puede cambiar mil veces.",
    examples: ["El abuelo le sujeta el sillín.", "Ella se va sin mirar atrás.", "La casa vacía, con la luz encendida."],
    next: "¿cómo acaba?",
  },
] as const;

// «nora» / «NORA» → «Nora». Para las frases (en la página va en mayúsculas).
export function displayName(name: string | undefined): string {
  const n = (name ?? "").trim().replace(/\s+/g, " ");
  if (!n) return "";
  return n
    .toLocaleLowerCase("es")
    .split(" ")
    .map((w) => (w.length > 2 || w === n.toLocaleLowerCase("es") ? w.charAt(0).toLocaleUpperCase("es") + w.slice(1) : w))
    .join(" ");
}

// El nombre tal como va en la página («NORA») y en las fichas de personaje.
export function scriptName(name: string | undefined): string {
  return characterName(name ?? "");
}

// Las preguntas y las tarjetas hablan del protagonista por su nombre.
export function personalize(text: string, name: string | undefined): string {
  const p = displayName(name);
  return text.replace(/\{P\}/g, p || "tu protagonista");
}

// Cuánto queda (unos 40 s por pregunta, redondeando hacia arriba).
export function minutesLeft(index: number): number {
  return Math.max(1, Math.ceil(((QUESTIONS.length - index) * 40) / 60));
}

// ------------------------------------------------------------------ comprobaciones suaves (sin IA)

export type Check = { ok: boolean; text: string };

const VAGUE = /\b(ser feliz|feliz|encontrarse|encontrar(se)? a s[ií] mism[oa]|estar bien|sentirse|sentir(se)? mejor|paz interior|ser libre|realizarse|ser alguien)\b/i;
const DEADLINE = /\b(antes de|antes del|hasta el|hasta que|mañana|esta noche|hoy|lunes|martes|miércoles|jueves|viernes|sábado|domingo|en \d+|a las \d+|cuando acabe|se acaba|a tiempo)\b/i;

export function wordCount(text: string | undefined): number {
  const t = (text ?? "").trim();
  return t ? t.split(/\s+/).length : 0;
}

// Lo que quiere: que se pueda ver y, mejor aún, con un plazo.
export function checkWant(text: string | undefined, name: string | undefined): Check[] {
  const t = (text ?? "").trim();
  if (wordCount(t) < 2) return [];
  const p = displayName(name) || "tu protagonista";
  if (VAGUE.test(t)) return [{ ok: false, text: `Eso pasa por dentro. ¿Qué haría ${p} que podamos ver?` }];
  const out: Check[] = [{ ok: true, text: "Se puede ver." }];
  if (DEADLINE.test(t)) out.push({ ok: true, text: "Tiene un plazo. Bien: eso ya es tensión." });
  return out;
}

export function checkObstacle(text: string | undefined): Check[] {
  const t = (text ?? "").trim();
  if (wordCount(t) < 2) return [];
  const out: Check[] = [];
  if (/\b(él mism[oa]|ella misma|sí mism[oa]|miedo|vergüenza|culpa|no se atreve)\b/i.test(t))
    out.push({ ok: true, text: "Un obstáculo de dentro. Busca también algo de fuera que lo haga visible." });
  else out.push({ ok: true, text: "Alguien o algo de fuera: se puede ver en pantalla." });
  if (DEADLINE.test(t)) out.push({ ok: true, text: "Y con reloj. Eso aprieta." });
  return out;
}

// Aviso al pasar sin obstáculo.
export function noObstacleWarning(name: string | undefined): string {
  const p = displayName(name) || "tu protagonista";
  return `Sin obstáculo, ${p} lo consigue en la escena 1. ¿Seguro que no hay nada en medio?`;
}

// ------------------------------------------------------------------ la historia en una frase (logline)

const lowerFirst = (s: string) => s.charAt(0).toLocaleLowerCase("es") + s.slice(1);
const clean = (s: string | undefined) =>
  (s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.。…]+$/, "");

// «Que su abuelo le deje…» → «que su abuelo le deje…»; «Quiere arreglar…» → «arreglar…».
function wantPhrase(want: string): string {
  let w = lowerFirst(clean(want));
  w = w.replace(/^(él|ella)\s+/, "").replace(/^(quiere|querría|desea|necesita)\s+/, "");
  return w;
}

function obstaclePhrase(obstacle: string): string {
  let o = lowerFirst(clean(obstacle));
  o = o.replace(/^(pero|aunque|sin embargo,?)\s+/, "").replace(/^(que|lo que se lo impide es|se lo impide)\s+/, "");
  return o;
}

// Plantilla fija con las palabras de quien escribe:
//   «Nora, 11 años, terca, quiere arreglar la bicicleta antes de que la
//    vendan, pero su abuelo quiere venderla.»
// Si falta algo, se monta con lo que haya (y, si no hay nada, con la idea).
export function assembleLogline(a: StartAnswers): string {
  const name = displayName(a.name);
  const trait = clean(a.trait);
  const want = clean(a.want);
  const obstacle = clean(a.obstacle);
  const idea = clean(a.idea);
  const who = name ? (trait ? `${name}, ${lowerFirst(trait)},` : name) : trait ? `Alguien ${lowerFirst(trait)}` : "";
  if (who && want) {
    const base = `${who} quiere ${wantPhrase(want)}`;
    return `${obstacle ? `${base}, pero ${obstaclePhrase(obstacle)}` : base}.`;
  }
  if (idea) return `${idea.charAt(0).toLocaleUpperCase("es")}${idea.slice(1)}.`;
  if (who) return `La historia de ${who.replace(/,$/, "")}.`;
  return "";
}

// ------------------------------------------------------------------ rutas de estructura (esqueleto)

export type RouteId = "short5" | "short3" | "feature8";

export type RouteStep = {
  key: string;
  moment?: MomentId; // momento de la historia que es (vocabulario común)
  plain: string; // etiqueta llana si no es un momento («Lo intenta»)
  technical: string; // término técnico pequeño
  title: string;
  question: string; // con {P}
  at: readonly [number, number]; // dónde suele caer (fracción de la duración)
};

export type Route = { id: RouteId; label: string; hint: string; pages: number; steps: readonly RouteStep[] };

export const ROUTES: Record<RouteId, Route> = {
  short5: {
    id: "short5",
    label: "Corto en 5 pasos",
    hint: "De 3 a 10 páginas. Un cambio y una decisión.",
    pages: 8,
    steps: [
      { key: "start", moment: "start", plain: "Empieza", technical: "planteamiento", title: "Antes del problema", question: "¿Qué hace {P} un día normal que nos diga quién es?", at: [0, 0.12] },
      { key: "inciting", moment: "inciting", plain: "Algo cambia", technical: "detonante", title: "Lo que lo cambia todo", question: "¿Qué pasa que obliga a {P} a actuar ya?", at: [0.12, 0.25] },
      { key: "tries", plain: "Lo intenta", technical: "desarrollo", title: "Y se complica", question: "¿Qué hace {P} para conseguirlo y qué sale mal?", at: [0.25, 0.65] },
      { key: "climax", moment: "climax", plain: "El gran final", technical: "clímax", title: "El momento decisivo", question: "¿Qué elige {P} cuando ya no hay salida fácil?", at: [0.7, 0.9] },
      { key: "after", plain: "Después", technical: "resolución", title: "Cómo queda", question: "¿Qué ha cambiado en {P} (o a su alrededor)?", at: [0.9, 1] },
    ],
  },
  short3: {
    id: "short3",
    label: "Corto de una situación",
    hint: "De 1 a 3 páginas. Una sola idea, bien rematada.",
    pages: 3,
    steps: [
      { key: "start", moment: "start", plain: "Empieza", technical: "planteamiento", title: "Entramos", question: "¿Dónde está {P} y qué está haciendo?", at: [0, 0.3] },
      { key: "inciting", moment: "inciting", plain: "Algo cambia", technical: "detonante", title: "Algo no encaja", question: "¿Qué pasa que {P} no esperaba?", at: [0.3, 0.7] },
      { key: "climax", moment: "climax", plain: "El gran final", technical: "remate", title: "Remate", question: "¿Cómo acaba: con un giro, una imagen o una decisión?", at: [0.7, 1] },
    ],
  },
  feature8: {
    id: "feature8",
    label: "Largo en 8 pasos",
    hint: "Unos 90 minutos, en tres actos.",
    pages: 95,
    steps: [
      { key: "start", moment: "start", plain: "Empieza", technical: "planteamiento", title: "Cómo es todo", question: "¿Cómo vive {P} antes de que empiece todo?", at: [0, 0.1] },
      { key: "inciting", moment: "inciting", plain: "Algo cambia", technical: "detonante", title: "Lo que rompe la normalidad", question: "¿Qué rompe la vida normal de {P}?", at: [0.1, 0.15] },
      { key: "turn1", moment: "turn1", plain: "No hay vuelta atrás", technical: "primer giro", title: "Se mete de lleno", question: "¿Qué decide {P} y por qué ya no puede volver atrás?", at: [0.2, 0.3] },
      { key: "tries", plain: "Lo intenta", technical: "desarrollo", title: "Por el camino", question: "¿Qué prueba {P} y a quién conoce por el camino?", at: [0.3, 0.45] },
      { key: "midpoint", moment: "midpoint", plain: "Nada es lo que parecía", technical: "punto medio", title: "La revelación", question: "¿Qué descubre {P} que cambia lo que busca?", at: [0.45, 0.55] },
      { key: "turn2", moment: "turn2", plain: "Todo se complica", technical: "segundo giro", title: "El peor momento", question: "¿Qué pierde {P}? ¿Cuál es su peor momento?", at: [0.7, 0.8] },
      { key: "climax", moment: "climax", plain: "El gran final", technical: "clímax", title: "Todo o nada", question: "¿Cómo se enfrenta {P} al final a lo que se lo impedía?", at: [0.85, 0.95] },
      { key: "after", plain: "Después", technical: "resolución", title: "Quién es ahora", question: "¿Quién es {P} ahora?", at: [0.95, 1] },
    ],
  },
};

export const ROUTE_IDS = Object.keys(ROUTES) as RouteId[];

export function isRouteId(v: unknown): v is RouteId {
  return typeof v === "string" && v in ROUTES;
}

export function defaultRoute(format: string | null | undefined): RouteId {
  return format === "FEATURE" || format === "SERIES_EPISODE" ? "feature8" : "short5";
}

// Nombre llano de un paso: el del momento de la historia si lo es (mismo
// vocabulario en toda la app), o el suyo propio.
export function stepPlain(step: RouteStep): string {
  return step.moment ? (momentById(step.moment)?.plain ?? step.plain) : step.plain;
}

// «≈ pág. 1–2»
export function stepPages(step: Pick<RouteStep, "at">, totalPages: number): string {
  const a = Math.max(1, Math.round(step.at[0] * totalPages) || 1);
  const b = Math.max(a, Math.round(step.at[1] * totalPages));
  return a === b ? `≈ pág. ${a}` : `≈ pág. ${a}–${b}`;
}

// ------------------------------------------------------------------ el esqueleto

// Una tarjeta = una escena. `step` es la clave del paso de la ruta, o
// "extra" para las que añade quien escribe entre dos. `sid` se pone al
// crear su escena en el guion.
export type SkeletonCard = { id: string; step: string; line: string; title?: string; question?: string; sid?: string };
export type Skeleton = { route: RouteId; cards: SkeletonCard[]; at: number; created?: boolean };

export function cardId(): string {
  return `k${Math.random().toString(36).slice(2, 9)}`;
}

export function newSkeleton(route: RouteId, answers: StartAnswers): Skeleton {
  const steps = ROUTES[route].steps;
  const ending = clean(answers.ending);
  return {
    route,
    at: Date.now(),
    cards: steps.map((s, i) => ({
      id: cardId(),
      step: s.key,
      // La imagen del final ya rellena la última tarjeta.
      line: i === steps.length - 1 && ending ? `${ending}.` : "",
    })),
  };
}

// Cambiar de ruta sin perder lo escrito: las tarjetas del mismo paso se
// quedan su línea; las añadidas a mano van detrás de la anterior que exista.
export function switchRoute(sk: Skeleton, route: RouteId): Skeleton {
  const byStep = new Map(sk.cards.filter((c) => c.step !== "extra").map((c) => [c.step, c]));
  const next: SkeletonCard[] = ROUTES[route].steps.map((s) => byStep.get(s.key) ?? { id: cardId(), step: s.key, line: "" });
  // Las líneas de pasos que ya no están se guardan en una tarjeta extra para no perderlas.
  const lost = sk.cards.filter((c) => c.step !== "extra" && !ROUTES[route].steps.some((s) => s.key === c.step) && c.line.trim());
  const extras = sk.cards.filter((c) => c.step === "extra");
  return { ...sk, route, cards: [...next, ...lost.map((c) => ({ ...c, step: "extra", title: stepTitleOf(sk.route, c.step) })), ...extras] };
}

function stepTitleOf(route: RouteId, key: string): string {
  const s = ROUTES[route].steps.find((x) => x.key === key);
  return s ? s.title : "Otra escena";
}

export function stepOf(sk: Pick<Skeleton, "route">, card: SkeletonCard): RouteStep | null {
  return ROUTES[sk.route]?.steps.find((s) => s.key === card.step) ?? null;
}

// Lo que se enseña de una tarjeta.
export function cardView(sk: Pick<Skeleton, "route">, card: SkeletonCard, name: string | undefined) {
  const step = stepOf(sk, card);
  return {
    plain: step ? stepPlain(step) : "Otra escena",
    technical: step?.technical ?? "",
    title: card.title?.trim() || step?.title || "Otra escena",
    question: personalize(card.question?.trim() || step?.question || "¿Qué pasa en esta escena?", name),
    moment: step?.moment,
  };
}

export function readSkeleton(v: unknown): Skeleton | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Partial<Skeleton>;
  if (!isRouteId(s.route) || !Array.isArray(s.cards)) return null;
  const cards = s.cards
    .filter((c): c is SkeletonCard => Boolean(c) && typeof c === "object" && typeof (c as SkeletonCard).id === "string")
    .map((c) => ({ ...c, line: typeof c.line === "string" ? c.line : "", step: typeof c.step === "string" ? c.step : "extra" }));
  return { route: s.route, cards, at: Number(s.at) || 0, created: Boolean(s.created) };
}

export function readStart(v: unknown): StartAnswers {
  if (!v || typeof v !== "object") return {};
  const a = v as Record<string, unknown>;
  const s = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : undefined);
  return {
    idea: s("idea"),
    name: s("name"),
    trait: s("trait"),
    want: s("want"),
    obstacle: s("obstacle"),
    ending: s("ending"),
    q: typeof a.q === "number" ? Math.max(0, Math.min(QUESTIONS.length - 1, a.q)) : 0,
    skipped: Array.isArray(a.skipped) ? (a.skipped as unknown[]).filter((x): x is string => typeof x === "string") : [],
    done: Boolean(a.done),
  };
}

// ------------------------------------------------------------------ escenas en el texto

// Cada encabezado con id es una escena, aunque esté vacía (las del esqueleto
// nacen así). Va del encabezado al siguiente.
export type SceneRange = { sid: string; start: number; end: number; heading: string };

export function sceneRanges(blocks: readonly ScreenplayBlock[]): SceneRange[] {
  const out: SceneRange[] = [];
  blocks.forEach((b, i) => {
    if (b.type !== "sceneHeading" || !b.id) return;
    if (out.length) out[out.length - 1].end = i;
    out.push({ sid: b.id, start: i, end: blocks.length, heading: b.text.trim() });
  });
  return out;
}

export type SceneState = "empty" | "sketched" | "written";

// Escrita: tiene lugar y hora, algo que se ve y al menos 4 líneas con texto.
// Esbozada: hay algo (una línea en la tarjeta o texto a medias). Vacía: nada.
// Las notas para ti no cuentan como escrito.
export function sceneState(blocks: readonly ScreenplayBlock[], range: SceneRange | undefined, line = ""): SceneState {
  if (!range) return line.trim() ? "sketched" : "empty";
  const body = blocks.slice(range.start + 1, range.end).filter((b) => b.type !== "note" && b.text.trim());
  const filled = body.length + (range.heading ? 1 : 0);
  const hasAction = body.some((b) => b.type === "action");
  if (range.heading && hasAction && filled >= 4) return "written";
  if (filled > 0 || line.trim()) return "sketched";
  return "empty";
}

export type DraftItem = {
  key: string; // id de la tarjeta o sid
  sid: string | null;
  index: number; // 1..
  label: string; // «Algo cambia» (o el encabezado)
  question: string;
  state: SceneState;
  here: boolean;
};

export type DraftProgress = {
  items: DraftItem[];
  written: number;
  total: number;
  fromSkeleton: boolean;
};

// El avance del borrador: por tarjetas del esqueleto si lo hay (en su orden
// en el guion), o por las escenas que haya.
export function draftProgress(
  blocks: readonly ScreenplayBlock[],
  skeleton: Skeleton | null,
  currentSid: string | null,
  {
    name,
    synopses = {},
  }: { name?: string; synopses?: Record<string, string | undefined> } = {},
): DraftProgress {
  const ranges = sceneRanges(blocks);
  const bySid = new Map(ranges.map((r) => [r.sid, r]));
  let items: DraftItem[];
  if (skeleton && skeleton.cards.some((c) => c.sid && bySid.has(c.sid))) {
    // Orden del guion (si alguien movió escenas, la barra lo sigue). Las
    // tarjetas cuya escena se borró ya no cuentan.
    const order = new Map(ranges.map((r, i) => [r.sid, i]));
    const linked = skeleton.cards
      .filter((c) => c.sid && bySid.has(c.sid))
      .sort((a, b) => (order.get(a.sid!) ?? 0) - (order.get(b.sid!) ?? 0));
    // Escenas que se escribieron fuera del esqueleto, también cuentan.
    const linkedSids = new Set(linked.map((c) => c.sid));
    const others = ranges.filter((r) => !linkedSids.has(r.sid) && sceneState(blocks, r) !== "empty");
    const all = [
      ...linked.map((c) => ({ card: c, range: bySid.get(c.sid!)! })),
      ...others.map((r) => ({ card: null as SkeletonCard | null, range: r })),
    ].sort((a, b) => a.range.start - b.range.start);
    items = all.map(({ card, range }, i) => {
      const view = card ? cardView(skeleton, card, name) : null;
      return {
        key: card?.id ?? range.sid,
        sid: range.sid,
        index: i + 1,
        label: view?.plain ?? (range.heading || "Escena sin lugar"),
        question: view?.question ?? "",
        state: sceneState(blocks, range, synopses[range.sid] ?? card?.line ?? ""),
        here: range.sid === currentSid,
      };
    });
  } else {
    items = ranges
      .filter((r) => sceneState(blocks, r) !== "empty")
      .map((r, i) => ({
        key: r.sid,
        sid: r.sid,
        index: i + 1,
        label: r.heading || "Escena sin lugar",
        question: "",
        state: sceneState(blocks, r, synopses[r.sid] ?? ""),
        here: r.sid === currentSid,
      }));
  }
  return {
    items,
    written: items.filter((i) => i.state === "written").length,
    total: items.length,
    fromSkeleton: Boolean(skeleton?.cards.some((c) => c.sid && bySid.has(c.sid))),
  };
}

// «Para un borrador te falta: …» — por prioridad; se enseñan las 2 primeras.
export function missingForDraft(
  p: DraftProgress,
  { name, want, pages, minPages = 3 }: { name?: string; want?: string; pages: number; minPages?: number },
): string[] {
  const out: string[] = [];
  const left = p.total - p.written;
  if (left > 0) out.push(`escribir ${left === 1 ? "1 escena" : `${left} escenas`}`);
  const last = p.items[p.items.length - 1];
  if (p.fromSkeleton && last && last.state !== "written") out.push(last.state === "sketched" ? "el final está esbozado" : "el final");
  if (!want?.trim()) out.push(`decir qué quiere ${displayName(name) || "tu protagonista"}`);
  if (pages < minPages) {
    const n = Math.max(1, Math.ceil(minPages - pages));
    out.push(`≈ ${n} ${n === 1 ? "página" : "páginas"} para llegar al mínimo de un corto (${minPages})`);
  }
  return out;
}

// Los hitos que se celebran (una vez cada uno).
export type Milestone = "first" | "half" | "all";

export function reachedMilestones(p: DraftProgress): Milestone[] {
  const out: Milestone[] = [];
  if (p.written >= 1) out.push("first");
  if (p.total >= 3 && p.written >= Math.ceil(p.total / 2) && p.written < p.total) out.push("half");
  if (p.fromSkeleton && p.total >= 2 && p.written === p.total) out.push("all");
  return out;
}

export const MILESTONE_TEXT: Record<Milestone, string> = {
  first: "Primera escena escrita. Lo más difícil ya está hecho.",
  half: "Vas por la mitad. Buen momento para leer lo que llevas de un tirón.",
  all: "Tienes un borrador. Eso es un guion.",
};

// ------------------------------------------------------------------ crear las escenas del esqueleto

// Qué tarjetas necesitan escena y delante de qué escena va cada una (la
// siguiente tarjeta que ya la tenga), para respetar el orden del esqueleto
// aunque se añada una tarjeta entre dos después de crear las escenas.
export function scenesToCreate(sk: Skeleton, existingSids: ReadonlySet<string>): { cardId: string; beforeSid: string | null }[] {
  const out: { cardId: string; beforeSid: string | null }[] = [];
  sk.cards.forEach((c, i) => {
    if (c.sid && existingSids.has(c.sid)) return;
    const next = sk.cards.slice(i + 1).find((x) => x.sid && existingSids.has(x.sid));
    out.push({ cardId: c.id, beforeSid: next?.sid ?? null });
  });
  return out;
}

// Momento de la historia de cada tarjeta ya con escena (beat → sid).
export function skeletonBeats(sk: Skeleton): { moment: MomentId; sid: string }[] {
  const out: { moment: MomentId; sid: string }[] = [];
  for (const c of sk.cards) {
    const m = stepOf(sk, c)?.moment;
    if (m && m !== "start" && c.sid) out.push({ moment: m, sid: c.sid });
  }
  return out;
}
