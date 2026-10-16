"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  askQuestionsAction,
  coachQuestionAction,
  coachSceneCheckAction,
  readStoryAction,
  reviewScriptAction,
  screenplayAiStatusAction,
  type CoachNote,
} from "@/lib/actions/screenplay-ai";
import { useYMap } from "@/lib/screenplay/use-ymap";
import { REVIEW_KINDS, referenceId, type Questions, type Review, type StoryReading } from "@/lib/screenplay/story";
import { REMOTE_ORIGIN } from "@/lib/screenplay/realtime-provider";
import {
  COACH_IDLE_MS,
  coachDue,
  coachIdeaText,
  localCoachQuestion,
  sceneWrittenLines,
  type CoachMode,
  type CoachQuestion,
  type CoachTrigger,
} from "@/lib/screenplay-coach";
import {
  AiButton,
  InlineText,
  ReferenceItem,
  acceptSuggestion,
  dropSuggestion,
  suggestionsOf,
  useWorkspace,
  type Workspace,
} from "@/components/screenplay/workspace";
import { PREF_KEYS, readPref, useCoachMuted, useCoachPref, writePref } from "@/components/screenplay/help-prefs";

const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// ================================================================== el Compañero
//
// Modo «solo pregunta, nunca escribe»: una tarjeta con UNA pregunta sobre lo
// que acabas de escribir. Sale sola al terminar una escena o tras 2 minutos
// sin escribir (como mucho una cada 5 minutos), o cuando la pides. Las
// respuestas son tuyas: se guardan en Ideas sueltas. Sin IA (o sin cupo), las
// preguntas son de oficio, con los nombres de tu escena.

export type CompanionCardState = {
  question: CoachQuestion;
  note: CoachNote;
  format?: string; // aviso de formato de la revisión de escena
  trigger: CoachTrigger | "manual";
  saved?: boolean;
};

type CompanionState = { card: CompanionCardState | null; busy: boolean; drawerOpen: boolean };

// Una sola tarjeta para todo el editor (la ven el margen y el cajón).
let state: CompanionState = { card: null, busy: false, drawerOpen: false };
const listeners = new Set<() => void>();
function setCompanion(patch: Partial<CompanionState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function useCompanionState(): CompanionState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

// ¿Hay IA en el servidor? Se pregunta una vez por visita.
let aiStatus: Promise<boolean> | null = null;
export function useAiConfigured(): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    aiStatus ??= screenplayAiStatusAction()
      .then((r) => r.configured)
      .catch(() => false);
    let alive = true;
    void aiStatus.then((ok) => alive && setV(ok));
    return () => {
      alive = false;
    };
  }, []);
  return v;
}

const asked: string[] = []; // preguntas de esta visita (no se repiten)

async function fetchQuestion(
  ws: Pick<Workspace, "screenplayId" | "blocks" | "scenes" | "flushSave">,
  sid: string,
  { auto, stuck }: { auto: boolean; stuck: boolean },
): Promise<{ question: CoachQuestion; note: CoachNote }> {
  await ws.flushSave();
  const res = await coachQuestionAction(ws.screenplayId, { kind: "scene", sid }, { auto, stuck, asked: asked.slice(-8) }).catch(() => null);
  if (res?.ok) return { question: res.question, note: res.note };
  // Sin conexión: una de oficio, aquí mismo.
  return { question: localCoachQuestion(ws.blocks, ws.scenes, sid, { skip: asked, stuck, seed: Date.now() / 1000 }), note: "failed" };
}

// Pide una tarjeta. `trigger` dice por qué (al terminar la escena se mira
// antes si la escena hace lo que su nota decía).
export async function askCompanion(
  ws: Pick<Workspace, "screenplayId" | "blocks" | "scenes" | "flushSave">,
  sid: string,
  trigger: CoachTrigger | "manual",
) {
  if (state.busy) return;
  setCompanion({ busy: true });
  const auto = trigger !== "manual";
  try {
    let card: CompanionCardState | null = null;
    if (trigger === "scene-end") {
      await ws.flushSave();
      const res = await coachSceneCheckAction(ws.screenplayId, sid, { auto }).catch(() => null);
      if (res?.ok && res.check && !res.check.ok) {
        card = {
          question: {
            question: res.check.observation,
            why: "Lo pregunto porque tu nota de esta escena decía qué tenía que pasar en ella.",
            source: "ai",
            sid,
            at: Date.now(),
          },
          note: null,
          format: res.check.format,
          trigger,
        };
      }
    }
    if (!card) {
      const { question, note } = await fetchQuestion(ws, sid, { auto, stuck: trigger === "idle" });
      card = { question, note, trigger };
    }
    asked.push(card.question.question);
    if (auto) writePref(PREF_KEYS.coachLast(ws.screenplayId), String(Date.now()));
    setCompanion({ card, busy: false });
  } catch {
    setCompanion({ busy: false });
  }
}

export function closeCompanion() {
  setCompanion({ card: null });
}

// Los disparadores: terminar una escena (salir de una escena que has
// escrito, con 4 líneas o más) y 2 minutos sin escribir. Va en el margen del
// guion (HelpDock) y respeta el modo, el silencio y los 5 minutos.
export function useCompanionTriggers(mode: CoachMode, muted: boolean) {
  const ws = useWorkspace();
  const { ydoc, editor, currentSid, screenplayId } = ws;
  const wsRef = useRef(ws);
  useEffect(() => {
    wsRef.current = ws;
  });
  const edited = useRef(new Set<string>());
  const lastEditAt = useRef<number | null>(null);
  const sidRef = useRef<string | null>(currentSid);

  const maybeAsk = useCallback(
    (trigger: CoachTrigger, sid: string) => {
      const w = wsRef.current;
      if (document.visibilityState !== "visible") return;
      const last = Number(readPref(PREF_KEYS.coachLast(screenplayId)) ?? "") || null;
      const scene = w.scenes.find((s) => s.sid === sid);
      const due = coachDue({
        mode,
        muted,
        visible: Boolean(state.card) || state.busy,
        lastShownAt: last,
        now: Date.now(),
        trigger,
        lines: sceneWrittenLines(w.blocks, scene),
      });
      if (due) void askCompanion(w, sid, trigger);
    },
    [mode, muted, screenplayId],
  );

  // Qué escenas toca esta persona (solo sus cambios, no los del equipo).
  useEffect(() => {
    const onUpdate = (_u: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_ORIGIN || origin === "db") return;
      lastEditAt.current = Date.now();
      if (sidRef.current) edited.current.add(sidRef.current);
    };
    ydoc.on("update", onUpdate);
    return () => ydoc.off("update", onUpdate);
  }, [ydoc]);

  // Al salir de una escena escrita.
  useEffect(() => {
    const prev = sidRef.current;
    sidRef.current = currentSid;
    if (!prev || prev === currentSid || !edited.current.has(prev)) return;
    edited.current.delete(prev);
    maybeAsk("scene-end", prev);
  }, [currentSid, maybeAsk]);

  // Tras 2 minutos sin escribir, con el cursor en una escena.
  useEffect(() => {
    if (mode !== "auto" || muted) return;
    const t = setInterval(() => {
      const at = lastEditAt.current;
      const sid = sidRef.current;
      if (!at || !sid || Date.now() - at < COACH_IDLE_MS) return;
      if (!editor?.isFocused) return;
      lastEditAt.current = null; // una vez por parada
      maybeAsk("idle", sid);
    }, 10_000);
    return () => clearInterval(t);
  }, [editor, maybeAsk, mode, muted]);
}

const NOTE_TEXT: Record<Exclude<CoachNote, null>, string> = {
  "no-ai": "Pregunta de oficio: la IA no está activada aquí.",
  plan: "Pregunta de oficio: las que salen solas no gastan tus ayudas de IA del día.",
  limit: "Pregunta de oficio: ya has usado las ayudas de IA de hoy.",
  short: "Pregunta de oficio: aún hay poco escrito en la escena para la IA.",
  failed: "Pregunta de oficio: la IA no ha respondido esta vez.",
};

// La tarjeta: discontinua ámbar, nunca un modal, nunca roba el foco.
export function CompanionCard({ onOpenSettings, compact = false }: { onOpenSettings?: () => void; compact?: boolean }) {
  const ws = useWorkspace();
  const { maps, userName, scenes, openRail, screenplayId } = ws;
  const { card, busy } = useCompanionState();
  const [, setMuted] = useCoachMuted(screenplayId);
  const [why, setWhy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const key = card?.question.at ?? 0;
  useEffect(() => {
    // Tarjeta nueva: sin «por qué» abierto ni respuesta a medias.
    setWhy(false); // eslint-disable-line react-hooks/set-state-in-effect
    setAnswer(null);
    setSavedAt(null);
  }, [key]);
  if (!card) return null;
  const q = card.question;
  const scene = q.sid ? scenes.find((s) => s.sid === q.sid) : undefined;

  const save = (withAnswer?: string) => {
    const id = referenceId();
    const text = coachIdeaText(q, scene?.number ?? null) + (withAnswer?.trim() ? `\nTu respuesta: ${withAnswer.trim()}` : "");
    maps.loose.set(id, { id, text: text.slice(0, 1200), kind: "otro", at: Date.now(), by: userName });
    setSavedAt(withAnswer?.trim() ? "Guardada con tu respuesta en Ideas sueltas." : "Guardada en Ideas sueltas.");
    setAnswer(null);
  };

  return (
    <section
      aria-label="El Compañero te pregunta"
      onMouseDown={(e) => {
        // Clic en la tarjeta: el guion conserva el foco (salvo en el campo de respuesta).
        if (!(e.target instanceof HTMLTextAreaElement)) e.preventDefault();
      }}
      className={`rounded-xl border border-dashed border-[var(--ai)] bg-[#fffaf0] text-[13px] leading-snug shadow-[0_10px_30px_-22px_rgba(120,72,0,0.5)] ${compact ? "p-3" : "p-3.5"}`}
    >
      <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--ai)]">
        <span aria-hidden className="sp-ai-dot" />
        {scene ? `Una pregunta sobre la escena ${scene.number}` : "Una pregunta, no una respuesta"}
      </p>
      <p className="mt-1.5 text-[14px] leading-snug font-semibold text-fg">{q.question}</p>
      {card.format && <p className="mt-1.5 text-[12px] text-muted">Formato: {card.format}</p>}
      {why ? (
        <p className="mt-1.5 text-[12.5px] text-muted">{q.why}</p>
      ) : (
        <button type="button" onClick={() => setWhy(true)} className="mt-1.5 text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline">
          ¿Por qué me lo preguntas?
        </button>
      )}

      {savedAt ? (
        <p className="mt-2.5 text-[12.5px] text-[var(--success)]" role="status">
          ✓ {savedAt}{" "}
          <button type="button" onClick={() => openRail("ideas")} className="text-[var(--accent)] hover:underline">
            Ver
          </button>
        </p>
      ) : answer !== null ? (
        <form
          className="mt-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            save(answer);
          }}
        >
          <label className="sr-only" htmlFor={`coach-answer-${key}`}>
            Tu respuesta
          </label>
          <textarea
            id={`coach-answer-${key}`}
            autoFocus
            rows={2}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                save(answer);
              }
              if (e.key === "Escape") setAnswer(null);
            }}
            placeholder="En una línea. Es tuya: no se escribe en el guion."
            className="block w-full resize-none rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--ai)]"
          />
          <div className="mt-1.5 flex gap-2">
            <button type="submit" className="sp-btn !py-1 text-[12.5px]">
              Guardar en Ideas sueltas
            </button>
            <button type="button" onClick={() => setAnswer(null)} className="text-[12.5px] text-muted hover:text-fg">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setAnswer("")} className="sp-btn !px-2.5 !py-1 text-[12.5px]">
            Contestar aquí
          </button>
          <button type="button" onClick={() => save()} className="sp-btn !px-2.5 !py-1 text-[12.5px]">
            Guardar en Ideas sueltas
          </button>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
        <button
          type="button"
          disabled={busy}
          onClick={() => q.sid && void askCompanion(ws, q.sid, "manual")}
          className="font-medium text-[var(--ai)] hover:underline disabled:opacity-60"
        >
          {busy ? "Pensando…" : "Otra pregunta"}
        </button>
        <button type="button" onClick={closeCompanion} className="text-muted hover:text-fg">
          Ahora no
        </button>
      </div>
      <p className="mt-2 border-t border-dashed border-[var(--ai)]/30 pt-2 text-[11.5px] leading-snug text-[#8b8780]">
        {card.note ? `${NOTE_TEXT[card.note]} ` : "Nunca escribe en tu guion. "}
        <button
          type="button"
          onClick={() => {
            setMuted(true);
            closeCompanion();
          }}
          className="underline-offset-2 hover:text-fg hover:underline"
        >
          Silenciar en esta sesión
        </button>
        {onOpenSettings && (
          <>
            {" · "}
            <button type="button" onClick={onOpenSettings} className="underline-offset-2 hover:text-fg hover:underline">
              Ajustes
            </button>
          </>
        )}
      </p>
    </section>
  );
}

// Elegir cuándo pregunta el Compañero (en el cajón y en Ajustes).
export const COACH_MODES: { id: CoachMode; label: string; detail: string }[] = [
  { id: "auto", label: "Me pregunta solo", detail: "Al terminar una escena o si te paras un rato. Como mucho una vez cada 5 minutos." },
  { id: "ask", label: "Solo cuando lo pida", detail: "Desde este cajón: «Pregúntame sobre esta escena»." },
  { id: "off", label: "Apagado", detail: "No pregunta nada." },
];

export function CoachModePicker({ mode, onChange, name }: { mode: CoachMode; onChange: (m: CoachMode) => void; name: string }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="sr-only">Cuándo pregunta el Compañero</legend>
      {COACH_MODES.map((m) => (
        <label key={m.id} className="flex cursor-pointer gap-2.5 rounded-lg px-2 py-1.5 hover:bg-black/[0.03]">
          <input type="radio" name={name} checked={mode === m.id} onChange={() => onChange(m.id)} className="mt-1 accent-[var(--accent)]" />
          <span>
            <span className="block text-[13.5px] font-medium">{m.label}</span>
            <span className="block text-[12.5px] leading-snug text-muted">{m.detail}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

// ================================================================== el cajón

// Todo lo de la IA en un solo sitio. Arriba lo que ayuda a seguir (el
// Compañero y las preguntas); después lo que ha entendido de la historia
// (corregible); la revisión, para cuando ya hay un borrador. La IA nunca
// escribe en el guion.
export function AssistantDrawer({ onClose }: { onClose: () => void }) {
  const ws = useWorkspace();
  const { screenplayId, maps, scenes, userName, goToScene, setStep, currentSid } = ws;
  const ai = useYMap<unknown>(maps.ai);
  const structure = useYMap<unknown>(maps.structure);
  const reading = ai.reading as StoryReading | undefined;
  const questions = ai["q:script"] as Questions | undefined;
  const pending = suggestionsOf(ai);
  const review = ai.review as Review | undefined;
  const configured = useAiConfigured();
  const fallback: CoachMode = structure.guided === true || scenes.length < 3 ? "auto" : "ask";
  const [mode, setMode] = useCoachPref(screenplayId, fallback);
  const [muted, setMuted] = useCoachMuted(screenplayId);
  const companion = useCompanionState();
  const currentScene = scenes.find((s) => s.sid === currentSid) ?? scenes[scenes.length - 1];
  const resolve = (id: string) => {
    const r = maps.ai.get("review") as Review | undefined;
    if (r) maps.ai.set("review", { ...r, items: r.items.filter((x) => x.id !== id) });
  };

  useEffect(() => {
    setCompanion({ drawerOpen: true });
    return () => setCompanion({ drawerOpen: false });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const edit = (patch: Partial<StoryReading>) => {
    const prev = maps.ai.get("reading") as StoryReading | undefined;
    if (prev) maps.ai.set("reading", { ...prev, ...patch, editedBy: userName });
  };

  const noAi = configured === false;

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
        {noAi && (
          <p className="rounded-lg bg-[#f5f5f3] px-3.5 py-3 text-[13px] leading-relaxed text-muted" role="note">
            La IA no está activada en este servidor. El Compañero sigue haciéndote preguntas de oficio, y la guía de la línea, «¿Y
            ahora qué?» y los atajos funcionan igual.
          </p>
        )}

        <section>
          <h3 className="sp-label">El Compañero</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Solo pregunta, nunca escribe. Una pregunta sobre lo que acabas de escribir; la respuesta es tuya y se guarda en Ideas
            sueltas.
          </p>
          <div className="mt-3">
            {companion.card ? (
              <CompanionCard />
            ) : (
              <button
                type="button"
                disabled={!currentScene || companion.busy}
                onClick={() => currentScene && void askCompanion(ws, currentScene.sid, "manual")}
                className="sp-ai-btn"
              >
                <span aria-hidden className={`sp-ai-dot ${companion.busy ? "animate-pulse" : ""}`} />
                {companion.busy
                  ? "Pensando una pregunta…"
                  : currentScene
                    ? `Pregúntame sobre la escena ${currentScene.number}`
                    : "Escribe una escena y te pregunto"}
              </button>
            )}
          </div>
          <details className="mt-4 rounded-lg border border-[var(--line)] px-3 py-2 text-[13px]">
            <summary className="cursor-pointer text-muted">
              Cuándo pregunta: <span className="font-medium text-fg">{COACH_MODES.find((m) => m.id === mode)?.label}</span>
              {muted && " · silenciado en esta sesión"}
            </summary>
            <div className="mt-2">
              <CoachModePicker mode={mode} onChange={setMode} name="coach-mode-drawer" />
              {muted && (
                <button type="button" onClick={() => setMuted(false)} className="mt-2 text-[12.5px] text-[var(--accent)] hover:underline">
                  Volver a activarlo en esta sesión
                </button>
              )}
            </div>
          </details>
        </section>

        {!noAi && (
          <>
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
              <h3 className="sp-label">Tu historia, según la IA</h3>
              {!reading ? (
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  Lee el guion (y lo que hayas puesto en la Idea) y te cuenta lo que ha entendido. Si algo no es así, lo corriges aquí y
                  el resto de ayudas partirán de tu versión.
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
                  {!review && scenes.length < 5 && " Útil cuando ya tengas un borrador entero."}
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
          </>
        )}

        <p className="text-[12px] leading-relaxed text-muted">
          Para leerlo, el texto se envía al proveedor de IA solo cuando pulsas una ayuda o cuando el Compañero te pregunta solo (lo
          puedes apagar arriba).
        </p>
      </div>
    </aside>
  );
}

export { useCompanionState };
