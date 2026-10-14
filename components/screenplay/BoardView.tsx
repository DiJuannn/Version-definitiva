"use client";

import { useState } from "react";
import { useYMap } from "@/lib/screenplay/use-ymap";
import {
  ACT_TEMPLATES,
  SCENE_COLORS,
  formatEighths,
  type ActTemplate,
  type Reference,
  type SceneInfo,
  type SceneMeta,
} from "@/lib/screenplay/story";
import { InlineText, updateSceneMeta, useWorkspace } from "@/components/screenplay/workspace";

export function actTemplate(structure: Record<string, unknown>): ActTemplate {
  const t = structure.template;
  return t === "five" || t === "free" ? t : "three";
}

// Escenas agrupadas en actos: un acto empieza en la escena marcada.
export function groupByAct(scenes: SceneInfo[], acts: Record<string, string>) {
  const groups: { label: string | null; scenes: SceneInfo[] }[] = [];
  for (const s of scenes) {
    const label = acts[s.sid];
    if (label || !groups.length) groups.push({ label: label ?? null, scenes: [] });
    groups[groups.length - 1].scenes.push(s);
  }
  return groups;
}

// Corcho: una ficha de cartulina por escena, por actos. Arrastrar una ficha
// mueve la escena en el guion (para todo el equipo, al momento).
export function BoardView() {
  const { maps, scenes, goToScene, moveScene, setView } = useWorkspace();
  const meta = useYMap<SceneMeta>(maps.scenes);
  const acts = useYMap<string>(maps.acts);
  const structure = useYMap<unknown>(maps.structure);
  const refs = useYMap<Reference>(maps.refs);
  const template = actTemplate(structure);
  const actNames = ACT_TEMPLATES[template].acts;
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const refCount = (sid: string) => Object.values(refs).filter((r) => r.anchor.type === "scene" && r.anchor.sid === sid).length;

  if (!scenes.length) {
    return (
      <p className="max-w-md py-16 font-sans text-sm text-muted">
        El corcho se llena solo: cada encabezado (INT. / EXT.) que escribas en la página es una ficha aquí.
      </p>
    );
  }

  const groups = groupByAct(scenes, acts);
  const drop = (toIndex: number) => {
    if (dragging) moveScene(dragging, toIndex);
    setDragging(null);
    setOver(null);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] text-muted">
        <span className="tracking-widest uppercase">Estructura</span>
        {(Object.keys(ACT_TEMPLATES) as ActTemplate[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => maps.structure.set("template", t)}
            className={`tracking-widest uppercase transition-colors ${t === template ? "text-fg underline decoration-accent underline-offset-8" : "hover:text-fg"}`}
          >
            {ACT_TEMPLATES[t].label}
          </button>
        ))}
        <span className="ml-auto">Arrastra las fichas para reordenar el guion · marca dónde empieza cada acto</span>
      </div>

      <div className="mt-8 space-y-12">
        {groups.map((g, gi) => (
          <section key={gi} aria-label={g.label ?? "Sin acto"}>
            <h3 className="mb-4 font-display text-xl font-black tracking-tight uppercase">
              {g.label ?? (template === "free" ? "Escenas" : "Antes del primer acto")}
              <span className="ml-3 font-mono text-[11px] font-normal tracking-widest text-muted">
                {formatEighths(g.scenes.reduce((n, s) => n + s.eighths, 0))} pág.
              </span>
            </h3>
            <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {g.scenes.map((s) => {
                const index = scenes.indexOf(s);
                const m = meta[s.sid] ?? {};
                const color = SCENE_COLORS[m.color ?? "none"]?.value ?? "transparent";
                return (
                  <li
                    key={s.sid}
                    draggable
                    onDragStart={(e) => {
                      setDragging(s.sid);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    onDragOver={(e) => {
                      if (!dragging) return;
                      e.preventDefault();
                      setOver(index);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      drop(index);
                    }}
                    className={`sp-card ${dragging === s.sid ? "opacity-40" : ""} ${over === index && dragging !== s.sid ? "sp-card-drop" : ""}`}
                    style={{ "--card-tag": color } as React.CSSProperties}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setView("page");
                          goToScene(s.sid);
                        }}
                        className="text-left font-[family-name:var(--font-courier)] text-[13px] leading-snug font-bold uppercase hover:underline"
                        title="Abrir en la página"
                      >
                        <span className="mr-2 text-[#8f897c]">{s.number}</span>
                        {s.heading}
                      </button>
                    </div>
                    <InlineText
                      label={`Sinopsis de la escena ${s.number}`}
                      value={m.synopsis ?? ""}
                      onSave={(v) => updateSceneMeta(maps, s.sid, { synopsis: v })}
                      placeholder={s.firstAction ? s.firstAction.slice(0, 120) : "De qué va esta escena…"}
                      rows={3}
                      className="mt-2 font-[family-name:var(--font-courier)] text-[13px] leading-snug text-[#2a2925] placeholder:text-[#a49d8e]"
                    />
                    <div className="mt-3 flex items-center gap-1" role="group" aria-label="Tensión de la escena">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                        <button
                          key={v}
                          type="button"
                          aria-label={`Tensión ${v}`}
                          aria-pressed={(m.tension ?? 0) >= v}
                          onClick={() => updateSceneMeta(maps, s.sid, { tension: m.tension === v ? undefined : v })}
                          className={`h-2.5 flex-1 rounded-[1px] transition-colors ${(m.tension ?? 0) >= v ? "bg-[#3b2f63]" : "bg-[#e3ded2] hover:bg-[#cfc8b8]"}`}
                        />
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#e6e1d5] pt-2.5 font-mono text-[10px] text-[#6f6a5f]">
                      <span>{formatEighths(s.eighths)} pág.</span>
                      {s.present.length > 0 && <span className="truncate">{s.present.join(" · ")}</span>}
                      {refCount(s.sid) > 0 && <span className="text-[#5b4a96]">{refCount(s.sid)} ref.</span>}
                      <span className="ml-auto flex items-center gap-2">
                        <select
                          aria-label="Color de la ficha"
                          value={m.color ?? "none"}
                          onChange={(e) => updateSceneMeta(maps, s.sid, { color: e.target.value })}
                          className="bg-transparent text-[10px] outline-none"
                        >
                          {Object.entries(SCENE_COLORS).map(([k, c]) => (
                            <option key={k} value={k}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        {actNames.length > 0 && (
                          <select
                            aria-label="Acto que empieza aquí"
                            value={acts[s.sid] ?? ""}
                            onChange={(e) => (e.target.value ? maps.acts.set(s.sid, e.target.value) : maps.acts.delete(s.sid))}
                            className="bg-transparent text-[10px] outline-none"
                          >
                            <option value="">Empieza acto…</option>
                            {actNames.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                          </select>
                        )}
                        <button type="button" aria-label="Mover antes" disabled={index === 0} onClick={() => moveScene(s.sid, index - 1)} className="disabled:opacity-30">
                          ←
                        </button>
                        <button
                          type="button"
                          aria-label="Mover después"
                          disabled={index === scenes.length - 1}
                          onClick={() => moveScene(s.sid, index + 2)}
                          className="disabled:opacity-30"
                        >
                          →
                        </button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
