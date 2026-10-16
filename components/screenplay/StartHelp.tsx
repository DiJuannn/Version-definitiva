"use client";

import { useState, useTransition } from "react";
import { useYMap } from "@/lib/screenplay/use-ymap";
import { LOOSE_KINDS, OPENINGS, guessLooseKind, referenceId, type LooseIdea, type OpeningKey } from "@/lib/screenplay/story";
import { proposeOpeningsAction } from "@/lib/actions/screenplay-ai";
import type { OpeningProposal } from "@/lib/screenplay-ai";
import { useWorkspace } from "@/components/screenplay/workspace";

// La página en blanco: no hace falta empezar por el principio. Tres caminos
// para arrancar con lo que se tenga.
export function StartHelp({ onWrite }: { onWrite: () => void }) {
  const { openRail, openOpenings } = useWorkspace();
  const options = [
    {
      mark: "→",
      title: "Escribir la escena que tengo en la cabeza",
      text: "Escribe arriba la que tengas más clara, aunque sea del medio o del final. Luego se mueve a su sitio.",
      onClick: onWrite,
      main: true,
    },
    {
      mark: "◎",
      title: "Apuntar ideas sueltas",
      text: "Una imagen, una frase, un momento, un final… en cualquier orden. Cada una se convierte en escena cuando quieras.",
      onClick: () => openRail("ideas"),
    },
    {
      mark: "?",
      title: "Ayúdame a encontrar el principio",
      text: "Cuatro maneras clásicas de abrir una película, con lo que ya tienes.",
      onClick: openOpenings,
    },
  ];
  return (
    <div className="mt-[calc(var(--u)/2)] font-[family-name:var(--font-archivo)] select-none" contentEditable={false}>
      <p className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em] max-sm:text-[22px]">
        No hace falta empezar
        <br />
        por el principio.
      </p>
      <p className="mt-2.5 max-w-[30rem] text-[14.5px] leading-relaxed text-[#5f5b52]">
        Escribe lo que tengas más claro. El orden se decide después.
      </p>
      <div className="mt-6 grid max-w-[34rem] gap-2.5">
        {options.map((o) => (
          <button
            key={o.title}
            type="button"
            onClick={o.onClick}
            className={`flex items-start gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-colors hover:border-[#a08fd0] ${
              o.main ? "border-[#b9a6f0] bg-[#faf8ff]" : "border-[#e1ded5] bg-transparent"
            }`}
          >
            <span className="w-5 shrink-0 text-[20px] leading-none font-extrabold text-[#a08fd0]">{o.mark}</span>
            <span>
              <span className="block text-[15px] font-semibold text-[#1c1b19]">{o.title}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-[#6d695f]">{o.text}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function newIdea(text: string, by: string, sid: string): LooseIdea {
  return { id: referenceId(), text, kind: guessLooseKind(text), at: Date.now(), by, sid };
}

// «Encontrar el principio»: cuatro maneras de abrir y, para cada una, la idea
// suelta que mejor encaja (o una pregunta para escribirla). Lo elegido pasa a
// ser la primera escena del guion.
export function OpeningsPanel({ onClose }: { onClose: () => void }) {
  const { maps, scenes, addScene, goToScene, screenplayId, flushSave, userName } = useWorkspace();
  const loose = useYMap<LooseIdea>(maps.loose);
  const ideas = Object.values(loose)
    .filter((l): l is LooseIdea => Boolean(l?.id) && !l.sid)
    .sort((a, b) => a.at - b.at);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ai, setAi] = useState<OpeningProposal[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const ideaFor = (key: OpeningKey): LooseIdea | undefined => {
    const way = OPENINGS.find((o) => o.key === key)!;
    const chosen = picked[key];
    if (chosen) return ideas.find((i) => i.id === chosen);
    for (const kind of way.kinds) {
      const match = ideas.find((i) => i.kind === kind);
      if (match) return match;
    }
    return undefined;
  };

  // La escena 1: encabezado vacío y la idea como nota, delante de todo.
  const makeFirst = (text: string, idea?: LooseIdea) => {
    const sid = addScene("", "", scenes[0]?.sid ?? null, text);
    if (!sid) return;
    if (idea) maps.loose.set(idea.id, { ...idea, sid });
    else {
      const idea = newIdea(text, userName, sid);
      maps.loose.set(idea.id, idea);
    }
    onClose();
    goToScene(sid);
  };

  return (
    <div className="sp-drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-[600px] flex-col bg-white shadow-[-30px_0_60px_-30px_rgba(0,0,0,0.45)]" role="dialog" aria-label="Encontrar el principio">
      <div className="flex items-start gap-4 border-b border-[var(--line)] px-6 py-5">
        <div>
          <p className="sp-label">Encontrar el principio</p>
          <h2 className="mt-1 text-[28px] leading-tight font-black tracking-tight">¿Cómo empieza tu película?</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
            Cuatro maneras clásicas de abrir. En cada una te señalo la idea suelta que encaja; eliges tú, y siempre se puede cambiar.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="ml-auto text-[20px] text-muted hover:text-fg">
          ×
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <ul className="space-y-3">
          {OPENINGS.map((o) => {
            const idea = ideaFor(o.key);
            const suggestion = ai?.find((a) => a.way === o.key);
            return (
              <li key={o.key} className={`rounded-xl border p-4 ${suggestion ? "border-[var(--ai)]" : "border-[var(--line)]"}`}>
                <p className="text-[15.5px] font-bold">{o.label}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted">{o.hint}</p>
                <p className="mt-0.5 text-[12px] text-[#8a867c] italic">{o.example}</p>
                {suggestion && <p className="mt-2 rounded-md bg-[#fff8ea] px-2.5 py-1.5 text-[12.5px] leading-snug text-[#7a5200]">✦ {suggestion.why}</p>}
                {ideas.length > 0 ? (
                  <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-[#f6f4ee] px-2.5 py-2 text-[13px]">
                    {idea && (
                      <span
                        className="shrink-0 rounded-full px-2 py-px font-[family-name:var(--font-courier)] text-[10px] tracking-[0.14em] uppercase"
                        style={{ color: LOOSE_KINDS[idea.kind].tone, background: LOOSE_KINDS[idea.kind].bg }}
                      >
                        {LOOSE_KINDS[idea.kind].label}
                      </span>
                    )}
                    <select
                      aria-label={`Idea para abrir ${o.label.toLowerCase()}`}
                      value={idea?.id ?? ""}
                      onChange={(e) => setPicked((p) => ({ ...p, [o.key]: e.target.value }))}
                      className="min-w-0 flex-1 truncate bg-transparent outline-none"
                    >
                      {!idea && <option value="">Elige una idea…</option>}
                      {ideas.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.text.slice(0, 80)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!idea}
                      onClick={() => idea && makeFirst(idea.text, idea)}
                      className="shrink-0 rounded-full bg-[#b9a6f0] px-3 py-1.5 font-[family-name:var(--font-courier)] text-[10.5px] tracking-[0.12em] text-[#111] uppercase disabled:opacity-40"
                    >
                      Primera escena
                    </button>
                  </div>
                ) : (
                  <form
                    className="mt-2.5 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const t = (answers[o.key] ?? "").trim();
                      if (t) makeFirst(t);
                    }}
                  >
                    <input
                      value={answers[o.key] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [o.key]: e.target.value }))}
                      placeholder={o.question}
                      aria-label={o.question}
                      className="min-w-0 flex-1 rounded-lg border border-[var(--line)] px-3 py-2 text-[13.5px] outline-none focus:border-[var(--accent)]"
                    />
                    <button type="submit" className="shrink-0 rounded-full bg-[#b9a6f0] px-3 font-[family-name:var(--font-courier)] text-[10.5px] tracking-[0.12em] text-[#111] uppercase">
                      Primera escena
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-5 border-t border-[var(--line)] pt-4 text-[13px] text-muted">
          {aiError && <p className="mb-2 text-danger">{aiError}</p>}
          ¿Ninguna te convence?{" "}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setAiError(null);
                await flushSave();
                const res = await proposeOpeningsAction(screenplayId).catch(() => null);
                if (!res) setAiError("No se ha podido conectar. Inténtalo otra vez.");
                else if (!res.ok) setAiError(res.error);
                else {
                  setAi(res.openings);
                  setPicked((p) => {
                    const next = { ...p };
                    for (const a of res.openings) if (a.ideaId) next[a.way] = a.ideaId;
                    return next;
                  });
                }
              })
            }
            className="font-semibold text-[var(--ai)] hover:underline disabled:opacity-60"
          >
            {pending ? "Pensando…" : ai ? "Pedir otras aperturas" : "Pedir 3 aperturas al asistente"}
          </button>{" "}
          con tus ideas sueltas: te dice cuál abriría y por qué. El texto lo escribes tú.
        </div>
      </div>
    </div>
  );
}
