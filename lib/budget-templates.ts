// Categorías de partida: punto de partida para un presupuesto nuevo. Solo los títulos; los importes
// los pone cada persona (no se inventan cifras). Sin dependencias de servidor.

const BASE = [
  "Equipo técnico",
  "Reparto",
  "Localizaciones y permisos",
  "Alquiler de equipo (cámara, luz y sonido)",
  "Arte, vestuario y maquillaje",
  "Catering y transporte",
  "Postproducción (montaje, color y sonido)",
  "Música y derechos",
  "Seguros e imprevistos",
];

const EXTRAS: Record<string, string[]> = {
  Publicidad: ["Agencia y producción ejecutiva", "Cesión de derechos de imagen"],
  Videoclip: ["Artista y baile", "Efectos visuales"],
  Documental: ["Viajes y desplazamientos", "Archivo y licencias"],
  Largometraje: ["Guion y desarrollo", "Distribución y festivales"],
  Serie: ["Guion y desarrollo", "Distribución y festivales"],
  Cortometraje: ["Festivales y difusión"],
};

// Antes de «Seguros e imprevistos», que va siempre al final.
export function starterBudgetCategories(projectType: string | null): string[] {
  const extras = (projectType && EXTRAS[projectType]) || [];
  const last = BASE[BASE.length - 1];
  return [...BASE.slice(0, -1), ...extras, last];
}
