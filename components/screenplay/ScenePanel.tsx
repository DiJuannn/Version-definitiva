"use client";

import { useState } from "react";
import { askQuestionsAction, suggestReferencesAction } from "@/lib/actions/screenplay-ai";
import { useYMap } from "@/lib/screenplay/use-ymap";
import { REVIEW_KINDS, formatEighths, type Questions, type Reference, type Review, type SceneMeta } from "@/lib/screenplay/story";
import {
  AiButton,
  InlineText,
  NOTHING_NEW,
  ReferenceForm,
  ReferenceItem,
  acceptSuggestion,
  anchorKey,
  dropSuggestion,
  pushSuggestions,
  suggestionsOf,
  updateSceneMeta,
  useWorkspace,
} from "@/components/screenplay/workspace";

// Panel derecho del guion: la escena donde está el cursor. De qué va, quién
// sale, sus referencias (las tuyas y las que propone la IA) y preguntas
// para cuando no sabes cómo seguir.
export function ScenePanel() {
  const { screenplayId, maps, scenes, currentSid, userName, openCharacter, autoRefs, setAutoRefs, autoBusy } = useWorkspace();
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
  const pendingElsewhere = suggestionsOf(ai).filter((s) => anchorKey(s.anchor) !== key).length;
  const review = ai.review as Review | undefined;
  const doubts = scene ? (review?.items ?? []).filter((d) => d.sid === scene.sid) : [];
  const resolve = (id: string) => {
    const r = maps.ai.get("review") as Review | undefined;
    if (r) maps.ai.set("review", { ...r, items: r.items.filter((x) => x.id !== id) });
  };

  return (
    <div className="space-y-8 text-[14px]">
      <section>
        <p className="sp-label">{scene ? `Escena ${scene.number} · ${formatEighths(scene.eighths)} pág.` : "Antes de la primera escena"}</p>
        {scene ? (
          <>
            <InlineText
              label="De qué va la escena"
              value={meta[scene.sid]?.synopsis ?? ""}
              onSave={(v) => updateSceneMeta(maps, scene.sid, { synopsis: v })}
              placeholder="De qué va esta escena, en una frase"
              className="mt-2 text-[14.5px] leading-relaxed"
            />
            {scene.present.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {scene.present.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => openCharacter(n)}
                    className="rounded-full border border-[var(--line)] bg-white px-2.5 py-0.5 font-[family-name:var(--font-courier)] text-[12px] font-bold hover:border-[var(--accent)]"
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="mt-2 leading-relaxed text-muted">Escribe un encabezado («INT.» o «EXT.») y aquí verás todo lo de esa escena.</p>
        )}
      </section>

      {doubts.length > 0 && (
        <section>
          <h3 className="sp-label">Dudas de la revisión · {doubts.length}</h3>
          <ul className="mt-2 space-y-2.5">
            {doubts.map((d) => (
              <li key={d.id} className="border-l-2 border-dashed border-[var(--ai)] pl-3 leading-relaxed">
                <span className="text-[12px] text-muted">{REVIEW_KINDS[d.kind]}</span>
                <p>{d.text}</p>
                <button type="button" onClick={() => resolve(d.id)} className="text-[12.5px] text-muted hover:text-fg">
                  Resuelta
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between">
          <h3 className="sp-label">Referencias {mine.length > 0 && `· ${mine.length}`}</h3>
          {!adding && (
            <button type="button" onClick={() => setAdding(true)} className="text-[13px] text-[var(--accent)] hover:underline">
              + Añadir
            </button>
          )}
        </div>
        {adding && (
          <div className="mt-3">
            <ReferenceForm anchor={anchor} onDone={() => setAdding(false)} />
          </div>
        )}
        <div className="divide-y divide-[var(--line)]">
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
        {autoBusy && scene && autoBusy !== scene.sid && (
          <p className="mt-2 text-[12.5px] text-[var(--ai)]">
            <span className="sp-ai-dot mr-1.5 inline-block animate-pulse" />
            Buscando referencias para la escena {scenes.find((x) => x.sid === autoBusy)?.number ?? ""}…
          </p>
        )}
        {pendingElsewhere > 0 && (
          <p className="mt-2 text-[12.5px] text-muted">
            {pendingElsewhere} {pendingElsewhere === 1 ? "propuesta" : "propuestas"} en otras escenas (en el Asistente IA).
          </p>
        )}
        <AiButton
          className="mt-3"
          label={scene ? "Proponer para esta escena" : "Proponer referencias"}
          run={async () => {
            const res = await suggestReferencesAction(screenplayId, scene ? { type: "scene", sid: scene.sid } : { type: "script" });
            if (!res.ok) return res;
            return pushSuggestions(maps, res.suggestions) ? res : { ok: false as const, error: NOTHING_NEW };
          }}
        />
        <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-muted">
          <input type="checkbox" checked={autoRefs} onChange={(e) => setAutoRefs(e.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
          Proponer referencias solas al terminar cada escena
        </label>
      </section>

      <section>
        <h3 className="sp-label">¿Atascada?</h3>
        {questions && questions.items.length > 0 ? (
          <ol className="mt-2 space-y-2">
            {questions.items.map((q, i) => (
              <li key={i} className="border-l-2 border-dashed border-[var(--ai)] pl-3 leading-relaxed">
                {q}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 leading-relaxed text-muted">La IA lee lo que llevas y te hace preguntas. Las respuestas son tuyas.</p>
        )}
        <AiButton
          className="mt-3"
          label={questions ? "Otras preguntas" : "Hazme preguntas"}
          pendingLabel="Pensando preguntas…"
          run={async () => {
            const res = await askQuestionsAction(screenplayId, scene?.sid ?? null);
            if (res.ok) maps.ai.set(`q:${scene?.sid ?? "script"}`, res.questions);
            return res;
          }}
        />
      </section>
    </div>
  );
}
