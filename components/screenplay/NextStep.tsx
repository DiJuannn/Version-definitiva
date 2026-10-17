"use client";

import { useMemo } from "react";
import { useYMap } from "@/lib/screenplay/use-ymap";
import { structureTemplate } from "@/lib/screenplay/moments";
import type { LooseIdea } from "@/lib/screenplay/story";
import { useWorkspace, type Workspace } from "@/components/screenplay/workspace";
import { PREF_KEYS, useNextStepPref, usePref } from "@/components/screenplay/help-prefs";
import { nextStep, type NextStep as Step, type NextStepAction } from "@/components/screenplay/next-step-rules";

// «¿Y ahora qué?»: una tarjeta discreta que cambia según cómo va el guion
// (vacío, primera escena, sin diálogo, sin momentos marcados, borrador
// listo) y propone UNA cosa concreta que hacer. Sin IA.

export function useNextStep(): Step {
  const { blocks, scenes, maps } = useWorkspace();
  const beats = useYMap<string>(maps.beats);
  const loose = useYMap<LooseIdea>(maps.loose);
  const dev = useYMap<string>(maps.dev);
  const structure = useYMap<unknown>(maps.structure);
  const looseUnused = Object.values(loose).filter((l) => l && typeof l.text === "string" && l.text.trim() && !l.sid).length;
  const hasIdea = ["idea", "logline", "synopsis"].some((k) => typeof dev[k] === "string" && dev[k].trim());
  const moments = structureTemplate(structure) === "three";
  return useMemo(
    () => nextStep({ blocks, scenes, beats, looseUnused, hasIdea, moments }),
    [beats, blocks, hasIdea, looseUnused, moments, scenes],
  );
}

// Lo que hace cada botón, con las piezas que ya tiene el editor.
export function runNextStep(ws: Workspace, action: NextStepAction) {
  const { editor, scenes, currentSid } = ws;
  switch (action) {
    case "write":
      editor?.chain().focus("start").run();
      return;
    case "ideas":
      ws.openRail("ideas");
      return;
    case "moments":
      ws.openRail("estructura");
      return;
    case "idea":
      ws.setStep("idea");
      return;
    case "review":
      ws.openAssistant();
      return;
    case "export":
      window.dispatchEvent(new CustomEvent("screenplay:export", { detail: `/api/pdf/guion/${ws.screenplayId}?size=A4` }));
      return;
    case "newScene": {
      // Detrás de la escena donde estás (o al final), y el cursor en su «Lugar y hora».
      const i = scenes.findIndex((s) => s.sid === currentSid);
      const before = i >= 0 ? (scenes[i + 1]?.sid ?? null) : null;
      const sid = ws.addScene("", "", before);
      if (sid) ws.goToScene(sid);
      return;
    }
    case "dialogue": {
      // Una línea de «Quién habla» al final de la escena donde estás.
      if (!editor) return;
      const { doc, schema } = editor.state;
      const target = currentSid ?? scenes[scenes.length - 1]?.sid ?? null;
      let start = -1;
      let end = doc.content.size;
      doc.forEach((n, offset) => {
        if (n.type.name !== "sceneHeading") return;
        if (start < 0) {
          if ((n.attrs.sid as string | null) === target) start = offset;
        } else if (end === doc.content.size) end = offset;
      });
      // Si la última línea de la escena está vacía, se aprovecha.
      const $end = doc.resolve(end);
      const last = $end.nodeBefore;
      if (last && !last.textContent && last.type.name !== "sceneHeading") {
        const pos = end - last.nodeSize;
        editor.chain().focus().command(({ tr }) => {
          tr.setNodeMarkup(pos, schema.nodes.character);
          return true;
        }).setTextSelection(pos + 1).scrollIntoView().run();
        return;
      }
      editor
        .chain()
        .focus()
        .insertContentAt(end, { type: "character" })
        .setTextSelection(end + 1)
        .scrollIntoView()
        .run();
      return;
    }
  }
}

function Actions({ step, ws, small }: { step: Step; ws: Workspace; small?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${small ? "" : "mt-3"}`}>
      {step.actions.map((a, i) => (
        <button
          key={a.id}
          type="button"
          onClick={() => runNextStep(ws, a.id)}
          className={
            i === 0
              ? "rounded-md bg-[#1c1b19] px-2.5 py-1 text-[12.5px] font-medium text-white hover:bg-black"
              : "rounded-md border border-[var(--line)] bg-white px-2.5 py-1 text-[12.5px] text-fg hover:border-[#b9b9bd]"
          }
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

// En el margen izquierdo del papel (pantallas anchas).
export function NextStepCard({ width, folded: forceFold = false }: { width: number; folded?: boolean }) {
  const ws = useWorkspace();
  const step = useNextStep();
  const [pref] = useNextStepPref();
  const [foldedPref, setFolded] = usePref(PREF_KEYS.nextStepFolded);
  if (pref === "off") return null;
  const folded = forceFold || foldedPref === "1";
  if (folded) {
    return (
      <button
        type="button"
        onClick={() => setFolded(null)}
        aria-expanded={false}
        title={step.title}
        className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white/80 px-2.5 py-1 text-[12px] text-muted shadow-sm hover:text-fg"
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        ¿Y ahora qué?
      </button>
    );
  }
  return (
    <section
      aria-label="¿Y ahora qué?"
      style={{ width }}
      className="rounded-xl bg-white p-3.5 text-[13px] leading-snug shadow-[0_0_0_1px_var(--line),0_12px_30px_-24px_rgba(0,0,0,0.35)]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="sp-label !text-[9.5px]">¿Y ahora qué?</p>
        <button
          type="button"
          onClick={() => setFolded("1")}
          aria-label="Plegar «¿Y ahora qué?»"
          title="Plegar"
          className="-mt-1 -mr-1 px-1 text-[15px] leading-none text-muted hover:text-fg"
        >
          –
        </button>
      </div>
      <h2 className="mt-1.5 text-[14.5px] leading-snug font-bold">{step.title}</h2>
      <p className="mt-1 text-muted">{step.text}</p>
      <Actions step={step} ws={ws} />
    </section>
  );
}

// En pantallas estrechas: una franja encima del papel.
export function NextStepBanner({ below = false }: { below?: boolean }) {
  const ws = useWorkspace();
  const step = useNextStep();
  const [pref] = useNextStepPref();
  const [foldedPref, setFolded] = usePref(PREF_KEYS.nextStepFolded);
  if (pref === "off") return null;
  if (foldedPref === "1") {
    return (
      <div className={`${below ? "mt-9" : "mt-2"} flex justify-end`}>
        <button
          type="button"
          onClick={() => setFolded(null)}
          className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[12px] text-muted hover:text-fg"
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          ¿Y ahora qué?
        </button>
      </div>
    );
  }
  return (
    <section aria-label="¿Y ahora qué?" className={`${below ? "mt-10" : "mt-3"} rounded-xl bg-white px-3.5 py-3 text-[13px] leading-snug shadow-[0_0_0_1px_var(--line)]`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-fg">{step.title}</p>
          <p className="mt-0.5 text-muted">{step.text}</p>
        </div>
        <button type="button" onClick={() => setFolded("1")} aria-label="Plegar «¿Y ahora qué?»" className="-mt-0.5 px-1 text-[16px] leading-none text-muted hover:text-fg">
          –
        </button>
      </div>
      <div className="mt-2">
        <Actions step={step} ws={ws} small />
      </div>
    </section>
  );
}
