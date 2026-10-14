"use client";

import { useEffect, useState } from "react";
import { suggestReferencesAction } from "@/lib/actions/screenplay-ai";
import { useYMap } from "@/lib/screenplay/use-ymap";
import { characterThread, referenceId, type CharacterMeta, type Reference, type StoryReading } from "@/lib/screenplay/story";
import {
  AiButton,
  InlineText,
  NOTHING_NEW,
  ReferenceForm,
  ReferenceItem,
  acceptSuggestion,
  dropSuggestion,
  pushSuggestions,
  suggestionsOf,
  useImageUpload,
  useWorkspace,
} from "@/components/screenplay/workspace";

const FIELDS: { key: "want" | "need" | "fear" | "secret" | "arc" | "notes"; label: string; placeholder: string }[] = [
  { key: "want", label: "Quiere", placeholder: "Lo que persigue en la historia" },
  { key: "need", label: "Necesita", placeholder: "Lo que de verdad le hace falta" },
  { key: "fear", label: "Teme", placeholder: "—" },
  { key: "secret", label: "Oculta", placeholder: "—" },
  { key: "arc", label: "Arco", placeholder: "De dónde sale y a dónde llega" },
  { key: "notes", label: "Notas", placeholder: "Pasado, cómo habla, cómo viste…" },
];

// Ficha de personaje en un panel lateral: se abre desde la Idea, la escaleta
// o el guion. Con el guion vinculado a un proyecto, la ficha y sus imágenes
// aparecen en Personajes de Taller y las imágenes en el Moodboard.
export function CharacterDrawer({ name, onClose }: { name: string; onClose: () => void }) {
  const { screenplayId, maps, blocks, scenes, linkedProject, userName, goToScene, setStep } = useWorkspace();
  const fichas = useYMap<CharacterMeta>(maps.characters);
  const refs = useYMap<Reference>(maps.refs);
  const ai = useYMap<unknown>(maps.ai);
  const [adding, setAdding] = useState(false);
  const { upload, busy, error } = useImageUpload();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ficha = fichas[name] ?? {};
  const save = (patch: Partial<CharacterMeta>) => maps.characters.set(name, { ...(maps.characters.get(name) ?? {}), ...patch });
  const thread = characterThread(blocks, scenes, name);
  const mine = Object.values(refs).filter((r) => r.anchor.type === "character" && r.anchor.name === name);
  const suggestions = suggestionsOf(ai).filter((s) => s.anchor.type === "character" && s.anchor.name === name);
  const reading = (ai.reading as StoryReading | undefined)?.characters.find((c) => c.name === name);
  const images = ficha.images ?? [];

  return (
    <aside className="sp-drawer" role="dialog" aria-label={`Ficha de ${name}`}>
      <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-7 py-5">
        <div className="flex items-center gap-4">
          {images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto de referencia del personaje
            <img src={images[0].url} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-[#ece9f7] font-[family-name:var(--font-courier)] text-2xl font-bold text-[var(--accent)]">
              {name.slice(0, 1)}
            </span>
          )}
          <div>
            <h2 className="font-[family-name:var(--font-courier)] text-[26px] leading-tight font-bold">{name}</h2>
            <p className="mt-1 text-[12.5px] text-muted">
              {thread.length ? `En ${thread.length} de ${scenes.length} escenas` : "Todavía no sale en ninguna escena"}
              {linkedProject && <span className="text-[var(--accent)]"> · en Personajes de «{linkedProject.name}»</span>}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="sp-btn" aria-label="Cerrar ficha">
          Cerrar
        </button>
      </div>

      <div className="px-7 py-5">
        <dl>
          {FIELDS.map((f) => (
            <div key={f.key} className="grid grid-cols-[84px_1fr] gap-3 border-b border-[var(--line)] py-2.5">
              <dt className="pt-1 text-[12.5px] text-muted">{f.label}</dt>
              <dd>
                <InlineText
                  label={`${f.label} — ${name}`}
                  value={ficha[f.key] ?? ""}
                  placeholder={f.placeholder}
                  onSave={(v) => save({ [f.key]: v })}
                  className="text-[14.5px] leading-relaxed"
                />
              </dd>
            </div>
          ))}
        </dl>

        {reading && (
          <p className="mt-4 rounded-lg border border-dashed border-[var(--ai)]/50 p-3 text-[13px] leading-relaxed text-[#3a3a40]">
            <span className="font-semibold text-[var(--ai)]">Lo que entiende la IA: </span>
            quiere {reading.want}; se lo impide {reading.obstacle}. Arco: {reading.arc}
          </p>
        )}

        <h3 className="sp-label mt-7">Imágenes</h3>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {images.map((img) => (
            <figure key={img.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- imagen subida por el equipo */}
              <img src={img.url} alt={img.caption ?? ""} className="h-24 w-full rounded-md object-cover" />
              <button
                type="button"
                aria-label="Quitar imagen"
                onClick={() => save({ images: images.filter((x) => x.id !== img.id) })}
                className="absolute top-1 right-1 hidden rounded bg-white/90 px-1.5 text-[12px] group-hover:block hover:text-danger"
              >
                ×
              </button>
            </figure>
          ))}
          <label className="grid h-24 cursor-pointer place-items-center rounded-md border border-dashed border-[#b9b9bd] text-[12.5px] text-muted hover:border-[var(--accent)] hover:text-[var(--accent)]">
            {busy ? "Subiendo…" : "+ Subir"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = await upload(f);
                if (url) save({ images: [...images, { id: referenceId(), url, caption: f.name.replace(/\.[^.]+$/, "").slice(0, 80) }] });
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
        {linkedProject && <p className="mt-2 text-[12px] text-muted">Las imágenes van también al Moodboard del proyecto.</p>}

        <h3 className="sp-label mt-7">Me recuerda a… · referencias</h3>
        <div className="mt-1 divide-y divide-[var(--line)]">
          {mine.map((r) => (
            <ReferenceItem key={r.id} item={r} scenes={scenes} onDelete={() => maps.refs.delete(r.id)} />
          ))}
        </div>
        <div className="mt-2 space-y-2">
          {suggestions.map((s) => (
            <ReferenceItem
              key={s.id}
              item={s}
              scenes={scenes}
              onAccept={() => acceptSuggestion(maps, s, userName)}
              onDelete={() => dropSuggestion(maps, s.id)}
            />
          ))}
        </div>
        {adding ? (
          <div className="mt-3">
            <ReferenceForm anchor={{ type: "character", name }} onDone={() => setAdding(false)} />
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => setAdding(true)} className="text-[14px] text-[var(--accent)] hover:underline">
              + Añadir referencia
            </button>
            <AiButton
              label="¿A quién me recuerda?"
              run={async () => {
                const res = await suggestReferencesAction(screenplayId, { type: "character", name });
                if (!res.ok) return res;
                return pushSuggestions(maps, res.suggestions) ? res : { ok: false as const, error: NOTHING_NEW };
              }}
            />
          </div>
        )}

        {thread.length > 0 && (
          <>
            <h3 className="sp-label mt-8">Su recorrido</h3>
            <ol className="mt-2">
              {thread.map((t) => (
                <li key={t.scene.sid} className="border-b border-[var(--line)] py-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      setStep("guion");
                      goToScene(t.scene.sid);
                    }}
                    className="text-left font-[family-name:var(--font-courier)] text-[13px] font-bold hover:text-[var(--accent)]"
                  >
                    <span className="text-[var(--accent)]">{t.scene.number}</span> {t.scene.heading}
                  </button>
                  <p className="mt-1 font-[family-name:var(--font-courier)] text-[13px] leading-snug text-muted">
                    {t.lines.length ? t.lines.join(" / ") : "Aparece sin hablar."}
                  </p>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </aside>
  );
}
