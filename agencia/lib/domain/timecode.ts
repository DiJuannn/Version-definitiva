/**
 * Utilidades de tiempo. La plataforma guarda los tiempos en milisegundos.
 * La precisión por fotograma solo se anuncia cuando fps está verificado por
 * el pipeline de media (Version.fpsVerified); si no, se muestra "≈".
 */

export function formatClock(ms: number, withMs = false): string {
  const neg = ms < 0;
  const total = Math.abs(Math.round(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const rest = total % 1000;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  const base = h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  return (neg ? "-" : "") + (withMs ? `${base}.${String(rest).padStart(3, "0")}` : base);
}

/** Timecode SMPTE no-drop HH:MM:SS:FF a partir de ms y fps. */
export function formatTimecode(ms: number, fps: number): string {
  const nominal = Math.round(fps);
  const totalFrames = msToFrame(ms, fps);
  const f = totalFrames % nominal;
  const totalSeconds = Math.floor(totalFrames / nominal);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s, f].map((n) => String(n).padStart(2, "0")).join(":");
}

export function msToFrame(ms: number, fps: number): number {
  // Pequeño epsilon para no caer al fotograma anterior por redondeo de coma flotante.
  return Math.floor((ms / 1000) * fps + 1e-6);
}

export function frameToMs(frame: number, fps: number): number {
  return (frame / fps) * 1000;
}

/**
 * Centro temporal de un fotograma: buscar al centro evita que el navegador
 * muestre el fotograma anterior al redondear currentTime.
 */
export function frameCenterSeconds(frame: number, fps: number): number {
  return (frame + 0.5) / fps;
}

/** Interpreta "1:23", "01:02:03", "83" (segundos) o "00:00:05:12" (con fps). */
export function parseTime(input: string, fps?: number | null): number | null {
  const t = input.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t) * 1000);
  const parts = t.split(":");
  if (parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.length === 4) {
    if (!fps) return null;
    const [h, m, s, f] = nums;
    return Math.round(((h * 3600 + m * 60 + s) + f / fps) * 1000);
  }
  if (nums.length === 3) return Math.round((nums[0] * 3600 + nums[1] * 60 + nums[2]) * 1000);
  if (nums.length === 2) return Math.round((nums[0] * 60 + nums[1]) * 1000);
  return null;
}

export const COMMON_FPS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
