import type { ReactNode } from "react";
import Image from "next/image";

// Grano de película real (ruido vía SVG), no el degradado suave de "orbe de
// color" típico de plantillas SaaS — mismo motivo que cualquier viñeta de
// cine, siempre visible (no depende de hover, que en una sección a pantalla
// completa como el hero casi nadie llega a activar).
const GRAIN_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

export function PlaceholderFrame({
  children,
  className,
  imageUrl,
  imageAlt,
  imagePriority,
  imageSizes,
}: {
  children?: ReactNode;
  className?: string;
  // Fotografía real opcional detrás del grano/viñeta — el marco decorativo
  // es el mismo con o sin foto, así que un hero sin imagen todavía y uno
  // con fotografía real de rodaje comparten exactamente la misma identidad.
  imageUrl?: string | null;
  imageAlt?: string;
  imagePriority?: boolean;
  imageSizes?: string;
}) {
  // "relative" solo se aplica si el que llama no ha pedido ya su propia
  // posición (p. ej. "absolute inset-0" para ocupar toda la pantalla) —
  // Tailwind no sabe resolver ese choque de clases por sí solo.
  const hasOwnPosition = /\b(absolute|fixed|static|sticky)\b/.test(
    className ?? "",
  );

  return (
    <div
      className={`${hasOwnPosition ? "" : "relative"} overflow-hidden bg-bg-raised ${className ?? ""}`}
    >
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={imageAlt ?? ""}
          fill
          priority={imagePriority}
          sizes={imageSizes ?? "100vw"}
          className="object-cover [animation:hero-kenburns_28s_ease-in-out_infinite_alternate]"
        />
      )}
      {/* Con foto real hace falta más contraste para que el texto encima
          siga siendo legible — sin foto, la viñeta suave de siempre. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={
          imageUrl
            ? {
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 35%, rgba(0,0,0,0.6) 100%)",
                boxShadow: "inset 0 0 18vw rgba(0,0,0,0.5)",
              }
            : { boxShadow: "inset 0 0 18vw rgba(0,0,0,0.55)" }
        }
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay [animation:film-flicker_6s_ease-in-out_infinite]"
        style={{ backgroundImage: `url("${GRAIN_URL}")` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 3px)",
        }}
      />
      {children}
    </div>
  );
}
