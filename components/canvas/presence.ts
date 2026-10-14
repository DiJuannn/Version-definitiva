// Identidad visible en las pizarras compartidas (Moodboard y Mapa del proyecto).

// Color estable por persona para su cursor y su avatar.
export function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h}, 75%, 62%)`;
}

// Lo que llega de otros navegadores no es de fiar: se limpia antes de pintarlo.
export const cleanName = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 30) : "Alguien");
export const cleanColor = (v: unknown) =>
  typeof v === "string" && /^hsl\(\d{1,3}, 75%, 62%\)$/.test(v) ? v : "hsl(0, 0%, 70%)";

export type Peer = { key: string; userId: string; name: string; color: string };

// Una persona con dos pestañas abiertas cuenta una vez.
export const uniquePeers = <T extends { userId: string }>(list: T[]) => [...new Map(list.map((p) => [p.userId, p])).values()];

// Mismo color en hex (#rrggbb): los cursores del editor de guiones (TipTap)
// solo aceptan ese formato.
export function hexColorFor(id: string): string {
  const h = Number(colorFor(id).match(/^hsl\((\d+)/)?.[1] ?? 0);
  const s = 0.75;
  const l = 0.62;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`;
}

export const cleanHexColor = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : "#b3b3b3");
