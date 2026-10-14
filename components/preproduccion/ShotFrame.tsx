// Encuadre dibujado de un plano: un rectángulo 16:9 con una figura humana
// recortada según el tamaño del plano (PG: figura pequeña en su entorno; PA:
// hasta las rodillas; PM: hasta la cintura; PP: la cara; PD: un objeto). Es
// un esquema, no una ilustración: sirve para leer la lista de planos de un
// vistazo, como los pictogramas que se dibujan a mano en un guion técnico.
//
// Todo se dibuja en un único «mundo» (figura de pie con los pies en y=100 y
// la cabeza en y=10, un horizonte y un objeto en el suelo) y cada tamaño es
// solo un viewBox distinto sobre ese mundo.

export type ShotSizeKind = "GPG" | "PG" | "PE" | "PA" | "PM" | "PMC" | "PP" | "PPP" | "PD";

export const SHOT_SIZE_NAMES: Record<ShotSizeKind, string> = {
  GPG: "Gran plano general",
  PG: "Plano general",
  PE: "Plano entero",
  PA: "Plano americano",
  PM: "Plano medio",
  PMC: "Plano medio corto",
  PP: "Primer plano",
  PPP: "Primerísimo primer plano",
  PD: "Plano detalle",
};

const EXACT: Record<string, ShotSizeKind> = {
  GPG: "GPG", PGL: "GPG", ELS: "GPG", EWS: "GPG", XLS: "GPG", XWS: "GPG",
  PG: "PG", LS: "PG", WS: "PG", PGC: "PG",
  PE: "PE", PC: "PE", FS: "PE",
  PA: "PA", MLS: "PA", MWS: "PA",
  PM: "PM", MS: "PM", PML: "PA",
  PMC: "PMC", MCU: "PMC",
  PP: "PP", CU: "PP",
  PPP: "PPP", GPP: "PPP", ECU: "PPP", XCU: "PPP", BCU: "PPP",
  PD: "PD", INS: "PD", INSERT: "PD", INSERTO: "PD",
};

// Lo que escribe la gente en «Tamaño» es libre: primero la abreviatura
// exacta (PG, MCU…) y si no, palabras clave («plano medio», «detalle»…).
export function shotSizeKind(raw: string | null | undefined): ShotSizeKind | null {
  if (!raw) return null;
  const token = raw.trim().toUpperCase().replace(/[.\s]/g, "");
  if (EXACT[token]) return EXACT[token];
  const t = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (/detalle|insert/.test(t)) return "PD";
  if (/primerisimo|extreme close|muy primer/.test(t)) return "PPP";
  if (/medio corto|medium close/.test(t)) return "PMC";
  if (/primer plano|close/.test(t)) return "PP";
  if (/americano|cowboy|medium long|3\/4/.test(t)) return "PA";
  if (/medio|medium|cintura/.test(t)) return "PM";
  if (/gran (plano )?general|extreme (long|wide)|panoramic/.test(t)) return "GPG";
  if (/entero|conjunto|full/.test(t)) return "PE";
  if (/general|long|wide|establec/.test(t)) return "PG";
  return null;
}

// Recorte (centro x, y superior, alto) de cada tamaño sobre el mundo.
const CROPS: Record<ShotSizeKind, { cx: number; top: number; h: number }> = {
  GPG: { cx: 20, top: -205, h: 320 },
  PG: { cx: 12, top: -48, h: 160 },
  PE: { cx: 0, top: 3, h: 103 },
  PA: { cx: 0, top: 5, h: 79 },
  PM: { cx: 0, top: 6, h: 56 },
  PMC: { cx: 0, top: 7, h: 39 },
  PP: { cx: 0, top: 7.5, h: 27 },
  PPP: { cx: 0, top: 11.5, h: 12 },
  PD: { cx: 42, top: 84, h: 22 },
};

function viewBoxFor(kind: ShotSizeKind) {
  const { cx, top, h } = CROPS[kind];
  const w = (h * 16) / 9;
  return `${cx - w / 2} ${top} ${w} ${h}`;
}

export function ShotFrame({
  size,
  className = "",
  title,
}: {
  size: string | null | undefined;
  className?: string;
  title?: string;
}) {
  const kind = shotSizeKind(size);
  const label = title ?? (kind ? SHOT_SIZE_NAMES[kind] : size ? `Tamaño: ${size}` : "Sin tamaño");
  return (
    <span
      {...(title === "" ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
      className={`relative block aspect-video overflow-hidden rounded-[5px] bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--fg)_22%,transparent)] ring-inset ${className}`}
    >
      {kind ? (
        <svg
          viewBox={viewBoxFor(kind)}
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full text-fg"
          aria-hidden
        >
          {/* Suelo y horizonte: solo se ven en los planos abiertos. */}
          <rect x={-2000} y={100} width={4000} height={2000} fill="currentColor" opacity={0.1} />
          <line x1={-2000} x2={2000} y1={64} y2={64} stroke="currentColor" strokeOpacity={0.28} vectorEffect="non-scaling-stroke" />
          {/* Unos árboles y un poste lejanos para dar escala en GPG/PG. */}
          <path d="M-150 64 l10 -26 l10 26 Z M-128 64 l7 -18 l7 18 Z M150 64 l12 -32 l12 32 Z" fill="currentColor" opacity={0.18} />
          {/* Un objeto en el suelo (diana): lo que encuadra el plano detalle. */}
          <g fill="none" stroke="currentColor" opacity={kind === "PD" ? 0.9 : 0.45}>
            <circle cx={42} cy={95} r={4.2} strokeWidth={1.3} />
            <circle cx={42} cy={95} r={1.6} fill="currentColor" stroke="none" />
            {kind === "PD" && <path d="M42 87.5 v2.5 M42 100 v2.5 M34.5 95 h2.5 M47 95 h2.5" strokeWidth={0.7} />}
          </g>
          {/* Figura. */}
          <g fill="currentColor" opacity={0.82}>
            <circle cx={0} cy={18} r={8} />
            <path d="M-13 33 Q-13 27.5 -7.5 27.5 L7.5 27.5 Q13 27.5 13 33 L14.5 58 L10.5 58 L9.5 40 L9 62 L-9 62 L-9.5 40 L-10.5 58 L-14.5 58 Z" />
            <path d="M-9 61 L-1 61 L-1.5 100 L-9 100 Z M1 61 L9 61 L9 100 L1.5 100 Z" />
          </g>
          {/* La cara solo se dibuja cuando se ve. */}
          {(kind === "PP" || kind === "PPP" || kind === "PMC") && (
            <g className="fill-[var(--bg)]">
              <circle cx={-3} cy={17.3} r={kind === "PPP" ? 0.9 : 1.1} />
              <circle cx={3} cy={17.3} r={kind === "PPP" ? 0.9 : 1.1} />
              <path d="M-2.4 21.6 Q0 23 2.4 21.6" fill="none" stroke="var(--bg)" strokeWidth={0.6} />
            </g>
          )}
        </svg>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] tracking-widest text-muted uppercase">
          {size ? size.slice(0, 6) : "?"}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- cámara

type AngleKind = "normal" | "picado" | "contrapicado" | "cenital" | "nadir" | "holandes";

export function angleKind(raw: string | null | undefined): AngleKind | null {
  if (!raw) return null;
  const t = raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/contra|low/.test(t)) return "contrapicado";
  if (/nadir|worm/.test(t)) return "nadir";
  if (/cenit|overhead|top|aereo|bird/.test(t)) return "cenital";
  if (/picad|high/.test(t)) return "picado";
  if (/holand|dutch|aberrant|inclin/.test(t)) return "holandes";
  return "normal";
}

// Flecha que sale del objetivo hacia donde mira la cámara.
const ANGLE_ROTATION: Record<AngleKind, number> = {
  normal: 0,
  picado: 35,
  contrapicado: -35,
  cenital: 90,
  nadir: -90,
  holandes: 0,
};

export function AngleIcon({ angle, className = "h-4 w-4" }: { angle: string | null | undefined; className?: string }) {
  const kind = angleKind(angle);
  if (!kind) return null;
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      {kind === "holandes" ? (
        <rect x={3} y={4.5} width={10} height={7} rx={1} transform="rotate(-18 8 8)" />
      ) : (
        <g transform={`rotate(${ANGLE_ROTATION[kind]} 5 8)`}>
          <circle cx={4} cy={8} r={1.6} fill="currentColor" stroke="none" />
          <path d="M6.5 8 H13.5 M11 5.5 L13.5 8 L11 10.5" />
        </g>
      )}
    </svg>
  );
}

export function MovementIcon({ movement, className = "h-4 w-4" }: { movement: string | null | undefined; className?: string }) {
  if (!movement) return null;
  const t = movement.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let d: string;
  if (/fijo|static|tripode|locked/.test(t)) d = "M8 3 V8 M8 8 L3.5 13.5 M8 8 L12.5 13.5 M8 8 V13.5";
  else if (/zoom/.test(t)) d = "M3 3 L6 6 M13 3 L10 6 M3 13 L6 10 M13 13 L10 10 M3 3 h2.5 M3 3 v2.5 M13 13 h-2.5 M13 13 v-2.5";
  else if (/grua|crane|jib|dron|drone/.test(t)) d = "M2.5 13 Q4 4 13 3.5 M10.5 1.5 L13 3.5 L10.8 6";
  else if (/pan|tilt/.test(t)) d = "M3 10 Q8 2.5 13 10 M10.5 9.6 L13 10 L13.3 7.4";
  else if (/steadi|mano|hand|gimbal/.test(t)) d = "M2 8.5 Q4 5.5 6 8.5 T10 8.5 T14 8.5";
  else d = "M2 11.5 H14 M2 13.5 H14 M3 7 H12.5 M10 4.5 L12.5 7 L10 9.5"; // travelling y demás
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
