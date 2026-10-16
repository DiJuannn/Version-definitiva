// El cartel de un proyecto: imagen (si la hay), título en letra de cartel y
// el bloque de créditos abajo, como en un cartel de cine. Sin imagen es un
// cartel solo tipográfico, con el título en el color de la fase en curso.
export function ProjectPoster({
  name,
  coverUrl,
  billing,
  caption,
  accent = "var(--phase-2)",
  size = "md",
  children,
}: {
  name: string;
  coverUrl: string | null;
  // Créditos en una línea («Un proyecto de… · con… · fotografía…»).
  billing?: string;
  // Línea pequeña bajo el título («Rodando · día 2/3»).
  caption?: string;
  accent?: string;
  size?: "md" | "lg";
  // Encima del cartel (p. ej. el botón de cambiar la imagen).
  children?: React.ReactNode;
}) {
  const big = size === "lg";
  return (
    <div
      className="@container relative aspect-[2/3] overflow-hidden rounded-[4px] shadow-[0_26px_52px_-22px_#000,0_0_0_1px_rgba(255,255,255,0.06)]"
      style={coverUrl ? undefined : { background: "#1d1b24" }}
    >
      {coverUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent from-35% to-black/90 to-85%" />
        </>
      )}
      <div
        className={`absolute inset-x-0 flex flex-col ${coverUrl ? "bottom-0" : "top-0 bottom-0"} ${big ? "p-5" : "p-3.5"}`}
      >
        <p
          className={`poster-title break-words ${big ? "text-[min(64px,15cqw)]" : "text-[min(40px,15cqw)]"} ${coverUrl ? "text-white" : ""}`}
          style={coverUrl ? undefined : { color: accent }}
        >
          {name}
        </p>
        {caption && (
          <p className={`mt-2 font-mono text-[10px] tracking-[0.14em] uppercase ${coverUrl ? "text-white/70" : "mt-auto text-muted"}`}>
            {caption}
          </p>
        )}
        {billing && (
          <p
            className={`mt-3 text-center text-[10px] leading-[1.25] tracking-[0.06em] uppercase [font-stretch:62%] ${
              coverUrl ? "text-white/70" : "mt-auto text-muted"
            }`}
          >
            {billing}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
