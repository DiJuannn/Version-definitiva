import Link from "next/link";
import { FACETS, type Facet, type MoodboardLookup } from "@/lib/moodboard-types";
import { filmPalette, refsFor, type VisualRef } from "@/lib/visual-refs";

function Tile({ r }: { r: VisualRef }) {
  if (r.type === "image" && r.url)
    return (
      <figure className="break-inside-avoid">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={r.url} alt={r.caption ?? ""} loading="lazy" className="w-full rounded-[var(--r-xs)]" />
        {r.colors && r.colors.length > 0 && (
          <span aria-hidden className="mt-1.5 flex h-2 overflow-hidden rounded-[2px]">
            {r.colors.map((c) => (
              <span key={c} className="flex-1" style={{ background: c }} />
            ))}
          </span>
        )}
        {r.caption && <figcaption className="mt-1.5 font-sans text-[12.5px] text-muted">{r.caption}</figcaption>}
      </figure>
    );
  if (r.type === "palette")
    return (
      <figure className="break-inside-avoid">
        <span aria-hidden className="flex h-20 overflow-hidden rounded-[var(--r-xs)]">
          {(r.colors ?? []).map((c) => (
            <span key={c} className="flex-1" style={{ background: c }} />
          ))}
        </span>
        <figcaption className="mt-1.5 font-mono text-[11px] text-muted uppercase">
          {r.title || "Paleta"} · {(r.colors ?? []).join(" ")}
        </figcaption>
      </figure>
    );
  return (
    <div className="break-inside-avoid rounded-[var(--r-sm)] border border-line p-3.5">
      <p className="font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">{r.type === "note" ? "Nota" : [r.kind, r.year].filter(Boolean).join(" · ")}</p>
      {r.type === "note" ? (
        <p className="mt-1.5 font-sans text-[14.5px] leading-relaxed whitespace-pre-line">{r.text}</p>
      ) : (
        <>
          <p className="poster-sub mt-1 text-[17px] leading-tight">{r.title}</p>
          {r.why && <p className="mt-1.5 font-sans text-[13px] leading-snug text-muted">{r.why}</p>}
        </>
      )}
    </div>
  );
}

function Grid({ refs }: { refs: VisualRef[] }) {
  return (
    <div className="columns-2 gap-4 space-y-4 sm:columns-3 lg:columns-4 print:columns-3">
      {refs.map((r) => (
        <Tile key={r.id} r={r} />
      ))}
    </div>
  );
}

function Chapter({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-8 break-inside-avoid-page print:break-before-page">
      <p className="font-mono text-[11px] tracking-[0.16em] text-muted uppercase">
        {String(n).padStart(2, "0")}
        {sub ? ` · ${sub}` : ""}
      </p>
      <h2 className="poster-title mt-1 text-[40px]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

// La Biblia visual: el moodboard ordenado para enseñarlo (al equipo, a quien
// financia): la paleta de la película, el tono, cada aspecto (luz, encuadre,
// vestuario…), los personajes y las escenas. Se imprime como PDF.
export function VisualBible({ projectId, projectName, refs, lookup }: { projectId: string; projectName: string; refs: VisualRef[]; lookup: MoodboardLookup }) {
  const palette = filmPalette(refs);
  const byFacet = (f: Facet) => refs.filter((r) => r.facets?.includes(f) && (r.type !== "note" || r.text?.trim()));
  const tone = refs.filter((r) => r.facets?.includes("tono") || (r.type === "note" && !r.facets?.length && r.text?.trim()));
  const facets = FACETS.filter((f) => f.key !== "tono").map((f) => ({ ...f, refs: byFacet(f.key) })).filter((f) => f.refs.length);
  const characters = lookup.characters.map((c) => ({ ...c, refs: refsFor(refs, { characterId: c.id }, ["vestuario"]) })).filter((c) => c.refs.length);
  const scenes = lookup.scenes.map((s) => ({ ...s, refs: refsFor(refs, { sceneId: s.id }, ["luz", "encuadre"]) })).filter((s) => s.refs.length);
  const loose = refs.filter((r) => !r.facets?.length && !r.scenes?.length && !r.characters?.length && !r.locations?.length && r.type !== "note").length;
  let n = 0;

  if (refs.length === 0)
    return (
      <p className="mt-8 max-w-xl font-sans text-[15px] text-muted">
        La Biblia visual se monta sola con lo que pongas en el tablero. Añade fotos, paletas y referencias y márcales qué definen y para qué escena son.
      </p>
    );

  return (
    <article className="print-doc mt-8 space-y-12">
      <header className="pb-2">
        <p className="font-mono text-[11px] tracking-[0.16em] text-muted uppercase">Biblia visual</p>
        <h1 className="poster-title mt-2 text-[64px] sm:text-[88px]">{projectName}</h1>
        {palette.length > 0 && (
          <div className="mt-6">
            <div className="flex h-24 overflow-hidden rounded-[var(--r-sm)]">
              {palette.map((c) => (
                <span key={c} className="flex-1" style={{ background: c }} />
              ))}
            </div>
            <p className="mt-2 flex flex-wrap gap-x-4 font-mono text-[11px] text-muted uppercase">
              <span>La paleta de la película</span>
              {palette.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </p>
          </div>
        )}
        {loose > 0 && (
          <p className="mt-4 font-sans text-[13.5px] text-muted print:hidden">
            {loose === 1 ? "1 tarjeta del tablero aún no dice" : `${loose} tarjetas del tablero aún no dicen`} qué define ni para qué es: no salen aquí.{" "}
            <Link href={`/app/${projectId}/moodboard`} className="text-fg underline decoration-line underline-offset-4">
              Marcarlas en el tablero
            </Link>
          </p>
        )}
      </header>

      {tone.length > 0 && (
        <Chapter n={++n} title="El tono" sub="cómo se tiene que sentir">
          <Grid refs={tone} />
        </Chapter>
      )}
      {facets.map((f) => (
        <Chapter key={f.key} n={++n} title={f.label} sub={`${f.refs.length} ${f.refs.length === 1 ? "referencia" : "referencias"}`}>
          <Grid refs={f.refs} />
        </Chapter>
      ))}
      {characters.length > 0 && (
        <Chapter n={++n} title="Personajes">
          <div className="space-y-8">
            {characters.map((c) => (
              <div key={c.id}>
                <p className="poster-sub text-[20px]">
                  {c.name}
                  {c.actor && <span className="ml-2 font-sans text-[14px] font-normal tracking-normal text-muted normal-case">{c.actor}</span>}
                </p>
                <div className="mt-3">
                  <Grid refs={c.refs} />
                </div>
              </div>
            ))}
          </div>
        </Chapter>
      )}
      {scenes.length > 0 && (
        <Chapter n={++n} title="Escena a escena">
          <div className="space-y-8">
            {scenes.map((s) => (
              <div key={s.id}>
                <p className="font-[family-name:var(--font-courier)] text-[15px] font-bold uppercase">
                  {s.number}. {s.heading}
                </p>
                <div className="mt-3">
                  <Grid refs={s.refs} />
                </div>
              </div>
            ))}
          </div>
        </Chapter>
      )}
    </article>
  );
}
