"use client";

import { useId, useState } from "react";
import { whenText, type PlacedMoment } from "@/lib/screenplay/moments";
import type { StoryModel } from "@/components/screenplay/story-model";

export const BTN =
  "rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12.5px] text-fg transition-colors hover:border-[#b9b9bd]";
export const BTN_PRIMARY =
  "rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-2.5 py-1.5 text-[12.5px] text-white transition-colors hover:bg-[#4b3a8f]";
export const BTN_GHOST = "rounded-lg px-1.5 py-1.5 text-[12.5px] hover:underline";

// La tarjeta de un momento: qué es, la pregunta que ayuda a escribirlo, un
// ejemplo, cuándo suele pasar y qué se puede hacer con él. Se abre al tocar un
// momento en la barra «Tu historia» (o en su hoja, en el móvil).
export function MomentCard({
  item,
  model,
  onDone,
  initialWriting = false,
  hideTitle = false,
}: {
  item: PlacedMoment;
  model: StoryModel;
  onDone?: () => void;
  initialWriting?: boolean;
  hideTitle?: boolean; // en la hoja del móvil el nombre ya está en la fila
}) {
  const { moment, scene, placed } = item;
  const { current, goToScene, mark, ideasByMoment, totalPages, scenes, openRail, editor } = model;
  const [writing, setWriting] = useState(initialWriting);
  const [saved, setSaved] = useState(false);
  const ideas = ideasByMoment.get(moment.id) ?? 0;
  const here = current && current.sid !== scene?.sid ? current : null;

  const go = (sid: string) => {
    goToScene(sid);
    onDone?.();
  };

  return (
    <div className="text-[13px] leading-[1.45]">
      {!hideTitle && (
        <h3 className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold">
          {moment.plain}
          <small className="font-mono text-[10.5px] font-medium tracking-[0.12em] text-muted uppercase">{moment.technical}</small>
        </h3>
      )}
      <p className={hideTitle ? "" : "mt-1"}>{moment.what}</p>
      <div className="mt-2.5 rounded-lg bg-[#f6f4fb] px-3 py-2.5">
        <p className="text-[10.5px] font-semibold tracking-[0.12em] text-[var(--accent)] uppercase">Pregúntate</p>
        <p className="mt-0.5">{moment.question}</p>
      </div>
      <p className="mt-2 text-[12px] text-muted">
        Ejemplo: {lowerFirst(moment.example)} {!moment.auto && <>· {whenText(moment, totalPages)}</>}
      </p>

      <div className="mt-2.5 border-t border-[var(--line)] pt-2.5 text-[12.5px]">
        {scenes.length === 0 ? (
          <p className="text-muted">Aún no has escrito escenas. No hace falta ir en orden: apunta lo que ya sepas.</p>
        ) : placed && scene ? (
          <p className="flex min-w-0 items-baseline gap-1.5">
            <span aria-hidden className="text-[var(--accent)]">●</span>
            <span className="min-w-0 truncate">
              {moment.auto ? "Es la " : "Lo marcaste en la "}
              <b>escena {scene.number}</b>
              {scene.heading && <span className="font-[family-name:var(--font-courier)] text-[11.5px] text-muted"> · {scene.heading}</span>}
            </span>
          </p>
        ) : (
          <p className="text-muted">Aún no lo has marcado. Márcalo en la escena en la que pasa (o apunta una idea si aún no está escrita).</p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {scenes.length === 0 && moment.auto && (
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() => {
                editor?.chain().focus("start").run();
                onDone?.();
              }}
            >
              Escribir esta escena →
            </button>
          )}
          {placed && scene && (
            <button type="button" className={BTN_PRIMARY} onClick={() => go(scene.sid)}>
              Ir a la escena {scene.number}
            </button>
          )}
          {!moment.auto && here && (
            <button type="button" className={placed ? BTN : BTN_PRIMARY} onClick={() => mark(moment.id, here.sid)}>
              {placed ? `Pasarlo a la escena ${here.number} (aquí)` : `Marcar esta escena (${here.number})`}
            </button>
          )}
          {!moment.auto && !placed && !here && scenes.length > 0 && (
            <span className="text-[12px] text-muted">Pon el cursor en una escena para marcarla.</span>
          )}
          {!moment.auto && placed && (
            <button type="button" className={`${BTN_GHOST} text-muted hover:text-fg`} onClick={() => mark(moment.id, null)}>
              Quitar
            </button>
          )}
          {!writing && (
            <button type="button" className={`${BTN_GHOST} text-[var(--accent)]`} onClick={() => (setWriting(true), setSaved(false))}>
              Apuntar idea
            </button>
          )}
        </div>

        {writing && <IdeaComposer model={model} item={item} onClose={(ok) => (setWriting(false), setSaved(ok))} />}
        {(saved || ideas > 0) && !writing && (
          <p className="mt-2 text-[12px] text-muted" role={saved ? "status" : undefined}>
            {saved ? "Guardada en Ideas sueltas. " : ""}
            {ideas > 0 && `${ideas} ${ideas === 1 ? "idea apuntada" : "ideas apuntadas"} para este momento. `}
            <button
              type="button"
              className="text-[var(--accent)] hover:underline"
              onClick={() => {
                openRail("ideas");
                onDone?.();
              }}
            >
              Ver ideas
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export function IdeaComposer({ model, item, onClose }: { model: StoryModel; item: Pick<PlacedMoment, "moment">; onClose: (saved: boolean) => void }) {
  const [text, setText] = useState("");
  const id = useId();
  const save = () => {
    if (!text.trim()) return onClose(false);
    model.addIdea(item.moment.id, text);
    onClose(true);
  };
  return (
    <form
      className="mt-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label htmlFor={id} className="sr-only">
        Idea para «{item.moment.plain}»
      </label>
      <textarea
        id={id}
        autoFocus
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose(false);
          }
        }}
        placeholder="Lo que ya sepas, aunque sea una frase…"
        className="block w-full resize-none rounded-lg border-[1.5px] border-[var(--accent)]/50 bg-white px-2.5 py-2 text-[13px] leading-snug outline-none focus:border-[var(--accent)]"
      />
      <div className="mt-1.5 flex items-center gap-3">
        <button type="submit" className={BTN_PRIMARY}>
          Guardar idea
        </button>
        <button type="button" className="text-[12.5px] text-muted hover:text-fg" onClick={() => onClose(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
