"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { guidedCoachAction } from "@/lib/actions/screenplay-guided";
import { useWorkspace } from "@/components/screenplay/workspace";
import { CoachCard } from "@/components/screenplay/guided/CoachCard";
import { useAiAvailable, useGuidedData } from "@/components/screenplay/guided/use-guided";
import { getSkeleton, saveStart, setSkeleton } from "@/components/screenplay/guided/guided-doc";
import {
  QUESTIONS,
  assembleLogline,
  checkObstacle,
  checkWant,
  defaultRoute,
  displayName,
  minutesLeft,
  newSkeleton,
  noObstacleWarning,
  personalize,
  wordCount,
  type Check,
  type QuestionKey,
  type StartAnswers,
} from "@/components/screenplay/guided/guided";

// Paso «Empezar» del camino guiado: cinco preguntas, una por pantalla, en
// palabras normales. Lo que se contesta va a la Idea, a la ficha del
// protagonista y a Ideas sueltas, y con ello se monta el esqueleto.
export function GuidedStart({ format }: { format: string }) {
  const { maps, screenplayId, setStep, userName } = useWorkspace();
  const { start } = useGuidedData(maps);
  const ai = useAiAvailable();
  const [draft, setDraft] = useState<StartAnswers>(() => start);
  const [index, setIndex] = useState(() => (start.done ? 0 : (start.q ?? 0)));
  const [warn, setWarn] = useState(false);
  const [example, setExample] = useState(0);

  const question = QUESTIONS[index];
  const name = draft.name;
  const last = index === QUESTIONS.length - 1;

  const commit = (patch: Partial<StartAnswers> = {}) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    saveStart(maps, next, userName);
    return next;
  };

  const go = (to: number, patch: Partial<StartAnswers> = {}) => {
    setWarn(false);
    setExample(0);
    if (to >= QUESTIONS.length) {
      const answers = commit({ ...patch, q: QUESTIONS.length - 1, done: true });
      // El esqueleto y la frase de la historia salen de las respuestas; si
      // ya existían (vuelve a las preguntas), no se pisan.
      if (!getSkeleton(maps)) setSkeleton(maps, newSkeleton(defaultRoute(format), answers));
      const logline = assembleLogline(answers);
      if (logline && !maps.dev.get("logline")?.trim()) maps.dev.set("logline", logline);
      setStep("esqueleto");
      return;
    }
    commit({ ...patch, q: Math.max(0, to) });
    setIndex(Math.max(0, to));
  };

  const value = (k: QuestionKey) => (k === "who" ? draft.name : draft[k]) ?? "";
  const set = (patch: Partial<StartAnswers>) => setDraft((d) => ({ ...d, ...patch }));

  const next = () => {
    if (question.key === "obstacle" && !draft.obstacle?.trim() && !warn) {
      setWarn(true);
      return;
    }
    const skipped = new Set(draft.skipped ?? []);
    skipped.delete(question.key);
    go(index + 1, { skipped: [...skipped] });
  };
  const skip = () => {
    const skipped = new Set(draft.skipped ?? []);
    skipped.add(question.key);
    go(index + 1, { skipped: [...skipped] });
  };

  const checks: Check[] =
    question.key === "want" ? checkWant(draft.want, name) : question.key === "obstacle" ? checkObstacle(draft.obstacle) : [];
  const nextLabel = last ? "Ver tu esqueleto" : `Siguiente: ${QUESTIONS[index + 1].next}`;
  const coachText = question.key === "who" ? [draft.name, draft.trait].filter(Boolean).join(", ") : value(question.key);

  return (
    <div className="grid gap-8 px-5 pt-10 pb-24 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,720px)_280px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_720px_300px_minmax(0,1fr)]">
      <div className="hidden lg:block" />
      <article className="min-w-0" aria-labelledby="sp-guided-q">
        {index === 0 && !value("idea") && (
          <p className="mb-6 max-w-xl text-[15px] leading-relaxed text-muted">
            Cinco preguntas y te preparo las escenas. Lo escribes todo tú, con tus palabras; puedes saltarte cualquiera y cambiarlo después.
          </p>
        )}
        <p className="sp-label">
          {last ? "Última pregunta" : `Pregunta ${index + 1} de ${QUESTIONS.length} · te quedan unos ${minutesLeft(index)} min`}
        </p>
        <ol className="mt-3 grid grid-cols-5 gap-1.5" aria-label="Preguntas">
          {QUESTIONS.map((q, i) => (
            <li key={q.key}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Pregunta ${i + 1}: ${personalize(q.title, name)}`}
                aria-current={i === index ? "step" : undefined}
                className={`block h-1.5 w-full rounded-full transition-colors ${
                  i <= index ? "bg-[var(--accent)]" : (draft.skipped ?? []).includes(q.key) ? "bg-[#d9d5ea]" : "bg-[#e3e3df] hover:bg-[#d4d2cb]"
                }`}
              />
            </li>
          ))}
        </ol>

        <h1 id="sp-guided-q" className="mt-7 text-[34px] leading-[1.08] font-black tracking-[-0.02em] sm:text-[44px]">
          {personalize(question.title, name)}
        </h1>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-muted">{personalize(question.help, name)}</p>

        <div className="mt-6" key={question.key}>
          {question.key === "who" ? (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <BigInput
                label="Nombre"
                value={draft.name ?? ""}
                onChange={(v) => set({ name: v })}
                onEnter={next}
                placeholder={question.examples[example % question.examples.length].split(" · ")[0]}
                autoFocus
              />
              <BigInput
                label="Cómo es, en tres palabras"
                value={draft.trait ?? ""}
                onChange={(v) => set({ trait: v })}
                onEnter={next}
                placeholder={question.examples[example % question.examples.length].split(" · ")[1]}
              />
            </div>
          ) : (
            <BigText
              label={personalize(question.title, name)}
              value={value(question.key)}
              onChange={(v) => set({ [question.key]: v } as Partial<StartAnswers>)}
              onEnter={next}
              placeholder={question.examples[example % question.examples.length]}
            />
          )}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 text-[13px] text-[#8a867c]">
            <span>
              Por ejemplo: <i>«{question.examples[example % question.examples.length]}»</i>
            </span>
            {question.examples.length > 1 && (
              <button type="button" onClick={() => setExample((e) => e + 1)} className="text-[var(--accent)] hover:underline">
                otro ejemplo
              </button>
            )}
          </p>
          {checks.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]" aria-live="polite">
              {checks.map((c) => (
                <li key={c.text} className={c.ok ? "text-success" : "text-[var(--ai)]"}>
                  {c.ok ? "✓ " : "→ "}
                  {c.text}
                </li>
              ))}
            </ul>
          )}
        </div>

        {warn && (
          <div role="alert" className="mt-5 rounded-[var(--r-lg)] border border-[#e8d9a8] bg-[#fdf7e6] px-4 py-3 text-[14px] leading-relaxed text-[#6b4a00]">
            {noObstacleWarning(name)}
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button type="button" onClick={() => setWarn(false)} className="rounded-md bg-[#1c1b19] px-3 py-1.5 text-[13px] font-medium text-white">
                Volver a pensarlo
              </button>
              <button type="button" onClick={skip} className="rounded-md px-3 py-1.5 text-[13px] text-[#6b4a00] hover:bg-[#f6e7c4]">
                Seguir sin obstáculo
              </button>
            </div>
          </div>
        )}

        {ai && (question.key === "want" || question.key === "obstacle" || question.key === "idea") && wordCount(coachText) >= 3 && (
          <div className="mt-5" key={`coach-${question.key}`}>
            <CoachCard
              label="Hazme una pregunta sobre esto"
              run={() =>
                guidedCoachAction(screenplayId, draft, { kind: "answer", question: personalize(question.title, name), text: coachText })
              }
            />
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {index > 0 && (
            <button type="button" onClick={() => go(index - 1)} className="rounded-md border border-[var(--line)] bg-white px-3.5 py-2.5 text-[14px] text-muted hover:text-fg">
              ← Atrás
            </button>
          )}
          <button type="button" onClick={next} className="rounded-md bg-[#1c1b19] px-4 py-2.5 text-[14.5px] font-semibold text-white hover:bg-black">
            {nextLabel} →
          </button>
          <button type="button" onClick={skip} className="ml-auto text-[13.5px] text-muted hover:text-fg">
            No lo sé todavía · <span className="text-[var(--accent)]">saltar</span>
          </button>
        </div>
      </article>

      <aside className="min-w-0 lg:pt-1">
        <Summary draft={draft} index={index} onGo={go} />
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          ¿Prefieres ir a tu aire?{" "}
          <button type="button" onClick={() => setStep("guion")} className="text-[var(--accent)] hover:underline">
            Ir a la página en blanco
          </button>
        </p>
      </aside>
    </div>
  );
}

// «Tu historia hasta ahora»: se rellena según contestas. Cada fila lleva a su pregunta.
function Summary({ draft, index, onGo }: { draft: StartAnswers; index: number; onGo: (i: number) => void }) {
  const rows: { label: string; value: string; i: number }[] = [
    { label: "Qué", value: draft.idea ?? "", i: 0 },
    { label: "Quién", value: [displayName(draft.name), draft.trait].filter((x) => x?.trim()).join(", "), i: 1 },
    { label: "Quiere", value: draft.want ?? "", i: 2 },
    { label: "Se lo impide", value: draft.obstacle ?? "", i: 3 },
    { label: "Cómo acaba", value: draft.ending ?? "", i: 4 },
  ];
  return (
    <section aria-label="Tu historia hasta ahora" className="rounded-[var(--r-lg)] border border-[var(--line)] bg-white p-4 lg:sticky lg:top-24">
      <p className="sp-label">Tu historia hasta ahora</p>
      <dl className="mt-3 space-y-2 text-[14px] leading-snug">
        {rows.map((r) => (
          <div key={r.label}>
            <button type="button" onClick={() => onGo(r.i)} className="w-full text-left hover:text-[var(--accent)]">
              <dt className="inline font-semibold">{r.label}: </dt>
              <dd className={`inline ${r.value.trim() ? "" : "text-muted"}`}>
                {r.value.trim() || (r.i === index ? "escribiendo…" : "—")}
              </dd>
            </button>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-[var(--line)] pt-3 text-[12.5px] leading-relaxed text-muted">
        Con esto haremos <b className="font-semibold text-fg">tu historia en una frase</b> (a eso se le llama <i>logline</i>) y un{" "}
        <b className="font-semibold text-fg">esqueleto de escenas</b> que puedes cambiar.
      </p>
    </section>
  );
}

function BigText({
  label,
  value,
  onChange,
  onEnter,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  return (
    <textarea
      ref={ref}
      aria-label={label}
      value={value}
      rows={1}
      maxLength={500}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onEnter();
        }
      }}
      className="block w-full resize-none overflow-hidden rounded-[var(--r-lg)] border border-[var(--line)] bg-white px-5 py-4 text-[19px] leading-snug outline-none transition-shadow placeholder:text-[#b3b0a8] focus:border-[#b9a6f0] focus:shadow-[0_0_0_4px_rgba(90,70,168,0.10)]"
    />
  );
}

function BigInput({
  label,
  value,
  onChange,
  onEnter,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      <input
        value={value}
        maxLength={label === "Nombre" ? 60 : 160}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onEnter();
          }
        }}
        className="block w-full rounded-[var(--r-lg)] border border-[var(--line)] bg-white px-5 py-4 text-[19px] outline-none transition-shadow placeholder:text-[#b3b0a8] focus:border-[#b9a6f0] focus:shadow-[0_0_0_4px_rgba(90,70,168,0.10)]"
      />
    </label>
  );
}
