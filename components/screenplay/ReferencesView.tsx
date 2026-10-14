"use client";

import { useMemo, useState } from "react";
import { suggestReferencesAction } from "@/lib/actions/screenplay-ai";
import { useYMap } from "@/lib/screenplay/use-ymap";
import { REFERENCE_KINDS, type Reference } from "@/lib/screenplay/story";
import {
  AiButton,
  ReferenceForm,
  ReferenceRow,
  SectionLabel,
  addReference,
  pushSuggestions,
  suggestionsOf,
  useWorkspace,
} from "@/components/screenplay/workspace";

type Filter = "all" | "script" | "scene" | "character";

// La mesa de referencias: todas juntas, con filtros y buscador. Arriba, lo
// que ha sugerido la IA y aún nadie ha guardado o descartado.
export function ReferencesView() {
  const { screenplayId, maps, scenes, userName } = useWorkspace();
  const refs = useYMap<Reference>(maps.refs);
  const ai = useYMap<unknown>(maps.ai);
  const [filter, setFilter] = useState<Filter>("all");
  const [kind, setKind] = useState<string>("");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const suggestions = suggestionsOf(ai);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return Object.values(refs)
      .filter((r) => filter === "all" || r.anchor.type === filter)
      .filter((r) => !kind || r.kind === kind)
      .filter((r) => !needle || [r.title, r.author, r.detail, r.year].some((v) => v?.toLowerCase().includes(needle)))
      .sort((a, b) => b.at - a.at);
  }, [refs, filter, kind, q]);

  const dropSuggestion = (id: string) => maps.ai.set("suggestions", suggestionsOf(maps.ai.toJSON()).filter((s) => s.id !== id));
  const filters: [Filter, string][] = [
    ["all", "Todas"],
    ["script", "Historia"],
    ["scene", "Escenas"],
    ["character", "Personajes"],
  ];

  return (
    <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line pb-3 font-mono text-[11px] tracking-widest uppercase">
          {filters.map(([f, label]) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={filter === f ? "text-fg underline decoration-accent underline-offset-8" : "text-muted hover:text-fg"}
            >
              {label}
            </button>
          ))}
          <select
            aria-label="Tipo de referencia"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="bg-bg font-mono text-[11px] text-muted tracking-normal normal-case outline-none"
          >
            <option value="">Todos los tipos</option>
            {Object.entries(REFERENCE_KINDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            aria-label="Buscar referencias"
            className="ml-auto w-40 border-b border-line bg-transparent py-1 font-sans text-sm tracking-normal normal-case outline-none focus:border-accent"
          />
        </div>

        {list.length === 0 ? (
          <p className="mt-10 max-w-md font-sans text-sm text-muted">
            {Object.keys(refs).length
              ? "Nada coincide con el filtro."
              : "Aún no hay referencias. Añade las tuyas o pide sugerencias a la IA: películas, escenas, cuadros, músicas, escenarios, ideas de montaje…"}
          </p>
        ) : (
          <div className="mt-2 grid gap-x-10 md:grid-cols-2">
            {list.map((r) => (
              <div key={r.id} className="border-b border-line">
                <ReferenceRow item={r} scenes={scenes} showAnchor onDelete={() => maps.refs.delete(r.id)} />
              </div>
            ))}
          </div>
        )}
      </div>

      <aside className="space-y-10">
        <section>
          <SectionLabel
            right={
              !adding && (
                <button type="button" onClick={() => setAdding(true)} className="font-mono text-[10px] tracking-widest text-accent uppercase hover:text-fg">
                  + Añadir
                </button>
              )
            }
          >
            Añadir a mano
          </SectionLabel>
          {adding ? (
            <div className="mt-4">
              <ReferenceForm defaultAnchor={{ type: "script" }} onDone={() => setAdding(false)} compact />
            </div>
          ) : (
            <p className="mt-3 font-sans text-[13px] text-muted">Para la historia, una escena o un personaje. Con enlace si quieres.</p>
          )}
        </section>

        <section>
          <SectionLabel right={suggestions.length > 0 && <span className="font-mono text-[10px] text-warn">{suggestions.length} sin revisar</span>}>
            Sugerencias de la IA
          </SectionLabel>
          <p className="mt-3 font-sans text-[13px] text-muted">
            La IA lee el guion y propone obras reales. Puede equivocarse con algún título o año: guarda solo lo que te sirva.
          </p>
          <AiButton
            className="mt-4"
            label="Sugerir para toda la historia"
            run={async () => {
              const res = await suggestReferencesAction(screenplayId, { type: "script" });
              if (!res.ok) return res;
              return pushSuggestions(maps, res.suggestions) ? res : { ok: false as const, error: "Todo lo que ha propuesto ya lo tienes. Prueba otra vez." };
            }}
          />
          <div className="mt-4 divide-y divide-line">
            {suggestions.map((s) => (
              <ReferenceRow
                key={s.id}
                item={s}
                scenes={scenes}
                showAnchor
                onAccept={() => {
                  addReference(maps, { ...s, source: "ai", by: userName, at: Date.now() });
                  dropSuggestion(s.id);
                }}
                onDelete={() => dropSuggestion(s.id)}
              />
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
