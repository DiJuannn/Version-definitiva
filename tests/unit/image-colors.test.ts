import { describe, expect, it } from "vitest";
import { dominantColors } from "@/lib/image-colors";

const pixels = (spec: [number, number, number, number][]) => {
  const out: number[] = [];
  for (const [r, g, b, n] of spec) for (let i = 0; i < n; i++) out.push(r, g, b, 255);
  return new Uint8ClampedArray(out);
};

describe("colores dominantes", () => {
  it("ordena por frecuencia y descarta los casi iguales", () => {
    const data = pixels([
      [200, 30, 30, 50],
      [202, 32, 31, 20],
      [20, 20, 200, 30],
      [240, 240, 240, 5],
    ]);
    const colors = dominantColors(data, 5);
    expect(colors[0]).toMatch(/^#c[89a]1/);
    expect(colors).toHaveLength(3);
  });
});
