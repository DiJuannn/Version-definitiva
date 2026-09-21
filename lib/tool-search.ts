// Buscador de herramientas: además del nombre encuentra por sinónimos y por los nombres «del oficio»
// (quien busca «call sheet» encuentra «Hojas de llamada»). Puro: lo usan la web y (copiado) la app.

// Clave = `href` de la herramienta en TOOL_GROUPS (la app usa las mismas, salvo «/app/calendario» = «calendario»).
export const TOOL_KEYWORDS: Record<string, string[]> = {
  guion: ["script", "guión", "escenas", "subir guion", "pdf", "analizar", "continuidad"],
  desglose: ["breakdown", "atrezzo", "vestuario", "props", "elementos"],
  personajes: ["reparto", "actores", "actrices", "cast", "papeles"],
  "shot-list": ["shot list", "shotlist", "planos", "shots", "plano"],
  storyboard: ["viñetas", "dibujos", "guion grafico", "guion gráfico"],
  moodboard: ["referencias", "inspiración", "inspiracion", "tablero", "pizarra", "ideas"],
  pizarra: ["tablero", "mapa", "resumen visual"],
  "plan-de-rodaje": ["jornadas", "dias de rodaje", "días de rodaje", "calendario de rodaje", "schedule", "planificar"],
  "call-sheets": ["call sheet", "callsheet", "hoja de convocatoria", "convocatoria", "citacion", "citación", "hoja de llamada"],
  presupuesto: ["dinero", "gastos", "costes", "coste", "budget", "cuanto cuesta", "cuánto cuesta"],
  claqueta: ["clapper", "slate", "tomas", "clap"],
  script: ["script report", "parte", "tomas buenas", "notas de rodaje"],
  tareas: ["pendientes", "to do", "todo", "recordatorios"],
  documentos: ["archivos", "contratos", "permisos", "biblioteca", "pdf"],
  "documentos-legales": ["cesiones", "autorizaciones", "contrato", "derechos de imagen", "legal", "plantillas"],
  localizaciones: ["locations", "sitios", "lugares", "escenarios"],
  vehiculos: ["coches", "furgonetas", "transporte", "flota"],
  festivales: ["festival", "distribucion", "distribución", "enviar", "convocatorias", "presentar", "premios"],
  calendario: ["agenda", "reuniones", "eventos", "fechas"],
  "/app/calendario": ["agenda", "reuniones", "eventos", "fechas"],
};

// Sin mayúsculas ni acentos para comparar.
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Cada palabra escrita tiene que ser el comienzo de alguna palabra del texto («sit» encuentra «Sitges»,
// pero «lucia» no encuentra «Andalucía»).
export function wordsMatch(text: string, query: string): boolean {
  const words = normalize(text).split(/[^a-z0-9]+/).filter(Boolean);
  const tokens = normalize(query).split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => words.some((w) => w.startsWith(t)));
}

// Herramientas que encajan con lo escrito: primero las que empiezan por ello, luego el resto.
export function matchTools<T extends { label: string; href?: string; key?: string; description?: string }>(
  tools: T[],
  query: string,
): T[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const scored: { tool: T; score: number }[] = [];
  for (const tool of tools) {
    const id = tool.key ?? tool.href ?? "";
    const label = normalize(tool.label);
    const words = (TOOL_KEYWORDS[id] ?? []).map(normalize);
    let score = 0;
    if (label.startsWith(q)) score = 4;
    else if (label.includes(q)) score = 3;
    else if (words.some((w) => w.startsWith(q) || q.startsWith(w))) score = 2;
    else if (words.some((w) => w.includes(q)) || normalize(tool.description ?? "").includes(q)) score = 1;
    if (score > 0) scored.push({ tool, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.tool);
}
