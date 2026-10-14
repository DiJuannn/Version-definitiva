"use client";

import { useState } from "react";
import { askQuestionsAction, suggestReferencesAction } from "@/lib/actions/screenplay-ai";
import { useYMap } from "@/lib/screenplay/use-ymap";
import { formatEighths, type Questions, type Reference, type SceneMeta } from "@/lib/screenplay/story";
import {
  AiButton,
  InlineText,
  ReferenceForm,
  ReferenceRow,
  SectionLabel,
  addReference,
  anchorKey,
  pushSuggestions,
  suggestionsOf,
  updateSceneMeta,
  useWorkspace,
} from "@/components/screenplay/workspace";

// Panel derecho de la página: todo lo de la escena donde está el cursor.
// Sinopsis, referencias, y las ayudas de IA para cuando no sabes seguir.
export function ContextPanel() {
  const { screenplayId, maps, scenes, currentSid, userName } = useWorkspace();
  const refs = useYMap<Reference>(maps.refs);
  const ai = useYMap<unknown>(maps.ai);
  const meta = useYMap<SceneMeta>(maps.scenes);
  const [adding, setAdding] = useState(false);

  const scene = scenes.find((s) => s.sid === currentSid) ?? null;
  const anchor = scene ? ({ type: "scene", sid: scene.sid } as const) : ({ type: "script" } as const);
  const key = anchorKey(anchor);
  const mine = Object.values(refs).filter((r) => anchorKey(r.anchor) === key);
  const suggestions = suggestionsOf(ai).filter((s) => anchorKey(s.anchor) === key);
  const questions = ai[`q:${scene?.sid ?? "script"}`] as Questions | undefined;

  const dropSuggestion = (id: string) =>
    maps.ai.set(
      "suggestions",
      suggestionsOf(maps.ai.toJSON()).filter((s) => s.id !== id),
    );

  return (
    <div className="space-y-9">
      <div>
        <p className="font-mono text-[10px] tracking-[0.2em] text-accent uppercase">
          {scene ? `Escena ${scene.number} · ${formatEighths(scene.eighths)} pág.` : "Antes de la primera escena"}
        </p>
        <p className="mt-1.5 font-[family-name:var(--font-courier)] text-[13px] leading-snug font-bold uppercase">
          {scene ? scene.heading : "Toda la historia"}
        </p>
        {scene && (
          <InlineText
            label="Sinopsis de la escena"
            value={meta[scene.sid]?.synopsis ?? ""}
            onSave={(v) => updateSceneMeta(maps, scene.sid, { synopsis: v })}
            placeholder="De qué va esta escena, en una frase (sale en su tarjeta del corcho)"
            className="mt-3 font-sans text-[13px] leading-relaxed text-fg/80"
          />
        )}
        {scene && scene.present.length > 0 && (
          <p className="mt-2 font-mono text-[11px] text-muted">{scene.present.join(" · ")}</p>
        )}
      </div>

      <div>
        <SectionLabel
          right={
            !adding && (
              <button type="button" onClick={() => setAdding(true)} className="font-mono text-[10px] tracking-widest text-accent uppercase hover:text-fg">
                + Añadir
              </button>
            )
          }
        >
          Referencias {mine.length > 0 && `· ${mine.length}`}
        </SectionLabel>
        {adding && (
          <div className="mt-4">
            <ReferenceForm compact defaultAnchor={anchor} onDone={() => setAdding(false)} />
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
        {!mine.length && !suggestions.length && !adding && (
          <p className="mt-3 font-sans text-[13px] text-muted">
            Películas, escenas, cuadros o músicas que te ayuden a ver {scene ? "esta escena" : "la historia"}.
          </p>
        )}
        <AiButton
          className="mt-4"
          label={scene ? "Sugerir referencias para esta escena" : "Sugerir referencias"}
          run={async () => {
            const res = await suggestReferencesAction(screenplayId, scene ? { type: "scene", sid: scene.sid } : { type: "script" });
            if (!res.ok) return res;
            return pushSuggestions(maps, res.suggestions) ? res : { ok: false as const, error: "Todo lo que ha propuesto ya lo tienes. Prueba otra vez o desde otra escena." };
          }}
        />
      </div>

      <div>
        <SectionLabel>¿No sabes cómo seguir?</SectionLabel>
        {questions && questions.items.length > 0 ? (
          <ol className="mt-3 space-y-2.5">
            {questions.items.map((q, i) => (
              <li key={i} className="flex gap-2.5 font-sans text-[13px] leading-relaxed">
                <span className="font-mono text-[11px] text-warn">?</span>
                {q}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 font-sans text-[13px] text-muted">
            La IA lee lo que llevas y te hace preguntas para que decidas tú. No escribe nada por ti.
          </p>
        )}
        <AiButton
          className="mt-4"
          label={questions ? "Otras preguntas" : "Hazme preguntas"}
          pendingLabel="Pensando preguntas…"
          run={async () => {
            const res = await askQuestionsAction(screenplayId, scene?.sid ?? null);
            if (res.ok) maps.ai.set(`q:${scene?.sid ?? "script"}`, res.questions);
            return res;
          }}
        />
      </div>
    </div>
  );
}
