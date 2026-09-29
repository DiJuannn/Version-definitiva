import { z } from "zod";

/**
 * Anotaciones visuales. Todas las coordenadas se guardan NORMALIZADAS (0..1)
 * respecto al área real de la imagen (sin barras negras), de modo que el dibujo
 * se reproduce igual en cualquier tamaño de reproductor, pantalla completa o
 * vídeo vertical. El grosor se guarda relativo al ancho de la imagen.
 */

export const ANNOTATION_COLORS = ["#FFD23F", "#FF4D4D", "#3DDC97", "#4DA3FF", "#FFFFFF"] as const;

const point = z.tuple([z.number().min(-0.05).max(1.05), z.number().min(-0.05).max(1.05)]);

export const shapeSchema = z.object({
  t: z.enum(["pen", "arrow", "rect", "ellipse", "point"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  // Grosor relativo al ancho de la imagen (0.004 ≈ 4 px en 1000 px).
  w: z.number().min(0.001).max(0.05),
  pts: z.array(point).min(1).max(2000),
});

export const annotationSchema = z.object({
  v: z.literal(1),
  shapes: z.array(shapeSchema).min(1).max(60),
});

export type Shape = z.infer<typeof shapeSchema>;
export type Annotation = z.infer<typeof annotationSchema>;

export type Rect = { x: number; y: number; width: number; height: number };

/**
 * Rectángulo donde se pinta realmente la imagen dentro de un contenedor con
 * object-fit: contain (descuenta barras negras horizontales o verticales).
 */
export function contentRect(containerW: number, containerH: number, mediaW: number, mediaH: number): Rect {
  if (!mediaW || !mediaH || !containerW || !containerH) {
    return { x: 0, y: 0, width: containerW, height: containerH };
  }
  const scale = Math.min(containerW / mediaW, containerH / mediaH);
  const width = mediaW * scale;
  const height = mediaH * scale;
  return { x: (containerW - width) / 2, y: (containerH - height) / 2, width, height };
}

/** Convierte un punto de pantalla (relativo al contenedor) a coordenadas normalizadas. */
export function toNormalized(px: number, py: number, rect: Rect): [number, number] {
  const x = (px - rect.x) / rect.width;
  const y = (py - rect.y) / rect.height;
  return [clamp(x, -0.05, 1.05), clamp(y, -0.05, 1.05)];
}

export function fromNormalized(nx: number, ny: number, rect: Rect): [number, number] {
  return [rect.x + nx * rect.width, rect.y + ny * rect.height];
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Reduce puntos de trazo libre (distancia mínima) para no guardar miles de puntos. */
export function simplifyPath(pts: [number, number][], minDist = 0.002): [number, number][] {
  if (pts.length <= 2) return pts;
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [lx, ly] = out[out.length - 1];
    const [x, y] = pts[i];
    if (Math.hypot(x - lx, y - ly) >= minDist) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out.slice(0, 2000);
}

/** Redondea a 4 decimales (0,01 % de la imagen) para compactar el JSON. */
export function roundShape(s: Shape): Shape {
  return { ...s, w: +s.w.toFixed(4), pts: s.pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)] as [number, number]) };
}
