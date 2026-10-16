"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useYMap } from "@/lib/screenplay/use-ymap";
import {
  ACT_TEMPLATES,
  LOOSE_KINDS,
  formatEighths,
  guessLooseKind,
  isLooseKind,
  referenceId,
  type ActTemplate,
  type BeatKey,
  type LooseKind,
  type SceneInfo,
  type SceneMeta,
} from "@/lib/screenplay/story";
import {
  ACT_PLAIN,
  KEY_MOMENTS,
  checkStory,
  momentById,
  screenTime,
  type CheckItem,
  type Moment,
  type MomentId,
} from "@/lib/screenplay/moments";
import { findStructureAction } from "@/lib/actions/screenplay-ai";
import type { BeatProposal } from "@/lib/screenplay-ai";
import { InlineText, updateSceneMeta, useWorkspace, type RailTab } from "@/components/screenplay/workspace";
import { useStoryModel, type MomentIdea, type StoryModel } from "@/components/screenplay/story-model";
import { BTN, BTN_GHOST, BTN_PRIMARY, IdeaComposer } from "@/components/screenplay/MomentCard";
import { duplicateScene, moveSceneTo, showStoryNotice, undoAction } from "@/components/screenplay/scene-moves";

// Escenas agrupadas en actos: un acto empieza en la escena marcada. Si hay
// actos y la primera escena no abre ninguno, ese primer tramo es el Acto I.
function groupByAct(scenes: SceneInfo[], acts: Record<string, string>, firstLabel: string | null) {
  const groups: { label: string | null; scenes: SceneInfo[] }[] = [];
  for (const s of scenes) {
    const label = acts[s.sid];
    if (label || !groups.length) groups.push({ label: label ?? firstLabel, scenes: [] });
    groups[groups.length - 1].scenes.push(s);
  }
  return groups;
}

// En pantallas estrechas el panel tapa la página: al ir a una escena se cierra.
const narrow = () => typeof window !== "undefined" && window.innerWidth < 1280;

// Columna junto a la página: «Tu historia» (cómo va, actos y escenas, que se
// mueven con el menú ⋯ o arrastrando) y las Ideas sueltas.
export function StoryRail({ tab, onClose }: { tab: RailTab; onClose: () => void }) {
  const { maps } = useWorkspace();
  const loose = useYMap<MomentIdea>(maps.loose);
  const pending = Object.values(loose).filter((l) => l && !l.sid).length;
  const onNavigate = () => narrow() && onClose();
  return (
    <div className="flex h-full flex-col">
      {/* Qué panel se ve lo eligen los botones de la barra; aquí solo su nombre y cerrar. */}
      <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-2.5">
        <p className="text-[13px] font-semibold">{tab === "estructura" ? "Tu historia" : `Ideas sueltas${pending ? ` · ${pending}` : ""}`}</p>
        <button type="button" onClick={onClose} aria-label="Cerrar el panel" title="Cerrar el panel" className="ml-auto text-[15px] text-muted hover:text-fg">
          ×
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {tab === "estructura" ? <StructurePanel onNavigate={onNavigate} /> : <LooseIdeasPanel onNavigate={onNavigate} />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ tu historia

function StructurePanel({ onNavigate }: { onNavigate: () => void }) {
  const model = useStoryModel();
  const { maps, scenes, currentSid, goToScene, moveScene, pageCount, openOpenings, template } = model;
  const acts = useYMap<string>(maps.acts);
  const meta = useYMap<SceneMeta>(maps.scenes);
  const actNames: readonly string[] = ACT_TEMPLATES[template].acts;
  const marked = Object.keys(acts).length > 0;
  const groups = groupByAct(scenes, acts, marked && actNames.length ? actNames[0] : null);
  const beatsBySid = new Map<string, Moment[]>();
  for (const p of model.placed) if (p.placed && p.sid && !p.moment.auto) beatsBySid.set(p.sid, [...(beatsBySid.get(p.sid) ?? []), p.moment]);

  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const go = (sid: string) => {
    goToScene(sid);
    onNavigate();
  };

  if (scenes.length === 0) {
    return (
      <div className="text-[13.5px] leading-relaxed">
        <p className="sp-label">Tu historia</p>
        <p className="mt-2 text-muted">Aquí verás tu guion por actos y cómo va tu historia en cuanto escribas la primera escena.</p>
        <ThreeActsPrimer />
        <button type="button" onClick={openOpenings} className="sp-btn mt-4 w-full justify-center">
          ¿Por dónde empiezo?
        </button>
      </div>
    );
  }

  return (
    <div className="text-[13px]">
      <div className="flex items-baseline justify-between gap-2">
        <p className="sp-label">
          {scenes.length} {scenes.length === 1 ? "escena" : "escenas"}
          {pageCount > 0 && ` · ${pageCount} ${pageCount === 1 ? "página" : "páginas"}`}
        </p>
        <select
          aria-label="Tipo de estructura"
          value={template}
          onChange={(e) => maps.structure.set("template", e.target.value)}
          className="bg-transparent text-[12px] text-muted outline-none"
        >
          {(Object.keys(ACT_TEMPLATES) as ActTemplate[]).map((t) => (
            <option key={t} value={t}>
              {ACT_TEMPLATES[t].label}
            </option>
          ))}
        </select>
      </div>

      {template === "three" ? (
        <StoryCheckPanel model={model} onNavigate={onNavigate} />
      ) : (
        <p className="mt-3 rounded-lg bg-white p-2.5 text-[12px] leading-snug text-muted">
          {template === "five" ? "Con 5 actos marcas dónde empieza cada acto en la lista de escenas." : "Estructura libre: sin actos ni momentos marcados."} Los momentos («Algo cambia», «El gran final»…) son de la estructura en 3 actos.
        </p>
      )}

      {/* Escenas por acto. Se mueven con el menú ⋯ (o arrastrando). */}
      <section className="mt-6">
        <h3 className="sp-label">Escenas</h3>
        {groups.map((g, gi) => (
          <div key={gi} className="mt-2.5">
            {(g.label || groups.length > 1) && (
              <p className="flex items-baseline justify-between border-b border-[var(--line)] pb-1 text-[12px] font-bold tracking-wide text-[#5a46a8] uppercase">
                <span>
                  {g.label ?? "Antes del primer acto"}
                  {g.label && template === "three" && ACT_PLAIN[g.label] && <span className="font-normal tracking-normal text-muted normal-case"> · {ACT_PLAIN[g.label]}</span>}
                </span>
                <span className="font-normal tracking-normal text-muted normal-case">{screenTime(g.scenes.reduce((n, s) => n + s.eighths, 0))}</span>
              </p>
            )}
            <ol>
              {g.scenes.map((s) => {
                const index = scenes.indexOf(s);
                const here = beatsBySid.get(s.sid) ?? [];
                const active = s.sid === currentSid;
                return (
                  <li
                    key={s.sid}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(s.sid);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOver(index);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragging) moveScene(dragging, index);
                      setDragging(null);
                      setOver(null);
                    }}
                    className={`group/s rounded-md px-1.5 py-1.5 ${dragging === s.sid ? "opacity-40" : ""} ${
                      over === index && dragging && dragging !== s.sid ? "shadow-[inset_0_2px_0_var(--accent)]" : ""
                    } ${active ? "bg-[var(--accent)]/10" : "hover:bg-white"}`}
                  >
                    <div className="flex items-start gap-2">
                      <span aria-hidden title="Arrastra para mover" className="cursor-grab pt-px text-[#b9b9bd] select-none">
                        ⋮⋮
                      </span>
                      <button type="button" onClick={() => go(s.sid)} className="min-w-0 flex-1 text-left">
                        <span className="flex gap-1.5 font-[family-name:var(--font-courier)] text-[12px] leading-snug font-bold">
                          <span className="text-[var(--accent)]">{s.number}</span>
                          <span className="truncate">{s.heading || "Sin encabezado"}</span>
                        </span>
                        {here.length > 0 && (
                          <span className="mt-0.5 block text-[11px] font-semibold text-[var(--accent)]">● {here.map((m) => m.plain).join(" · ")}</span>
                        )}
                      </button>
                      <span className="pt-px text-[11px] text-muted" title={`${formatEighths(s.eighths)} pág.`}>
                        {screenTime(s.eighths)}
                      </span>
                      <SceneMenu scene={s} model={model} />
                    </div>
                    <div className="pl-5">
                      <InlineText
                        label={`De qué va la escena ${s.number}`}
                        value={meta[s.sid]?.synopsis ?? ""}
                        onSave={(v) => updateSceneMeta(maps, s.sid, { synopsis: v })}
                        placeholder={s.firstAction ? s.firstAction.slice(0, 80) : "De qué va…"}
                        className="text-[12px] leading-snug text-muted"
                      />
                      {actNames.length > 0 && (
                        <select
                          aria-label={`Empieza un acto en la escena ${s.number}`}
                          value={acts[s.sid] ?? ""}
                          onChange={(e) => (e.target.value ? maps.acts.set(s.sid, e.target.value) : maps.acts.delete(s.sid))}
                          className={`mt-0.5 bg-transparent text-[11px] text-muted outline-none group-focus-within/s:block group-hover/s:block ${
                            active || acts[s.sid] ? "block" : "hidden pointer-coarse:block"
                          }`}
                        >
                          <option value="">Empezar un acto aquí…</option>
                          {actNames.map((a) => (
                            <option key={a} value={a}>
                              {a} empieza aquí
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
        <AddScene />
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ ¿cómo va mi historia?

function StoryCheckPanel({ model, onNavigate }: { model: StoryModel; onNavigate: () => void }) {
  const { scenes, beats, target, structure, pageCount, maps } = model;
  const dismissed = (structure.dismissed && typeof structure.dismissed === "object" ? structure.dismissed : {}) as Record<string, unknown>;
  const check = checkStory({ scenes, beats, target, dismissed });
  const [writing, setWriting] = useState<MomentId | null>(null);
  const markOk = (id: MomentId, sid: string | null) => maps.structure.set("dismissed", { ...dismissed, [id]: sid });

  return (
    <section className="mt-3" aria-labelledby="sp-how">
      <h3 id="sp-how" className="text-[16px] leading-tight font-bold">
        ¿Cómo va mi historia?
      </h3>
      <p className="mt-1 text-[12.5px] leading-snug text-muted">
        {pageCount < target ? (
          <>
            Llevas <b className="text-fg">{pageCount} de ~{target} páginas</b>.
          </>
        ) : (
          <>
            Llevas <b className="text-fg">{pageCount} páginas</b>.
          </>
        )}{" "}
        Tienes {check.done} de los {KEY_MOMENTS.length} momentos que sostienen casi cualquier historia.
      </p>
      <div aria-hidden className="mt-2.5 flex gap-1">
        {KEY_MOMENTS.map((m, i) => (
          <i key={m.id} className={`h-1.5 flex-1 rounded-full ${i < check.done ? "bg-[var(--accent)]" : "bg-[#e4e2dc]"}`} />
        ))}
      </div>
      <ul className="mt-2 space-y-2">
        {check.items.map((it, k) =>
          it.kind === "gap" ? (
            <li key={`gap-${k}`} className="rounded-[10px] border border-dashed border-[#c8c6d2] px-3 py-2.5 text-[12.5px] leading-snug text-muted">
              <b className="text-fg">Hueco:</b> {it.text}{" "}
              {it.next &&
                (writing === it.next.id ? null : (
                  <button type="button" onClick={() => setWriting(it.next!.id)} className="text-[var(--accent)] hover:underline">
                    Apuntar una idea →
                  </button>
                ))}
            </li>
          ) : (
            <CheckCard
              key={it.placed.moment.id}
              item={it}
              model={model}
              onNavigate={onNavigate}
              writing={writing === it.placed.moment.id}
              setWriting={(on) => setWriting(on ? it.placed.moment.id : null)}
              onOk={() => markOk(it.placed.moment.id, it.placed.sid)}
            />
          ),
        )}
      </ul>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11.5px] leading-snug text-muted">Son orientativos, no reglas. Puedes cambiar a «5 actos» o «Libre» arriba.</p>
        <StructureAi model={model} />
      </div>
    </section>
  );
}

function CheckCard({
  item,
  model,
  onNavigate,
  writing,
  setWriting,
  onOk,
}: {
  item: Extract<CheckItem, { kind: "moment" }>;
  model: StoryModel;
  onNavigate: () => void;
  writing: boolean;
  setWriting: (on: boolean) => void;
  onOk: () => void;
}) {
  const { placed: p, status, page, expectedPage } = item;
  const { current, mark, goToScene, totalPages, maps } = model;
  const scene = p.scene;
  const here = current && current.sid !== scene?.sid ? current : null;
  const meta = maps.scenes.get(scene?.sid ?? "") as SceneMeta | undefined;
  const pct = Math.round(p.at * 100);
  const go = (sid: string) => {
    goToScene(sid);
    onNavigate();
  };
  const icon =
    status === "ok"
      ? { mark: "✓", cls: "bg-[#e5f4ea] text-[var(--success)]", label: "Hecho" }
      : status === "missing"
        ? { mark: "", cls: "border-[1.5px] border-dashed border-[#b9b6c6]", label: "Aún no está" }
        : { mark: "!", cls: "bg-[#fbefd9] text-[var(--warn)]", label: status === "early" ? "Llega pronto" : status === "late" ? "Llega tarde" : "Fuera de orden" };

  return (
    <li className="group/c rounded-[10px] bg-white px-3 py-2.5 shadow-[0_0_0_1px_var(--line)]">
      <div className="flex items-center gap-2">
        <span role="img" aria-label={icon.label} className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${icon.cls}`}>
          {icon.mark}
        </span>
        <span className="min-w-0 font-semibold">
          {p.moment.plain} <small className="ml-0.5 text-[11.5px] font-normal text-muted">{p.moment.technical}</small>
        </span>
        {scene ? (
          <button type="button" onClick={() => go(scene.sid)} className="ml-auto shrink-0 font-[family-name:var(--font-courier)] text-[12px] text-[var(--accent)] hover:underline">
            esc. {scene.number}
          </button>
        ) : (
          <span className="ml-auto shrink-0 font-[family-name:var(--font-courier)] text-[12px] text-muted">hacia pág. {expectedPage}</span>
        )}
      </div>
      <div className="mt-1 pl-7 text-[12.5px] leading-snug text-muted">
        {status === "ok" && (
          <>
            {(meta?.synopsis || scene?.firstAction) && <p className="line-clamp-2 text-[#3a3a40]">{meta?.synopsis || scene!.firstAction}</p>}
            <p>Llega a tiempo: hacia el {pct} % de la historia.</p>
          </>
        )}
        {(status === "late" || status === "early") && (
          <p>
            <b className="font-semibold text-[var(--warn)]">{status === "late" ? "Llega tarde." : "Llega pronto."}</b> Cae en la pág. {page} de ~{totalPages} ({pct} %). Suele llegar{" "}
            {status === "late" ? "antes" : "después"}, hacia la pág. {expectedPage}. {status === "late" ? "¿Puede pasar antes?" : "¿Necesita algo más de camino antes?"}
          </p>
        )}
        {status === "order" && item.after && (
          <p>
            <b className="font-semibold text-[var(--warn)]">Fuera de orden.</b> Va antes que «{item.after.plain}» y suele ir después. ¿Están bien marcados?
          </p>
        )}
        {status === "missing" && <p className="text-[#3a3a40]">{p.moment.question}</p>}

        {/* Lo que hay que hacer se ve siempre (también en táctil); en lo que
            ya está bien, las acciones salen al pasar por encima. */}
        <div
          className={`mt-2 flex-wrap items-center gap-2 ${
            status === "ok" ? "hidden group-hover/c:flex group-focus-within/c:flex pointer-coarse:flex" : "flex"
          }`}
        >
          {(status === "late" || status === "early" || status === "order") && scene && (
            <button type="button" className={BTN} onClick={() => go(scene.sid)}>
              Ir a la escena {scene.number}
            </button>
          )}
          {(status === "late" || status === "early") && (
            <button type="button" className={`${BTN_GHOST} text-muted hover:text-fg`} onClick={onOk}>
              Está bien así
            </button>
          )}
          {status === "missing" && here && (
            <button type="button" className={BTN_PRIMARY} onClick={() => mark(p.moment.id, here.sid)}>
              Es la escena en la que estoy ({here.number})
            </button>
          )}
          {status !== "missing" && here && (
            <button type="button" className={`${BTN_GHOST} text-[var(--accent)]`} onClick={() => mark(p.moment.id, here.sid)}>
              Pasarlo a la escena {here.number} (aquí)
            </button>
          )}
          {status !== "missing" && (
            <button type="button" className={`${BTN_GHOST} text-muted hover:text-fg`} onClick={() => mark(p.moment.id, null)}>
              Quitar
            </button>
          )}
          {status === "missing" && !writing && (
            <button type="button" className={`${BTN_GHOST} text-[var(--accent)]`} onClick={() => setWriting(true)}>
              Apuntar una idea
            </button>
          )}
        </div>
        {writing && <IdeaComposer model={model} item={p} onClose={() => setWriting(false)} />}
      </div>
    </li>
  );
}

function ThreeActsPrimer() {
  return (
    <div className="mt-4 rounded-lg bg-white p-3 text-[12.5px] leading-snug">
      <p className="font-semibold">Tres actos, en corto</p>
      <ol className="mt-1.5 space-y-1 text-muted">
        <li>
          <b className="text-fg">I · Planteamiento</b> (¼): quién, dónde y qué rompe la normalidad.
        </li>
        <li>
          <b className="text-fg">II · Nudo</b> (½): lo intenta, se complica, todo empeora.
        </li>
        <li>
          <b className="text-fg">III · Desenlace</b> (¼): el enfrentamiento final y lo que queda.
        </li>
      </ol>
    </div>
  );
}

// ------------------------------------------------------------------ mover escenas sin arrastrar

function SceneMenu({ scene, model }: { scene: SceneInfo; model: StoryModel }) {
  const { editor, scenes, maps, goToScene } = model;
  const [open, setOpen] = useState(false);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const order = scenes.map((s) => s.sid);
  const i = order.indexOf(scene.sid);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && (setOpen(false), setMoveTo(null));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setOpen(false), setMoveTo(null));
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const move = (to: number) => {
    setOpen(false);
    setMoveTo(null);
    if (!editor || to === i) return;
    if (moveSceneTo(editor, order, scene.sid, to))
      showStoryNotice({ text: `Escena ${scene.number} movida a la posición ${to + 1}.`, action: undoAction(editor) });
  };
  const item = "block w-full rounded-md px-2.5 py-1.5 text-left text-[12.5px] hover:bg-black/[0.04] disabled:text-[#b9b9bd] disabled:hover:bg-transparent";

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={`Más acciones de la escena ${scene.number}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="-mt-0.5 grid h-6 w-6 place-items-center rounded text-[15px] leading-none text-muted hover:bg-black/[0.05] hover:text-fg"
      >
        ⋯
      </button>
      {open && (
        <div role="menu" className="absolute top-7 right-0 z-30 w-48 rounded-lg bg-white p-1 shadow-[0_0_0_1px_var(--line),0_14px_30px_-12px_rgba(0,0,0,0.3)]">
          <button role="menuitem" type="button" className={item} disabled={i <= 0} onClick={() => move(i - 1)}>
            Subir <span className="float-right text-[11px] text-muted">Alt ↑</span>
          </button>
          <button role="menuitem" type="button" className={item} disabled={i >= order.length - 1} onClick={() => move(i + 1)}>
            Bajar <span className="float-right text-[11px] text-muted">Alt ↓</span>
          </button>
          {moveTo === null ? (
            <button role="menuitem" type="button" className={item} disabled={order.length < 2} onClick={() => setMoveTo(String(i + 1))}>
              Mover a…
            </button>
          ) : (
            <form
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12.5px]"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(moveTo);
                if (Number.isFinite(n) && n >= 1) move(Math.min(order.length, Math.round(n)) - 1);
              }}
            >
              <label htmlFor={`mv-${scene.sid}`}>Posición</label>
              <input
                id={`mv-${scene.sid}`}
                autoFocus
                type="number"
                min={1}
                max={order.length}
                value={moveTo}
                onChange={(e) => setMoveTo(e.target.value)}
                className="w-12 rounded border border-[var(--line)] px-1 py-0.5 text-right outline-none focus:border-[var(--accent)]"
              />
              <button type="submit" className="ml-auto font-semibold text-[var(--accent)]">
                Mover
              </button>
            </form>
          )}
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              if (!editor) return;
              const copy = duplicateScene(editor, scene.sid);
              if (!copy) return;
              const m = maps.scenes.get(scene.sid);
              if (m) maps.scenes.set(copy, { ...m });
              showStoryNotice({
                text: `Escena ${scene.number} duplicada: la copia es la ${scene.number + 1}.`,
                action: { label: "Ir", run: () => goToScene(copy) },
              });
            }}
          >
            Duplicar
          </button>
        </div>
      )}
    </div>
  );
}

// La IA lee lo escrito y propone dónde está cada momento; se acepta uno a uno.
function StructureAi({ model }: { model: StoryModel }) {
  const { screenplayId, flushSave, mark } = model;
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ beats: BeatProposal[]; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            await flushSave();
            const res = await findStructureAction(screenplayId).catch(() => null);
            if (!res) setError("No se ha podido conectar. Inténtalo otra vez.");
            else if (!res.ok) setError(res.error);
            else setResult({ beats: res.beats, note: res.note });
          })
        }
        className="text-[11.5px] text-[var(--ai)] hover:underline disabled:opacity-60"
      >
        {pending ? "Leyendo…" : "Buscarlos con IA"}
      </button>
      {(result || error) && (
        <div className="mt-2 basis-full rounded-lg border border-dashed border-[var(--ai)] bg-white p-3 text-[12.5px] leading-snug">
          {error ? (
            <p className="text-danger">{error}</p>
          ) : (
            result && (
              <>
                <p className="mb-2 text-[11.5px] text-[var(--ai)]">Propuesta de la IA: márcala solo si te convence.</p>
                <ul className="space-y-2">
                  {result.beats.map((b) => (
                    <li key={b.beat}>
                      <p>
                        <b>{momentById(b.beat)?.plain}</b>
                        {b.scene ? ` · escena ${b.scene}` : " · todavía no está"}
                      </p>
                      <p className="text-muted">{b.why}</p>
                      {b.sid && (
                        <button type="button" onClick={() => mark(b.beat as BeatKey, b.sid)} className="mt-0.5 text-[var(--accent)] hover:underline">
                          Marcarlo
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {result.note && <p className="mt-2 border-t border-[var(--line)] pt-2 text-muted">{result.note}</p>}
              </>
            )
          )}
          <button type="button" onClick={() => (setResult(null), setError(null))} className="mt-2 text-muted hover:text-fg">
            Cerrar
          </button>
        </div>
      )}
    </>
  );
}

// Escena nueva: por defecto después de la actual (o al final).
function AddScene() {
  const { addScene, goToScene, scenes, currentSid } = useWorkspace();
  const [open, setOpen] = useState<"after" | "end" | null>(null);
  const [heading, setHeading] = useState("");
  const cur = scenes.findIndex((s) => s.sid === currentSid);
  const after = cur >= 0 && cur < scenes.length - 1 ? scenes[cur] : null;
  if (!open) {
    return (
      <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
        <button type="button" onClick={() => setOpen(after ? "after" : "end")} className="text-[var(--accent)] hover:underline">
          + Escena nueva {after ? `después de la ${after.number}` : "al final"}
        </button>
        {after && (
          <button type="button" onClick={() => setOpen("end")} className="text-[12px] text-muted hover:text-fg">
            o al final
          </button>
        )}
      </p>
    );
  }
  const where = open === "after" && after ? after : null;
  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        const before = where ? (scenes[cur + 1]?.sid ?? null) : null;
        const sid = addScene(heading.trim() || "INT. LUGAR - DÍA", "", before, undefined);
        const n = where ? where.number + 1 : scenes.length + 1;
        if (sid) {
          goToScene(sid);
          showStoryNotice({ text: `Escena ${n} creada ${where ? `después de la ${where.number}` : "al final"}.` });
        }
        setHeading("");
        setOpen(null);
      }}
    >
      <p className="mb-1 text-[11.5px] text-muted">{where ? `Después de la escena ${where.number}` : "Al final del guion"}</p>
      <div className="flex gap-2">
        <input
          autoFocus
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(null)}
          placeholder="INT. LUGAR - DÍA"
          aria-label="Lugar y hora de la escena nueva"
          className="min-w-0 flex-1 rounded-md border border-[var(--line)] bg-white px-2 py-1.5 font-[family-name:var(--font-courier)] text-[12px] font-bold uppercase outline-none focus:border-[var(--accent)]"
        />
        <button type="submit" className="rounded-md bg-[var(--fg)] px-2.5 text-[12px] text-white">
          Añadir
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ ideas sueltas

function KindTag({ kind, onChange }: { kind: LooseKind; onChange?: (k: LooseKind) => void }) {
  const k = LOOSE_KINDS[kind];
  const tag = (
    <span
      className="inline-block rounded-full px-2 py-px font-[family-name:var(--font-courier)] text-[10px] tracking-[0.14em] uppercase"
      style={{ color: k.tone, background: k.bg }}
    >
      {k.label}
    </span>
  );
  if (!onChange) return tag;
  return (
    <label className="relative inline-block cursor-pointer" title="Cambiar el tipo">
      {tag}
      <select
        aria-label="Tipo de idea"
        value={kind}
        onChange={(e) => isLooseKind(e.target.value) && onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {(Object.keys(LOOSE_KINDS) as LooseKind[]).map((key) => (
          <option key={key} value={key}>
            {LOOSE_KINDS[key].label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LooseIdeasPanel({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { maps, userName, addScene, goToScene, insertNote, currentSid, scenes, openOpenings } = useWorkspace();
  const loose = useYMap<MomentIdea>(maps.loose);
  const [text, setText] = useState("");
  const list = Object.values(loose)
    .filter((l): l is MomentIdea => Boolean(l?.id))
    .sort((a, b) => b.at - a.at);
  const fresh = list.filter((l) => !l.sid);
  const used = list.filter((l) => l.sid);

  const add = () => {
    const t = text.trim();
    if (!t) return;
    const id = referenceId();
    maps.loose.set(id, { id, text: t.slice(0, 1200), kind: guessLooseKind(t), at: Date.now(), by: userName });
    setText("");
  };
  const update = (l: MomentIdea, patch: Partial<MomentIdea>) => maps.loose.set(l.id, { ...l, ...patch });
  // Escena nueva con la idea como nota: por defecto, después de la actual.
  const cur = scenes.findIndex((s) => s.sid === currentSid);
  const after = cur >= 0 && cur < scenes.length - 1 ? scenes[cur] : null;
  const toScene = (l: MomentIdea, where: "after" | "end") => {
    const at = where === "after" ? after : null;
    const sid = addScene("", "", at ? (scenes[cur + 1]?.sid ?? null) : null, l.text);
    if (!sid) return;
    update(l, { sid });
    const n = at ? at.number + 1 : scenes.length + 1;
    showStoryNotice({
      text: `Escena ${n} creada ${at ? `después de la ${at.number}` : "al final"}, con tu idea como nota.`,
      action: {
        label: "Ir",
        run: () => {
          goToScene(sid);
          onNavigate?.();
        },
      },
    });
  };

  return (
    <div className="text-[13px]">
      <p className="text-[12.5px] leading-snug text-muted">
        Apunta lo que ya tienes, en cualquier orden: una imagen, una frase, un momento, un personaje, un final. Luego lo conviertes en escena.
      </p>
      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              add();
            }
          }}
          rows={2}
          placeholder="Apunta algo suelto… (Enter para guardar)"
          aria-label="Idea suelta nueva"
          className="block w-full resize-none rounded-lg border-[1.5px] border-[var(--accent)]/60 bg-white px-3 py-2 text-[13.5px] leading-snug outline-none focus:border-[var(--accent)]"
        />
      </form>

      {fresh.length === 0 && used.length === 0 && (
        <ul className="mt-4 space-y-1.5 text-[12.5px] text-muted">
          <li>
            <KindTag kind="imagen" /> «Una bicicleta roja tirada en la nieve»
          </li>
          <li>
            <KindTag kind="dialogo" /> «—No vuelvas a llamarme hermano.»
          </li>
          <li>
            <KindTag kind="final" /> «Se va en el último tren y no mira atrás»
          </li>
        </ul>
      )}

      <ul className="mt-3 space-y-2">
        {fresh.map((l) => (
          <li key={l.id} className="group rounded-lg bg-white p-2.5 shadow-[0_1px_0_var(--line)]">
            <div className="flex items-center gap-2">
              <KindTag kind={l.kind} onChange={(kind) => update(l, { kind })} />
              {l.beat && momentById(l.beat) && <span className="text-[11px] text-[var(--accent)]">para «{momentById(l.beat)!.plain}»</span>}
              <button
                type="button"
                onClick={() => maps.loose.delete(l.id)}
                aria-label="Borrar la idea"
                className="ml-auto text-[13px] text-muted opacity-0 pointer-coarse:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-danger"
              >
                ×
              </button>
            </div>
            <InlineText
              label="Idea suelta"
              value={l.text}
              onSave={(v) => (v ? update(l, { text: v }) : maps.loose.delete(l.id))}
              placeholder="…"
              className={`mt-1 text-[13px] leading-snug ${l.kind === "dialogo" ? "font-[family-name:var(--font-courier)]" : ""}`}
            />
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
              <button type="button" onClick={() => toScene(l, after ? "after" : "end")} className="font-semibold text-[var(--accent)] hover:underline">
                {after ? `Escena nueva después de la ${after.number} →` : "Escribir como escena →"}
              </button>
              {after && (
                <button type="button" onClick={() => toScene(l, "end")} className="text-muted hover:text-fg">
                  al final
                </button>
              )}
              {currentSid && scenes.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (insertNote(l.text)) update(l, { sid: currentSid });
                  }}
                  className="text-muted hover:text-fg"
                >
                  A la escena {scenes.find((s) => s.sid === currentSid)?.number}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {fresh.length >= 2 && (
        <button type="button" onClick={openOpenings} className="sp-btn mt-4 w-full justify-center">
          ¿Con cuál empiezo? Encontrar el principio
        </button>
      )}

      {used.length > 0 && (
        <details className="mt-5">
          <summary className="sp-label cursor-pointer">Ya usadas · {used.length}</summary>
          <ul className="mt-2 space-y-1.5">
            {used.map((l) => {
              const scene = scenes.find((s) => s.sid === l.sid);
              return (
                <li key={l.id} className="flex items-start gap-2 text-[12.5px] text-muted">
                  <KindTag kind={l.kind} />
                  <span className="min-w-0 flex-1 truncate">{l.text}</span>
                  {scene ? (
                    <button type="button" onClick={() => goToScene(scene.sid)} className="shrink-0 text-[var(--accent)] hover:underline">
                      Esc. {scene.number}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => maps.loose.set(l.id, { id: l.id, text: l.text, kind: l.kind, at: l.at, ...(l.by ? { by: l.by } : {}) })}
                      className="shrink-0 hover:text-fg"
                    >
                      Recuperar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
