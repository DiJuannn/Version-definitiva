// Los colores dominantes de una imagen (en el navegador): se reduce a 48×48,
// se agrupan los píxeles por cubos de color y se quedan los más frecuentes
// que se distinguen entre sí. Para la paleta de cada foto del moodboard y la
// paleta de la película. Si la imagen no deja leerse (otro dominio sin
// permisos), devuelve [] sin error.

const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

export function dominantColors(data: Uint8ClampedArray, count = 5): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const k = buckets.get(key);
    if (k) {
      k.n++;
      k.r += r;
      k.g += g;
      k.b += b;
    } else buckets.set(key, { n: 1, r, g, b });
  }
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n).map((k) => [k.r / k.n, k.g / k.n, k.b / k.n] as const);
  const picked: (readonly [number, number, number])[] = [];
  for (const c of sorted) {
    if (picked.every((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) > 42)) picked.push(c);
    if (picked.length >= count) break;
  }
  return picked.map((c) => toHex(c[0], c[1], c[2]));
}

export async function extractColors(src: string, count = 5): Promise<string[]> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load"));
      img.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, 48, 48);
    return dominantColors(ctx.getImageData(0, 0, 48, 48).data, count);
  } catch {
    return [];
  }
}
