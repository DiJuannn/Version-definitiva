"use client";

import { useState } from "react";
import { suggestReferencesAction } from "@/lib/actions/screenplay-ai";
import { characterName } from "@/lib/screenplay/blocks";
import { useYMap } from "@/lib/screenplay/use-ymap";
import { DEV_FIELDS, type CharacterMeta, type DevKey, type Reference } from "@/lib/screenplay/story";
import { useGuidedMode } from "@/components/screenplay/guided/use-guided";
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
  useWorkspace,
} from "@/components/screenplay/workspace";

// Los campos de la Idea en palabras normales y con un ejemplo cada uno (los
// nombres técnicos van detrás, pequeños: «logline», «tesis»).
const FIELD_TEXT: Record<DevKey, { label: string; hint: string; example: string }> = {
  idea: {
    label: "La idea",
    hint: "En una frase, como se la contarías a alguien.",
    example: "Una niña quiere arreglar la bici de su madre antes de que su abuelo la venda.",
  },
  thesis: {
    label: "De qué habla en el fondo",
    hint: "Opcional. Lo que la historia dice sin decirlo (a veces se llama tesis).",
    example: "Que crecer es aprender a soltar cosas.",
  },
  logline: {
    label: "Tu historia en una frase",
    hint: "Quién, qué quiere y qué se lo impide. A esto se le llama logline.",
    example: "Nora, 11 años, quiere arreglar la bicicleta de su madre antes del sábado, pero su abuelo ya la ha vendido.",
  },
  synopsis: {
    label: "Sinopsis",
    hint: "La historia de principio a fin, en un párrafo o dos. Con el final.",
    example: "Nora encuentra la bici en el garaje… y al final el abuelo le sujeta el sillín.",
  },
  tone: {
    label: "Tono y mundo",
    hint: "Cómo se ve, cómo suena, qué se siente.",
    example: "Verano en un pueblo, luz de siesta, humor seco.",
  },
};

// Paso 1 · Idea: lo que hay antes del guion, en un solo documento guiado.
// Todo es opcional; los personajes y las escenas se rellenan solos al escribir.
export function IdeaStep({ title, subtitle }: { title: string; subtitle: string }) {
  const { screenplayId, maps, characters, scenes, setStep, openRail, openCharacter, linkedProject, userName } = useWorkspace();
  const dev = useYMap<string>(maps.dev);
  const fichas = useYMap<CharacterMeta>(maps.characters);
  const refs = useYMap<Reference>(maps.refs);
  const ai = useYMap<unknown>(maps.ai);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const names = [...new Set([...characters.map((c) => c.name), ...Object.keys(fichas)])];
  const scriptRefs = Object.values(refs).filter((r) => r.anchor.type === "script");
  const suggestions = suggestionsOf(ai).filter((s) => s.anchor.type === "script");
  const filled = DEV_FIELDS.filter((f) => dev[f.key]?.trim()).length;
  const guided = useGuidedMode(maps, screenplayId);

  return (
    <div className="grid gap-10 px-5 py-10 lg:grid-cols-[1fr_760px_1fr] lg:px-8">
      <div className="hidden lg:block" />

      <article className="min-w-0">
        <p className="sp-label">{subtitle}</p>
        <h1 className="mt-2 text-4xl leading-none font-black tracking-tight sm:text-5xl">{title}</h1>
        {guided.on ? (
          <p className="mt-5 text-[14px] text-muted">
            Todo el desarrollo, para cuando quieras afinar.{" "}
            <button type="button" onClick={() => setStep("esqueleto")} className="font-medium text-[var(--accent)] hover:underline">
              ← Volver al esqueleto
            </button>
          </p>
        ) : (
          filled === 0 &&
          scenes.length === 0 && (
            <div className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted">
              <p>
                Todo lo de aquí es opcional. Si ya tienes la historia en la cabeza,{" "}
                <button type="button" onClick={() => setStep("guion")} className="font-medium text-[var(--accent)] hover:underline">
                  empieza directamente a escribir el guion
                </button>
                : los personajes y las escenas se irán rellenando solos.
              </p>
              <p className="mt-3">
                ¿Es tu primer guion?{" "}
                <button
                  type="button"
                  onClick={() => {
                    guided.set(true);
                    setStep("empezar");
                  }}
                  className="font-medium text-[var(--accent)] hover:underline"
                >
                  Responde 5 preguntas y te preparo las escenas →
                </button>
              </p>
            </div>
          )
        )}

        {DEV_FIELDS.map((f) => (
          <section key={f.key} className="mt-10 grid gap-2 sm:grid-cols-[150px_1fr] sm:gap-6">
            <h2 className="pt-1 text-[13px] font-bold">
              {FIELD_TEXT[f.key].label}
              <span className="mt-1 block text-[12px] leading-snug font-normal text-muted">{FIELD_TEXT[f.key].hint}</span>
            </h2>
            <div>
            <InlineText
              label={FIELD_TEXT[f.key].label}
              value={dev[f.key] ?? ""}
              onSave={(v) => (v ? maps.dev.set(f.key, v) : maps.dev.delete(f.key))}
              placeholder={f.key === "synopsis" ? "Cuenta la historia de principio a fin…" : "Escribe aquí…"}
              rows={f.rows}
              className="text-[17px] leading-relaxed"
            />
            {!dev[f.key]?.trim() && <p className="mt-1 text-[12.5px] text-[#8a867c] italic">Ej.: {FIELD_TEXT[f.key].example}</p>}
            </div>
          </section>
        ))}

        <section className="mt-12 grid gap-2 sm:grid-cols-[150px_1fr] sm:gap-6">
          <h2 className="pt-1 text-[13px] font-bold">
            Personajes
            <span className="mt-1 block text-[12px] leading-snug font-normal text-muted">
              {linkedProject ? `Se comparten con Personajes de «${linkedProject.name}».` : "Salen solos al escribir diálogos."}
            </span>
          </h2>
          <div>
            <ul className="border-t border-[var(--line)]">
              {names.map((name) => {
                const m = fichas[name] ?? {};
                const img = m.images?.[0]?.url;
                const count = Object.values(refs).filter((r) => r.anchor.type === "character" && r.anchor.name === name).length + (m.images?.length ?? 0);
                const desc = [m.want && `Quiere ${lower(m.want)}`, m.fear && `Teme ${lower(m.fear)}`].filter(Boolean).join(". ");
                return (
                  <li key={name} className="border-b border-[var(--line)]">
                    <button
                      type="button"
                      onClick={() => openCharacter(name)}
                      className="grid w-full grid-cols-[44px_140px_1fr_auto] items-center gap-4 py-3 text-left transition-colors hover:bg-white"
                    >
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element -- foto de referencia del personaje
                        <img src={img} alt="" className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-[#ece9f7] font-[family-name:var(--font-courier)] font-bold text-[var(--accent)]">
                          {name.slice(0, 1)}
                        </span>
                      )}
                      <span className="truncate font-[family-name:var(--font-courier)] text-[15px] font-bold">{name}</span>
                      <span className="truncate text-[14px] text-muted">{desc || "Abrir ficha…"}</span>
                      {count > 0 ? (
                        <span className="rounded-full bg-[#ece9f7] px-2 py-0.5 text-[11px] text-[var(--accent)]">
                          {count} {count === 1 ? "referencia" : "referencias"}
                        </span>
                      ) : (
                        <span />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {adding ? (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = characterName(newName);
                  if (!name) return;
                  if (!maps.characters.get(name)) maps.characters.set(name, { added: true });
                  setNewName("");
                  setAdding(false);
                  openCharacter(name);
                }}
              >
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre del personaje"
                  className="flex-1 rounded-md border border-[var(--line)] bg-white px-3 py-2 font-[family-name:var(--font-courier)] text-sm uppercase outline-none focus:border-[var(--accent)]"
                />
                <button type="submit" className="rounded-md bg-[var(--fg)] px-3.5 text-[13px] font-medium text-white">
                  Crear ficha
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setAdding(true)} className="mt-3 text-[14px] text-[var(--accent)] hover:underline">
                + Añadir personaje
              </button>
            )}
          </div>
        </section>

        <ToneReferences
          screenplayId={screenplayId}
          scriptRefs={scriptRefs}
          suggestions={suggestions}
          linked={Boolean(linkedProject)}
          userName={userName}
        />

        <div className="mt-14 border-t border-[var(--line)] pt-6">
          <button type="button" onClick={() => setStep("guion")} className="rounded-md bg-[#1c1b19] px-4 py-2.5 text-[14.5px] font-semibold text-white hover:bg-black">
            Ir a escribir el guion →
          </button>
        </div>
      </article>

      <aside className="hidden lg:block">
        <div className="sticky top-24 w-60 text-[13px] text-muted">
          <p className="sp-label">Tu desarrollo</p>
          <ul className="mt-3 space-y-2.5">
            {DEV_FIELDS.map((f) => (
              <li key={f.key} className="flex items-center gap-2.5">
                <span className={`h-2 w-2 rounded-full ${dev[f.key]?.trim() ? "bg-[var(--accent)]" : "bg-[var(--line)]"}`} />
                {FIELD_TEXT[f.key].label}
              </li>
            ))}
            <li className="flex items-center gap-2.5">
              <span className={`h-2 w-2 rounded-full ${names.length ? "bg-[var(--accent)]" : "bg-[var(--line)]"}`} />
              Personajes
            </li>
          </ul>
          <div className="mt-7 rounded-lg border border-[var(--line)] bg-white p-3.5 leading-relaxed text-fg">
            {scenes.length ? (
              <>
                Ya tienes {scenes.length} {scenes.length === 1 ? "escena" : "escenas"}.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setStep("guion");
                    openRail("estructura");
                  }}
                  className="font-medium text-[var(--accent)] hover:underline"
                >
                  Ver la estructura →
                </button>
              </>
            ) : (
              <>
                ¿Tienes cosas sueltas y no sabes por dónde empezar? Apúntalas en{" "}
                <button
                  type="button"
                  onClick={() => {
                    setStep("guion");
                    openRail("ideas");
                  }}
                  className="font-medium text-[var(--accent)] hover:underline"
                >
                  Ideas sueltas →
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function lower(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1).replace(/\.$/, "");
}

function ToneReferences({
  screenplayId,
  scriptRefs,
  suggestions,
  linked,
  userName,
}: {
  screenplayId: string;
  scriptRefs: Reference[];
  suggestions: ReturnType<typeof suggestionsOf>;
  linked: boolean;
  userName: string;
}) {
  const { maps, scenes } = useWorkspace();
  const [adding, setAdding] = useState(false);
  return (
    <section className="mt-12 grid gap-2 sm:grid-cols-[150px_1fr] sm:gap-6">
      <h2 className="pt-1 text-[13px] font-bold">
        Referencias
        <span className="mt-1 block text-[12px] leading-snug font-normal text-muted">
          Películas, imágenes, músicas… de toda la historia.{linked ? " Van también al Moodboard." : ""}
        </span>
      </h2>
      <div>
        {scriptRefs.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {scriptRefs.map((r) => (
              <figure key={r.id} className="group relative">
                {r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- imagen de referencia subida
                  <img src={r.image} alt="" className="h-24 w-full rounded-md object-cover" />
                ) : (
                  <div className="grid h-24 place-items-center rounded-md bg-[#ebebe7] px-3 text-center text-[12px] text-muted">{r.title}</div>
                )}
                <figcaption className="mt-1.5 text-[12.5px] leading-snug">
                  {r.title}
                  {r.year && <span className="text-muted"> · {r.year}</span>}
                </figcaption>
                <button
                  type="button"
                  onClick={() => maps.refs.delete(r.id)}
                  aria-label={`Quitar ${r.title}`}
                  className="absolute top-1.5 right-1.5 hidden rounded bg-white/90 px-1.5 text-[12px] text-muted group-hover:block hover:text-danger"
                >
                  ×
                </button>
              </figure>
            ))}
          </div>
        )}
        <div className="mt-3 space-y-2">
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
          <div className="mt-3 max-w-md">
            <ReferenceForm anchor={{ type: "script" }} onDone={() => setAdding(false)} />
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => setAdding(true)} className="text-[14px] text-[var(--accent)] hover:underline">
              + Añadir referencia
            </button>
            <AiButton
              label="Proponer referencias"
              run={async () => {
                const res = await suggestReferencesAction(screenplayId, { type: "script" });
                if (!res.ok) return res;
                return pushSuggestions(maps, res.suggestions) ? res : { ok: false as const, error: NOTHING_NEW };
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
