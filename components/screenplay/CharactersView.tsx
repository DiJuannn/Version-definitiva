"use client";

import { useState } from "react";
import { suggestReferencesAction } from "@/lib/actions/screenplay-ai";
import { useYMap } from "@/lib/screenplay/use-ymap";
import { characterThread, type CharacterMeta, type Reference, type StoryReading } from "@/lib/screenplay/story";
import {
  AiButton,
  InlineText,
  ReferenceForm,
  ReferenceRow,
  SectionLabel,
  addReference,
  pushSuggestions,
  suggestionsOf,
  useWorkspace,
} from "@/components/screenplay/workspace";

const FIELDS: { key: keyof CharacterMeta; label: string; placeholder: string }[] = [
  { key: "want", label: "Quiere", placeholder: "Lo que persigue durante la historia" },
  { key: "need", label: "Necesita", placeholder: "Lo que de verdad le hace falta (aunque no lo sepa)" },
  { key: "fear", label: "Teme", placeholder: "" },
  { key: "secret", label: "Oculta", placeholder: "" },
  { key: "arc", label: "Arco", placeholder: "De dónde sale y a dónde llega" },
  { key: "notes", label: "Notas", placeholder: "Pasado, manías, cómo habla…" },
];

// Personajes: ficha (escrita por el equipo), su hilo por la historia y las
// referencias de "me recuerda a…".
export function CharactersView() {
  const { screenplayId, maps, blocks, scenes, characters, goToScene, setView, userName } = useWorkspace();
  const fichas = useYMap<CharacterMeta>(maps.characters);
  const refs = useYMap<Reference>(maps.refs);
  const ai = useYMap<unknown>(maps.ai);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (!characters.length) {
    return <p className="max-w-md py-16 font-sans text-sm text-muted">Los personajes aparecen aquí en cuanto tienen su primer diálogo.</p>;
  }

  const name = selected && characters.some((c) => c.name === selected) ? selected : characters[0].name;
  const ficha = fichas[name] ?? {};
  const thread = characterThread(blocks, scenes, name);
  const presentIn = new Set(thread.map((t) => t.scene.sid));
  const speaksIn = new Set(thread.filter((t) => t.speaks).map((t) => t.scene.sid));
  const reading = (ai.reading as StoryReading | undefined)?.characters.find((c) => c.name === name);
  const mine = Object.values(refs).filter((r) => r.anchor.type === "character" && r.anchor.name === name);
  const suggestions = suggestionsOf(ai).filter((s) => s.anchor.type === "character" && s.anchor.name === name);
  const dropSuggestion = (id: string) => maps.ai.set("suggestions", suggestionsOf(maps.ai.toJSON()).filter((s) => s.id !== id));

  return (
    <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Personajes">
        <ul className="space-y-px">
          {characters.map((c) => (
            <li key={c.name}>
              <button
                type="button"
                onClick={() => {
                  setSelected(c.name);
                  setAdding(false);
                }}
                aria-current={c.name === name}
                className={`flex w-full items-baseline justify-between gap-2 border-l-2 px-3 py-2 text-left font-mono text-xs transition-colors ${
                  c.name === name ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
                }`}
              >
                <span className="truncate">{c.name}</span>
                <span className="text-[10px]">{c.lines}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0">
        <h2 className="font-[family-name:var(--font-courier)] text-3xl font-bold tracking-tight uppercase">{name}</h2>
        <p className="mt-2 font-mono text-[11px] text-muted">
          {thread.length} de {scenes.length} escenas · habla en {speaksIn.size} ·{" "}
          {characters.find((c) => c.name === name)?.lines ?? 0} diálogos
        </p>

        {/* El hilo: una marca por escena */}
        <div className="mt-6 flex flex-wrap gap-1" aria-label="Presencia en cada escena">
          {scenes.map((s) => (
            <button
              key={s.sid}
              type="button"
              title={`${s.number}. ${s.heading}${speaksIn.has(s.sid) ? " · habla" : presentIn.has(s.sid) ? " · aparece" : ""}`}
              onClick={() => {
                setView("page");
                goToScene(s.sid);
              }}
              className={`h-6 w-4 transition-transform hover:scale-y-125 ${
                speaksIn.has(s.sid) ? "bg-accent" : presentIn.has(s.sid) ? "border border-accent" : "bg-white/[0.06]"
              }`}
            />
          ))}
        </div>
        <p className="mt-2 font-mono text-[10px] text-muted">
          <span className="mr-1 inline-block h-2 w-2 bg-accent" /> habla <span className="mr-1 ml-3 inline-block h-2 w-2 border border-accent" />{" "}
          aparece <span className="mr-1 ml-3 inline-block h-2 w-2 bg-white/10" /> no está
        </p>

        <div className="mt-10 grid gap-12 xl:grid-cols-2">
          <section>
            <SectionLabel>Ficha</SectionLabel>
            <dl className="mt-2 divide-y divide-line">
              {FIELDS.map((f) => (
                <div key={f.key} className="grid grid-cols-[88px_1fr] gap-3 py-2.5">
                  <dt className="pt-0.5 font-mono text-[10px] tracking-widest text-muted uppercase">{f.label}</dt>
                  <dd>
                    <InlineText
                      label={`${f.label} — ${name}`}
                      value={ficha[f.key] ?? ""}
                      placeholder={f.placeholder || "—"}
                      rows={f.key === "notes" || f.key === "arc" ? 3 : 1}
                      onSave={(v) => maps.characters.set(name, { ...(maps.characters.get(name) ?? {}), [f.key]: v })}
                      className="font-sans text-sm leading-relaxed"
                    />
                  </dd>
                </div>
              ))}
            </dl>
            {reading && (
              <div className="mt-6 border-l-2 border-dashed border-warn/60 pl-4">
                <p className="font-mono text-[10px] tracking-widest text-warn uppercase">Lo que entiende la IA</p>
                <p className="mt-2 font-sans text-[13px] leading-relaxed text-fg/80">
                  Quiere {reading.want}. Se lo impide {reading.obstacle}. Arco: {reading.arc}
                </p>
              </div>
            )}
          </section>

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
              Me recuerda a… · referencias
            </SectionLabel>
            {adding && (
              <div className="mt-4">
                <ReferenceForm compact defaultAnchor={{ type: "character", name }} onDone={() => setAdding(false)} />
              </div>
            )}
            <div className="mt-2 divide-y divide-line">
              {mine.map((r) => (
                <ReferenceRow key={r.id} item={r} scenes={scenes} onDelete={() => maps.refs.delete(r.id)} />
              ))}
              {suggestions.map((s) => (
                <ReferenceRow
                  key={s.id}
                  item={s}
                  scenes={scenes}
                  onAccept={() => {
                    addReference(maps, { ...s, source: "ai", by: userName, at: Date.now() });
                    dropSuggestion(s.id);
                  }}
                  onDelete={() => dropSuggestion(s.id)}
                />
              ))}
            </div>
            <AiButton
              className="mt-4"
              label={`Personajes que recuerdan a ${name}`}
              run={async () => {
                const res = await suggestReferencesAction(screenplayId, { type: "character", name });
                if (!res.ok) return res;
                return pushSuggestions(maps, res.suggestions) ? res : { ok: false as const, error: "Todo lo que ha propuesto ya lo tienes. Prueba otra vez o desde otra escena." };
              }}
            />
          </section>
        </div>

        <section className="mt-12">
          <SectionLabel>Su hilo, escena a escena</SectionLabel>
          <ol className="mt-2 divide-y divide-line">
            {thread.map((t) => (
              <li key={t.scene.sid} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,260px)_1fr]">
                <button
                  type="button"
                  onClick={() => {
                    setView("page");
                    goToScene(t.scene.sid);
                  }}
                  className="text-left font-[family-name:var(--font-courier)] text-xs font-bold uppercase hover:text-accent"
                >
                  <span className="text-accent">{t.scene.number}</span> {t.scene.heading}
                </button>
                <div className="font-[family-name:var(--font-courier)] text-[13px] leading-relaxed text-fg/85">
                  {t.lines.length ? t.lines.map((l, i) => <p key={i}>{l}</p>) : <p className="text-muted">Aparece sin hablar.</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
