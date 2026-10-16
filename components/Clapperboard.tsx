import Link from "next/link";

// La claqueta del próximo rodaje, como una de verdad: los palos con sus
// franjas (se cierran una vez al entrar), la producción, el día, escenas y
// planos, la citación en dígitos de siete segmentos y quién dirige. Si se
// rueda hoy, el piloto REC se enciende y lleva al día en directo.
export function Clapperboard({
  production,
  day,
  dayCount,
  scenes,
  shots,
  callTime,
  place,
  director,
  live,
  meta,
}: {
  production: string;
  day: number;
  dayCount: number;
  scenes: number;
  shots: number;
  callTime: string | null;
  place: string | null;
  director: string | null;
  live: { href: string; on: boolean } | null;
  meta: string[];
}) {
  const cell = "border-line px-3.5 py-2.5";
  const label = "font-mono text-[10px] tracking-[0.16em] text-muted uppercase";
  const value = "poster-sub mt-1 block text-[24px] leading-none";
  return (
    <aside aria-label="Próximo rodaje" className="w-full">
      <div aria-hidden className="relative h-[66px]">
        <span className="clap-stick absolute inset-x-0 bottom-[2px] h-[30px] origin-bottom-left rounded-t-[3px] bg-[repeating-linear-gradient(-58deg,#f2f0ea_0_22px,#0b0b0d_22px_44px)] shadow-[0_0_0_1px_#0b0b0d]" />
        <span className="absolute bottom-[-6px] left-[-6px] z-10 h-4 w-4 rounded-full border-2 border-[#0b0b0d] bg-[#55534d]" />
      </div>
      <div aria-hidden className="h-[26px] rounded-t-[2px] bg-[repeating-linear-gradient(58deg,#f2f0ea_0_22px,#0b0b0d_22px_44px)] shadow-[0_0_0_1px_#0b0b0d]" />
      <div className="rounded-b-[var(--r-sm)] border border-t-0 border-line bg-[#0d0d10]">
        <div className={`${cell} border-b`}>
          <span className={label}>Prod.</span>
          <span className="poster-title mt-1 block truncate pt-1 text-[34px] leading-[1]">{production}</span>
        </div>
        <div className="grid grid-cols-3 border-b border-line">
          <div className={cell}>
            <span className={label}>Día</span>
            <span className={value}>
              {day}/{dayCount}
            </span>
          </div>
          <div className={`${cell} border-l`}>
            <span className={label}>Esc.</span>
            <span className={value}>{scenes}</span>
          </div>
          <div className={`${cell} border-l`}>
            <span className={label}>Pl.</span>
            <span className={value}>{shots}</span>
          </div>
        </div>
        <div className={`${cell} flex items-end justify-between gap-4 border-b`}>
          <div>
            <span className={label}>Citación</span>
            {callTime ? (
              <span className="mt-1.5 block rounded-[var(--r-xs)] bg-ink-0 px-2.5 py-1.5 shadow-[inset_0_0_0_1px_var(--line)]">
                <span className="seg seg-display text-[36px] leading-none text-fg" data-ghost="88:88">
                  {callTime.padStart(5, "0")}
                </span>
              </span>
            ) : (
              <span className="mt-2 block font-sans text-[15px] text-muted">Por fijar</span>
            )}
          </div>
          {live &&
            (live.on ? (
              <Link href={live.href} className="mb-1 flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-rec uppercase hover:underline">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-rec" />
                Rec · en directo
              </Link>
            ) : (
              <span className="mb-1 flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-line bg-[#3a1512]" />
                Rec · off
              </span>
            ))}
        </div>
        <div className="grid grid-cols-2">
          <div className={cell}>
            <span className={label}>Lugar</span>
            <span className="mt-1 block truncate font-sans text-[15px] font-semibold">{place ?? "Por fijar"}</span>
          </div>
          <div className={`${cell} border-l`}>
            <span className={label}>Dir.</span>
            <span className="poster-sub mt-1 block truncate text-[20px] leading-tight">{director ?? "—"}</span>
          </div>
        </div>
      </div>
      {meta.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-x-2 font-mono text-[11.5px] text-muted">
          {meta.map((m, i) => (
            <span key={m}>
              {i > 0 && <span aria-hidden className="mr-2">·</span>}
              {m}
            </span>
          ))}
        </p>
      )}
    </aside>
  );
}
