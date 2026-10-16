// El guion de la demo (/demo): lo que dice el ajolote en cada capítulo y qué
// pantalla real se ve, con los encuadres de la cámara (fracciones de la
// captura: x, y, ancho, alto). Las capturas salen de la app real con
// scripts/demo/capture.mjs. Si existe public/demo/voz/<id>.mp3, se oye esa
// voz; si no, la lee la voz del navegador.

export type Focus = [number, number, number, number];

export type Beat = {
  shot: string; // public/demo/shots/<shot>.webp
  focus: Focus;
  label?: string; // lo que señala el círculo
};

export type Special = "intro" | "lectura" | "corten" | "outro";

export type Chapter = {
  id: string;
  kicker: string;
  title: string;
  phase: 1 | 2 | 3 | 4;
  voice: string;
  beats: Beat[];
  special?: Special;
};

// Tamaño de cada captura (px), para encuadrar sin esperar a que cargue.
export const SHOT_SIZE: Record<string, [number, number]> = {
  inicio: [1800, 1250],
  guion: [1800, 1250],
  mesa: [1800, 1875],
  desglose: [1800, 1500],
  planos: [1800, 1625],
  tecnico: [1800, 1625],
  storyboard: [1800, 1500],
  moodboard: [1800, 1250],
  biblia: [1800, 2250],
  personajes: [1800, 1625],
  plan: [1800, 1625],
  hoja: [1800, 1875],
  directo: [1800, 1750],
  claqueta: [1800, 1250],
  resumen: [1800, 1750],
};

export const CHAPTERS: Chapter[] = [
  {
    id: "hola",
    kicker: "Versión definitiva · Taller",
    title: "Del guion al rodaje",
    phase: 1,
    special: "intro",
    voice: "¡Hola! Soy el ajolote del Taller. En dos minutos te enseño cómo una película pasa del guion al día de rodaje. ¿Vamos?",
    beats: [],
  },
  {
    id: "guion",
    kicker: "01 · Escribir",
    title: "Subes el guion",
    phase: 1,
    special: "lectura",
    voice: "Todo empieza por el guion. Lo subes, o lo escribes aquí mismo, y yo lo leo: escenas, personajes y localizaciones, en segundos. Mientras escribes, ves lo que dura cada escena y lo que ya está preparado.",
    beats: [
      { shot: "guion", focus: [0.0, 0.06, 0.75, 0.2], label: "La tira: cada escena con lo que dura" },
      { shot: "guion", focus: [0.74, 0.08, 0.26, 0.62], label: "Lo que cuesta rodarlo" },
    ],
  },
  {
    id: "mesa",
    kicker: "02 · Preparar",
    title: "Tu mesa de preparación",
    phase: 2,
    voice: "Esta es tu mesa de preparación. Escena a escena ves qué está listo y qué falta. Y siempre te digo qué es lo que más frena ahora.",
    beats: [
      { shot: "mesa", focus: [0.2, 0.07, 0.52, 0.19], label: "Cuánto falta para rodar" },
      { shot: "mesa", focus: [0.2, 0.27, 0.53, 0.38], label: "Escena a escena" },
      { shot: "mesa", focus: [0.74, 0.27, 0.25, 0.18], label: "Lo que falta, por orden" },
    ],
  },
  {
    id: "desglose",
    kicker: "03 · Preparar",
    title: "El desglose",
    phase: 2,
    voice: "En el desglose lees cada escena y marcas sobre el texto lo que hace falta: atrezzo, vestuario, vehículos. Nada se queda fuera de la lista.",
    beats: [
      { shot: "desglose", focus: [0.36, 0.58, 0.38, 0.42], label: "Se marca sobre el texto" },
      { shot: "desglose", focus: [0.74, 0.57, 0.25, 0.27], label: "Lo que pide la escena" },
    ],
  },
  {
    id: "planos",
    kicker: "04 · Preparar",
    title: "Cómo se rueda",
    phase: 2,
    voice: "Luego decides cómo se rueda: plano a plano, con su tamaño, su movimiento y lo que se oye. El guion técnico y el storyboard salen solos.",
    beats: [
      { shot: "planos", focus: [0.54, 0.4, 0.45, 0.32], label: "Plano a plano, con guía" },
      { shot: "tecnico", focus: [0.2, 0.3, 0.64, 0.42], label: "El guion técnico" },
      { shot: "storyboard", focus: [0.2, 0.37, 0.6, 0.48], label: "El storyboard" },
    ],
  },
  {
    id: "moodboard",
    kicker: "05 · Escribir",
    title: "Cómo se ve la película",
    phase: 1,
    voice: "Aquí nace el aspecto de la película. Cada foto dice qué define y para qué escena es. Y la biblia visual lo ordena todo para enseñárselo a tu equipo.",
    beats: [
      { shot: "moodboard", focus: [0.2, 0.42, 0.78, 0.58], label: "El tablero" },
      { shot: "biblia", focus: [0.2, 0.1, 0.78, 0.17], label: "La paleta de la película" },
      { shot: "biblia", focus: [0.2, 0.26, 0.6, 0.22], label: "El tono" },
    ],
  },
  {
    id: "personajes",
    kicker: "06 · Preparar",
    title: "Personajes y reparto",
    phase: 2,
    voice: "Cada personaje tiene su ficha y su actor, y ves en qué escenas sale. Si falta alguien por elegir, te aviso antes de que sea tarde.",
    beats: [
      { shot: "personajes", focus: [0.2, 0.3, 0.78, 0.33], label: "Quién sale y en qué escenas" },
      { shot: "personajes", focus: [0.2, 0.67, 0.78, 0.27], label: "El reparto" },
    ],
  },
  {
    id: "plan",
    kicker: "07 · Rodar",
    title: "El plan de rodaje",
    phase: 3,
    voice: "Con todo preparado, repartes los planos en jornadas. Yo calculo las horas, la luz y a qué hora citar a cada uno. Y la hoja de llamada se envía con un enlace.",
    beats: [
      { shot: "plan", focus: [0.43, 0.38, 0.36, 0.6], label: "La jornada, hora a hora" },
      { shot: "plan", focus: [0.8, 0.38, 0.19, 0.4], label: "Avisos y citaciones" },
      { shot: "hoja", focus: [0.2, 0.23, 0.55, 0.42], label: "La hoja de llamada" },
    ],
  },
  {
    id: "rodaje",
    kicker: "08 · Rodar",
    title: "¡Se rueda!",
    phase: 3,
    special: "corten",
    voice: "Y llega el día de rodaje. Claqueta, tomas buenas, y si vais tarde, te digo qué se cae del día. Preparados… ¡y acción!",
    beats: [
      { shot: "directo", focus: [0.2, 0.15, 0.48, 0.12], label: "El plan frente al reloj" },
      { shot: "directo", focus: [0.72, 0.58, 0.27, 0.2], label: "¿Qué se cae del día?" },
      { shot: "claqueta", focus: [0.2, 0.42, 0.55, 0.58], label: "La claqueta" },
    ],
  },
  {
    id: "fin",
    kicker: "Fin",
    title: "¿Probamos con tu guion?",
    phase: 4,
    special: "outro",
    voice: "¡Corten! Eso es todo. Ahora te toca a ti: sube tu guion y te acompaño hasta el rodaje.",
    beats: [],
  },
];

// Duración de un capítulo sin audio grabado: lo que se tarda en decir el texto.
export function voiceSeconds(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(6, words / 2.55 + 1.2);
}
