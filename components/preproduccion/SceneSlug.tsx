import Link from "next/link";
import { courierPrime } from "@/lib/screenplay/font";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import type { DayPart, IntExt } from "@/lib/generated/prisma";

// Encabezado de escena tal como se escribe en un guion: INT. LUGAR — MOMENTO,
// en Courier y mayúsculas. Si falta la localización se dice, en minúscula,
// para que se vea como hueco y no como un lugar llamado «sin localización».
export function SceneSlug({
  intExt,
  dayPart,
  location,
  className = "",
}: {
  intExt: IntExt;
  dayPart: DayPart;
  location: string | null | undefined;
  className?: string;
}) {
  return (
    <span className={`${courierPrime.className} font-bold tracking-normal uppercase ${className}`}>
      {INT_EXT_LABELS[intExt]}.{" "}
      {location ? location : <span className="font-normal text-muted normal-case italic">sin localización</span>}
      {" — "}
      {DAY_PART_LABELS[dayPart]}
    </span>
  );
}

// «Siguiente: …» al pie de cada herramienta: la que toca después en el flujo.
export function NextTool({ href, label, hint }: { href: string; label: string; hint?: string }) {
  return (
    <p className="mt-16 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line pt-5 font-sans text-sm text-muted print:hidden">
      <span className="eyebrow">Siguiente</span>
      <Link
        href={href}
        className="font-display font-bold text-fg underline decoration-line underline-offset-4 transition-colors hover:text-accent hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {label} →
      </Link>
      {hint && <span>{hint}</span>}
    </p>
  );
}
