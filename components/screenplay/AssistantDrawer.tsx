"use client";

import { useEffect } from "react";
import { askQuestionsAction, readStoryAction, reviewScriptAction } from "@/lib/actions/screenplay-ai";
import { useYMap } from "@/lib/screenplay/use-ymap";
import { REVIEW_KINDS, type Questions, type Review, type StoryReading } from "@/lib/screenplay/story";
import {
  AiButton,
  InlineText,
  ReferenceItem,
  acceptSuggestion,
  dropSuggestion,
  suggestionsOf,
  useWorkspace,
} from "@/components/screenplay/workspace";

const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Todo lo de la IA en un solo sitio: lo que ha entendido de la historia
// (corregible), preguntas para seguir y las propuestas pendientes de revisar.
// La IA nunca escribe en el guion.
export function AssistantDrawer({ onClose }: { onClose: () => void }) {
  const { screenplayId, maps, scenes, userName, goToScene, setStep } = useWorkspace();
  const ai = useYMap<unknown>(maps.ai);
  const reading = ai.reading as StoryReading | undefined;
  const questions = ai["q:script"] as Questions | undefined;
  const pending = suggestionsOf(ai);
  const review = ai.review as Review | undefined;
  const resolve = (id: string) => {
    const r = maps.ai.get("review") as Review | undefined;
    if (r) maps.ai.set("review", { ...r, items: r.items.filter((x) => x.id !== id) });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const edit = (patch: Partial<StoryReading>) => {
    const prev = maps.ai.get("reading") as StoryReading | undefined;
    if (prev) maps.ai.set("reading", { ...prev, ...patch, editedBy: userName });
  };

  return (
    <aside className="sp-drawer" role="dialog" aria-label="Asistente IA">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-7 py-5">
        <div>
          <h2 className="text-xl font-black tracking-tight">Asistente IA</h2>
          <p className="mt-1 text-[13px] leading-snug text-muted">Lee tu guion para ayudarte. Nunca escribe en él.</p>
        </div>
        <button type="button" onClick={onClose} className="sp-btn">
          Cerrar
        </button>
      </div>

      <div className="space-y-10 px-7 py-6">
        <section>
          <h3 className="sp-label">Tu historia, según la IA</h3>
          {!reading ? (
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              Lee el guion (y lo que hayas puesto en la Idea) y te cuenta lo que ha entendido. Si algo no es así, lo corriges aquí y el
              resto de ayudas partirán de tu versión.
            </p>
          ) : (
            <div className="mt-2">
              <p className="text-[12px] text-muted">
                {dateFmt.format(reading.at)}
                {reading.editedBy && ` · corregida por ${reading.editedBy}`}
              </p>
              <InlineText
                label="Premisa"
                value={reading.premise}
                onSave={(v) => edit({ premise: v })}
                placeholder="Premisa"
                className="mt-2 text-[17px] leading-snug font-semibold"
              />
              <dl className="mt-4 grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 text-[14px]">
                <dt className="pt-0.5 text-[12.5px] text-muted">Temas</dt>
                <dd>
                  <InlineText
                    label="Temas"
                    value={reading.themes.join(", ")}
                    onSave={(v) => edit({ themes: v.split(",").map((t) => t.trim()).filter(Boolean) })}
                    placeholder="—"
                  />
                </dd>
                <dt className="pt-0.5 text-[12.5px] text-muted">Tono</dt>
                <dd>
                  <InlineText label="Tono" value={reading.tone} onSave={(v) => edit({ tone: v })} placeholder="—" />
                </dd>
                <dt className="pt-0.5 text-[12.5px] text-muted">Género</dt>
                <dd>
                  <InlineText label="Género" value={reading.genre} onSave={(v) => edit({ genre: v })} placeholder="—" />
                </dd>
              </dl>
              <div className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">
                {reading.characters.map((c, i) => (
                  <div key={c.name} className="py-2.5 text-[13.5px] leading-relaxed">
                    <p className="font-[family-name:var(--font-courier)] font-bold">{c.name}</p>
                    <InlineText
                      label={`Qué quiere ${c.name}`}
                      value={`Quiere ${c.want}. Se lo impide ${c.obstacle}. Arco: ${c.arc}`}
                      placeholder="—"
                      onSave={(v) => {
                        const m = v.match(/^Quiere ([\s\S]*?)\. Se lo impide ([\s\S]*?)\. Arco: ([\s\S]*)$/);
                        const next = m ? { want: m[1], obstacle: m[2], arc: m[3] } : { want: v, obstacle: "", arc: "" };
                        edit({ characters: reading.characters.map((x, j) => (j === i ? { ...x, ...next } : x)) });
                      }}
                    />
                  </div>
                ))}
              </div>
              <InlineText
                label="En qué punto está"
                value={reading.structure}
                onSave={(v) => edit({ structure: v })}
                placeholder="—"
                className="mt-4 text-[14px] leading-relaxed"
              />
              {reading.openQuestions.length > 0 && (
                <>
                  <p className="mt-4 text-[12.5px] text-muted">Lo que tu guion deja abierto al público:</p>
                  <ul className="mt-1.5 space-y-1 text-[14px]">
                    {reading.openQuestions.map((q, i) => (
                      <li key={i}>· {q}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          <AiButton
            className="mt-4"
            label={reading ? "Volver a leer" : "Leer mi historia"}
            run={async () => {
              const res = await readStoryAction(screenplayId);
              if (res.ok) maps.ai.set("reading", res.reading);
              return res;
            }}
          />
        </section>

        <section>
          <h3 className="sp-label">Revisión del guion</h3>
          {review && review.items.length > 0 ? (
            <ol className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {review.items.map((d) => (
                <li key={d.id} className="py-3 text-[14px] leading-relaxed">
                  <p className="text-[12px] text-muted">
                    {REVIEW_KINDS[d.kind]}
                    {d.sid ? (
                      <>
                        {" · "}
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            setStep("guion");
                            goToScene(d.sid!);
                          }}
                          className="font-medium text-[var(--accent)] hover:underline"
                        >
                          Escena {scenes.find((x) => x.sid === d.sid)?.number ?? d.scene}
                        </button>
                      </>
                    ) : (
                      " · Toda la historia"
                    )}
                  </p>
                  <p className="mt-0.5">{d.text}</p>
                  <button type="button" onClick={() => resolve(d.id)} className="mt-1 text-[12.5px] text-muted hover:text-fg">
                    Resuelta
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              {review
                ? "No queda ninguna duda abierta."
                : "La IA lee el guion entero y te señala dudas: cabos sueltos, personajes que desaparecen, contradicciones, motivaciones que no se entienden. Solo señala; las decisiones son tuyas."}
            </p>
          )}
          <AiButton
            className="mt-4"
            label={review ? "Volver a revisar" : "Revisar mi guion"}
            pendingLabel="Revisando el guion…"
            run={async () => {
              const res = await reviewScriptAction(screenplayId);
              if (res.ok) maps.ai.set("review", res.review);
              return res;
            }}
          />
        </section>

        <section>
          <h3 className="sp-label">¿No sabes cómo seguir?</h3>
          {questions ? (
            <ol className="mt-2 space-y-2 text-[14px]">
              {questions.items.map((q, i) => (
                <li key={i} className="border-l-2 border-dashed border-[var(--ai)] pl-3 leading-relaxed">
                  {q}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-[14px] leading-relaxed text-muted">Preguntas sobre la historia entera, a partir de donde la has dejado.</p>
          )}
          <AiButton
            className="mt-4"
            label={questions ? "Otras preguntas" : "Hazme preguntas"}
            pendingLabel="Pensando preguntas…"
            run={async () => {
              const res = await askQuestionsAction(screenplayId, null);
              if (res.ok) maps.ai.set("q:script", res.questions);
              return res;
            }}
          />
        </section>

        <section>
          <div className="flex items-baseline justify-between">
            <h3 className="sp-label">Propuestas por revisar</h3>
            {pending.length > 1 && (
              <button type="button" onClick={() => maps.ai.set("suggestions", [])} className="text-[12.5px] text-muted hover:text-danger">
                Descartar todas
              </button>
            )}
          </div>
          {pending.length === 0 ? (
            <p className="mt-2 text-[14px] text-muted">Nada pendiente.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {pending.map((s) => (
                <ReferenceItem
                  key={s.id}
                  item={s}
                  scenes={scenes}
                  showAnchor
                  onAccept={() => acceptSuggestion(maps, s, userName)}
                  onDelete={() => dropSuggestion(maps, s.id)}
                />
              ))}
            </div>
          )}
        </section>

        <p className="text-[12px] leading-relaxed text-muted">Para leerlo, el texto se envía al proveedor de IA solo cuando pulsas una ayuda.</p>
      </div>
    </aside>
  );
}
