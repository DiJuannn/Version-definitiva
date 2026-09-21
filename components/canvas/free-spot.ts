export type SpotRect = { x: number; y: number; w: number; h: number };

// Busca un hueco libre lo más cerca posible de (cx, cy) —en espiral— para que
// las tarjetas nuevas no se apilen encima de otras. Lo usan el Moodboard y el
// Mapa del proyecto.
export function findFreeSpot(rects: SpotRect[], cx: number, cy: number, w: number, h: number) {
  const gap = 24;
  const hits = (x: number, y: number) =>
    rects.some((r) => x < r.x + r.w + gap && x + w + gap > r.x && y < r.y + r.h + gap && y + h + gap > r.y);
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  const stepX = w + gap;
  const stepY = h + gap;
  for (let ring = 0; ring <= 8; ring++) {
    for (let i = -ring; i <= ring; i++) {
      for (let j = -ring; j <= ring; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const x = x0 + i * stepX;
        const y = y0 + j * stepY;
        if (!hits(x, y)) return { x, y };
      }
    }
  }
  return { x: x0 + 22 * (rects.length % 6), y: y0 + 22 * (rects.length % 6) };
}
