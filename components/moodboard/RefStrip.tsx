import Link from "next/link";
import { FACETS } from "@/lib/moodboard-types";
import type { VisualRef } from "@/lib/visual-refs";

const facetLabel = (r: VisualRef) => (r.facets ?? []).map((f) => FACETS.find((x) => x.key === f)?.label).filter(Boolean).join(" · ");

// Las referencias visuales de algo (una escena, un personaje…) en una tira:
// fotos con sus colores y referencias con su título. Lleva al moodboard.
export function RefStrip({ refs, projectId, title = "Referencias visuales", empty }: { refs: VisualRef[]; projectId: string; title?: string; empty?: string }) {
  if (refs.length === 0 && !empty) return null;
  return (
    <section aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">{title}</p>
        <Link href={`/app/${projectId}/moodboard`} className="font-sans text-[12.5px] text-muted underline decoration-line underline-offset-4 hover:text-fg">
          Moodboard →
        </Link>
      </div>
      {refs.length === 0 ? (
        <p className="mt-2 font-sans text-[13px] text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {refs.slice(0, 12).map((r) => (
            <li key={r.id} className="w-36 shrink-0">
              {r.type === "image" && r.url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.url} alt={r.caption ?? ""} loading="lazy" className="aspect-[4/3] w-full rounded-[var(--r-xs)] object-cover" />
                  {r.colors && r.colors.length > 0 && (
                    <span aria-hidden className="mt-1 flex h-1.5 overflow-hidden rounded-[2px]">
                      {r.colors.map((c) => (
                        <span key={c} className="flex-1" style={{ background: c }} />
                      ))}
                    </span>
                  )}
                  {(r.caption || facetLabel(r)) && <p className="mt-1 truncate font-sans text-[12px] text-muted">{r.caption || facetLabel(r)}</p>}
                </>
              ) : r.type === "palette" ? (
                <>
                  <span aria-hidden className="flex aspect-[4/3] overflow-hidden rounded-[var(--r-xs)]">
                    {(r.colors ?? []).map((c) => (
                      <span key={c} className="flex-1" style={{ background: c }} />
                    ))}
                  </span>
                  <p className="mt-1 truncate font-sans text-[12px] text-muted">{r.title || "Paleta"}</p>
                </>
              ) : (
                <div className="flex aspect-[4/3] flex-col rounded-[var(--r-xs)] border border-line p-2.5">
                  <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">{r.type === "note" ? "Nota" : [r.kind, r.year].filter(Boolean).join(" · ")}</p>
                  <p className="mt-1 line-clamp-4 font-sans text-[12.5px] leading-snug font-semibold">{r.type === "note" ? r.text : r.title}</p>
                  {facetLabel(r) && <p className="mt-auto truncate font-mono text-[10px] text-muted uppercase">{facetLabel(r)}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
