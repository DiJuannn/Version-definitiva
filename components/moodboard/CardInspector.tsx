"use client";

import { FACETS, type Facet, type MoodboardCard, type MoodboardLookup } from "@/lib/moodboard-types";

const CHIP = "nodrag rounded-[var(--r-xs)] border px-2 py-1 font-sans text-[12.5px] leading-none transition-colors";
const on = "border-fg bg-fg text-bg";
const off = "border-line text-muted hover:border-fg/50 hover:text-fg";

// La ficha de una tarjeta del moodboard: qué define (luz, encuadre,
// vestuario…) y para qué escenas, personajes y localizaciones es. Es lo que
// la lleva a cada herramienta del proyecto y a la Biblia visual.
export function CardInspector({
  card,
  lookup,
  onChange,
}: {
  card: MoodboardCard;
  lookup: MoodboardLookup;
  onChange: (patch: Partial<MoodboardCard>) => void;
}) {
  const facets = card.facets ?? [];
  const toggle = (key: "scenes" | "characters" | "locations", id: string) => {
    const list: string[] = card[key] ?? [];
    onChange({ [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] } as Partial<MoodboardCard>);
  };
  const toggleFacet = (f: Facet) => onChange({ facets: facets.includes(f) ? facets.filter((x) => x !== f) : [...facets, f].slice(0, 4) });

  return (
    <aside
      aria-label="Ficha de la referencia"
      className="taller-ink nowheel w-[17.5rem] max-w-[calc(100vw-3rem)] overflow-y-auto rounded-[var(--r-md)] bg-bg-raised p-4 text-fg shadow-[0_18px_40px_-16px_rgb(0_0_0/0.6)]"
      style={{ maxHeight: "calc(100dvh - 22rem)" }}
    >
      <p className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">Qué define</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FACETS.map((f) => (
          <button key={f.key} type="button" aria-pressed={facets.includes(f.key)} onClick={() => toggleFacet(f.key)} className={`${CHIP} ${facets.includes(f.key) ? on : off}`}>
            {f.label}
          </button>
        ))}
      </div>

      {lookup.scenes.length > 0 && (
        <>
          <p className="mt-4 font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">Para las escenas</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {lookup.scenes.map((s) => {
              const sel = card.scenes?.includes(s.id) ?? false;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={sel}
                  title={s.heading}
                  onClick={() => toggle("scenes", s.id)}
                  className={`nodrag grid h-7 min-w-7 place-items-center rounded-[var(--r-xs)] border px-1.5 font-mono text-[11.5px] font-semibold transition-colors ${sel ? on : off}`}
                >
                  {s.number}
                </button>
              );
            })}
          </div>
        </>
      )}

      {lookup.characters.length > 0 && (
        <>
          <p className="mt-4 font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">Para los personajes</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lookup.characters.map((c) => (
              <button key={c.id} type="button" aria-pressed={card.characters?.includes(c.id) ?? false} onClick={() => toggle("characters", c.id)} className={`${CHIP} ${card.characters?.includes(c.id) ? on : off}`}>
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}

      {lookup.locations.length > 0 && (
        <>
          <p className="mt-4 font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">Para las localizaciones</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lookup.locations.map((l) => (
              <button key={l.id} type="button" aria-pressed={card.locations?.includes(l.id) ?? false} onClick={() => toggle("locations", l.id)} className={`${CHIP} ${card.locations?.includes(l.id) ? on : off}`}>
                {l.name}
              </button>
            ))}
          </div>
        </>
      )}

      <p className="mt-4 border-t border-line pt-3 font-sans text-[12px] leading-snug text-muted">
        Lo que marques aquí sale en la ficha de cada escena, en Planos (luz y encuadre), en el Desglose (vestuario y arte), en Personajes y en la Biblia visual.
      </p>
    </aside>
  );
}
