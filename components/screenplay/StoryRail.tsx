"use client";

import { useMemo, useState, useTransition } from "react";
import { useYMap } from "@/lib/screenplay/use-ymap";
import {
  ACT_TEMPLATES,
  BEATS,
  LOOSE_KINDS,
  formatEighths,
  guessLooseKind,
  isLooseKind,
  referenceId,
  type ActTemplate,
  type BeatKey,
  type LooseIdea,
  type LooseKind,
  type SceneInfo,
  type SceneMeta,
} from "@/lib/screenplay/story";
import { findStructureAction } from "@/lib/actions/screenplay-ai";
import type { BeatProposal } from "@/lib/screenplay-ai";
import { InlineText, updateSceneMeta, useWorkspace, type RailTab } from "@/components/screenplay/workspace";

function actTemplate(structure: Record<string, unknown>): ActTemplate {
  const t = structure.template;
  return t === "five" || t === "free" ? t : "three";
}

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

const beatOf = (key: string) => BEATS.find((b) => b.key === key);

// Columna junto a la página: la Estructura (actos, momentos clave y escenas,
// que se arrastran para reordenar el guion) y las Ideas sueltas.
export function StoryRail({ tab, onTab, onClose }: { tab: RailTab; onTab: (t: RailTab) => void; onClose: () => void }) {
  const { maps } = useWorkspace();
  const loose = useYMap<LooseIdea>(maps.loose);
  const pending = Object.values(loose).filter((l) => l && !l.sid).length;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-[var(--line)] px-3 pt-2">
        {(
          [
            ["estructura", "Estructura"],
            ["ideas", `Ideas sueltas${pending ? ` · ${pending}` : ""}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            aria-pressed={tab === id}
            className={`-mb-px border-b-2 px-2.5 pb-2 text-[13px] transition-colors ${
              tab === id ? "border-[var(--accent)] font-semibold text-fg" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={onClose} aria-label="Cerrar el panel" title="Cerrar el panel" className="ml-auto pb-2 text-[15px] text-muted hover:text-fg">
          ×
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{tab === "estructura" ? <StructurePanel /> : <LooseIdeasPanel />}</div>
    </div>
  );
}

// ------------------------------------------------------------------ estructura

function StructurePanel() {
  const { maps, scenes, currentSid, goToScene, moveScene, pageCount, openOpenings } = useWorkspace();
  const acts = useYMap<string>(maps.acts);
  const beats = useYMap<string>(maps.beats);
  const meta = useYMap<SceneMeta>(maps.scenes);
  const structure = useYMap<unknown>(maps.structure);
  const template = actTemplate(structure);
  const actNames: readonly string[] = ACT_TEMPLATES[template].acts;
  const marked = Object.keys(acts).length > 0;
  const groups = groupByAct(scenes, acts, marked && actNames.length ? actNames[0] : null);

  // Dónde cae cada escena (0..1), por su duración en octavos de página.
  const total = scenes.reduce((n, s) => n + Math.max(1, s.eighths), 0);
  const startOf = useMemo(() => {
    const m = new Map<string, { a: number; b: number }>();
    let acc = 0;
    for (const s of scenes) {
      const w = Math.max(1, s.eighths);
      m.set(s.sid, { a: acc / (total || 1), b: (acc + w) / (total || 1) });
      acc += w;
    }
    return m;
  }, [scenes, total]);

  // Marcar un giro mueve también el comienzo del acto siguiente.
  const setBeat = (key: BeatKey, sid: string | null) => {
    if (!sid) {
      maps.beats.delete(key);
      return;
    }
    maps.beats.set(key, sid);
    if (template !== "three") return;
    const nextAct = key === "turn1" ? "Acto II" : key === "turn2" ? "Acto III" : null;
    if (!nextAct) return;
    const i = scenes.findIndex((s) => s.sid === sid);
    const next = scenes[i + 1];
    for (const [k, v] of Object.entries(acts)) if (v === nextAct) maps.acts.delete(k);
    if (next) maps.acts.set(next.sid, nextAct);
  };

  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);

  if (scenes.length === 0) {
    return (
      <div className="text-[13.5px] leading-relaxed">
        <p className="sp-label">Estructura</p>
        <p className="mt-2 text-muted">Aquí verás tu guion por actos en cuanto escribas la primera escena.</p>
        <ThreeActsPrimer />
        <button type="button" onClick={openOpenings} className="sp-btn mt-4 w-full justify-center">
          ¿Por dónde empiezo?
        </button>
      </div>
    );
  }

  const here = currentSid ? startOf.get(currentSid) : undefined;
  const pageAt = (p: number) =>
    pageCount >= 8 ? `pág. ${Math.max(1, Math.round(p * pageCount))}` : `${Math.round(p * 100)} % de la historia`;

  return (
    <div className="text-[13px]">
      <div className="flex items-baseline justify-between gap-2">
        <p className="sp-label">
          {scenes.length} {scenes.length === 1 ? "escena" : "escenas"}
          {pageCount > 0 && ` · ${pageCount} pág.`}
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

      {/* La película como una barra: actos (por lo que ocupan) y momentos. */}
      {template === "three" && (
        <div className="mt-3">
          <div className="relative h-9">
            <div className="absolute inset-x-0 top-3 flex h-3 overflow-hidden rounded-full bg-[#e7e5df]">
              {marked &&
                groups.map((g, i) => {
                  const a = startOf.get(g.scenes[0].sid)?.a ?? 0;
                  const b = startOf.get(g.scenes[g.scenes.length - 1].sid)?.b ?? 1;
                  return (
                    <span
                      key={i}
                      title={g.label ?? ""}
                      className="h-full border-r-2 border-[#f5f5f3] last:border-r-0"
                      style={{ width: `${(b - a) * 100}%`, background: ["#cfc5ee", "#a08fd0", "#7a66c2"][i % 3] }}
                    />
                  );
                })}
            </div>
            {/* Dónde suelen caer los actos: 25 % y 75 %. */}
            {[0.25, 0.75].map((p) => (
              <span key={p} aria-hidden className="absolute top-2 h-5 border-l border-dashed border-[#9b96a8]" style={{ left: `${p * 100}%` }} />
            ))}
            {BEATS.map((b) => {
              const sid = beats[b.key];
              const pos = sid && startOf.get(sid) ? (startOf.get(sid)!.a + startOf.get(sid)!.b) / 2 : b.at;
              return (
                <button
                  key={b.key}
                  type="button"
                  title={`${b.label}${sid ? "" : " (orientativo)"}`}
                  onClick={() => sid && goToScene(sid)}
                  className={`absolute top-[9px] h-[18px] w-[18px] -translate-x-1/2 rounded-full border-2 ${
                    sid ? "border-[#f5f5f3] bg-[var(--accent)]" : "border-dashed border-[#8b85a0] bg-[#f5f5f3]"
                  }`}
                  style={{ left: `${pos * 100}%` }}
                />
              );
            })}
            {here && (
              <span
                aria-hidden
                className="absolute -top-0.5 -translate-x-1/2 text-[10px] leading-none text-[var(--accent)]"
                style={{ left: `${((here.a + here.b) / 2) * 100}%` }}
              >
                ▼
              </span>
            )}
          </div>
          <div className="flex justify-between text-[10.5px] text-muted">
            <span>Acto I</span>
            <span>Acto II</span>
            <span>Acto III</span>
          </div>
        </div>
      )}

      {/* Momentos clave: marcados o dónde suelen ir. */}
      {template === "three" && (
        <section className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between">
            <h3 className="sp-label">Momentos clave</h3>
            <StructureAi setBeat={setBeat} />
          </div>
          <ul className="mt-2 space-y-1">
            {BEATS.map((b) => {
              const sid = beats[b.key];
              const scene = sid ? scenes.find((s) => s.sid === sid) : undefined;
              return (
                <li key={b.key} className="group rounded-lg px-2 py-1.5 hover:bg-white">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${scene ? "bg-[var(--accent)]" : "border border-dashed border-[#8b85a0]"}`} />
                    <span className="font-semibold" title={b.hint}>
                      {b.label}
                    </span>
                    {scene ? (
                      <button type="button" onClick={() => goToScene(scene.sid)} className="ml-auto truncate font-[family-name:var(--font-courier)] text-[12px] text-[var(--accent)] hover:underline">
                        Esc. {scene.number}
                      </button>
                    ) : (
                      <span className="ml-auto text-[11.5px] text-muted">hacia {pageAt(b.at)}</span>
                    )}
                  </div>
                  <p className="mt-0.5 pl-[18px] text-[12px] leading-snug text-muted">{b.hint}</p>
                  <div className="mt-1 hidden gap-3 pl-[18px] text-[12px] group-focus-within:flex group-hover:flex">
                    {currentSid && currentSid !== sid && (
                      <button type="button" onClick={() => setBeat(b.key, currentSid)} className="text-[var(--accent)] hover:underline">
                        Es la escena {scenes.find((s) => s.sid === currentSid)?.number}
                      </button>
                    )}
                    {sid && (
                      <button type="button" onClick={() => setBeat(b.key, null)} className="text-muted hover:text-fg">
                        Quitar
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {!marked && (
            <p className="mt-2 rounded-lg bg-white p-2.5 text-[12px] leading-snug text-muted">
              Marca el <b className="text-fg">primer</b> y el <b className="text-fg">segundo giro</b>: los actos se colocan solos (el II empieza justo después del primer giro; el III, después del segundo).
            </p>
          )}
        </section>
      )}

      {/* Escenas por acto; se arrastran para reordenar el guion. */}
      <section className="mt-5">
        <h3 className="sp-label">Escenas</h3>
        {groups.map((g, gi) => (
          <div key={gi} className="mt-2.5">
            {(g.label || groups.length > 1) && (
              <p className="flex items-baseline justify-between border-b border-[var(--line)] pb-1 text-[12px] font-bold tracking-wide text-[#5a46a8] uppercase">
                {g.label ?? "Antes del primer acto"}
                <span className="font-normal tracking-normal text-muted normal-case">
                  {formatEighths(g.scenes.reduce((n, s) => n + s.eighths, 0))} pág.
                </span>
              </p>
            )}
            <ol>
              {g.scenes.map((s) => {
                const index = scenes.indexOf(s);
                const beatHere = Object.entries(beats).filter(([, v]) => v === s.sid).map(([k]) => beatOf(k)?.label).filter(Boolean);
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
                    } ${s.sid === currentSid ? "bg-[var(--accent)]/10" : "hover:bg-white"}`}
                  >
                    <div className="flex items-start gap-2">
                      <span aria-hidden className="cursor-grab pt-px text-[#b9b9bd] select-none">
                        ⋮⋮
                      </span>
                      <button type="button" onClick={() => goToScene(s.sid)} className="min-w-0 flex-1 text-left">
                        <span className="flex gap-1.5 font-[family-name:var(--font-courier)] text-[12px] leading-snug font-bold">
                          <span className="text-[var(--accent)]">{s.number}</span>
                          <span className="truncate">{s.heading || "Sin encabezado"}</span>
                        </span>
                        {beatHere.length > 0 && (
                          <span className="mt-0.5 block text-[11px] font-semibold text-[var(--accent)]">● {beatHere.join(" · ")}</span>
                        )}
                      </button>
                      <span className="pt-px text-[11px] text-muted">{formatEighths(s.eighths)}</span>
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
                          className="mt-0.5 hidden bg-transparent text-[11px] text-muted outline-none group-focus-within/s:block group-hover/s:block"
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

function ThreeActsPrimer() {
  return (
    <div className="mt-4 rounded-lg bg-white p-3 text-[12.5px] leading-snug">
      <p className="font-semibold">Tres actos, en corto</p>
      <ol className="mt-1.5 space-y-1 text-muted">
        <li>
          <b className="text-fg">I · Planteamiento</b> (¼): quién, dónde y qué rompe la normalidad.
        </li>
        <li>
          <b className="text-fg">II · Confrontación</b> (½): lo intenta, se complica, todo empeora.
        </li>
        <li>
          <b className="text-fg">III · Resolución</b> (¼): el enfrentamiento final y lo que queda.
        </li>
      </ol>
    </div>
  );
}

// La IA lee lo escrito y propone dónde está cada momento; se acepta uno a uno.
function StructureAi({ setBeat }: { setBeat: (k: BeatKey, sid: string | null) => void }) {
  const { screenplayId, flushSave } = useWorkspace();
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
                <ul className="space-y-2">
                  {result.beats.map((b) => (
                    <li key={b.beat}>
                      <p>
                        <b>{beatOf(b.beat)?.label}</b>
                        {b.scene ? ` · escena ${b.scene}` : " · todavía no está"}
                      </p>
                      <p className="text-muted">{b.why}</p>
                      {b.sid && (
                        <button type="button" onClick={() => setBeat(b.beat, b.sid)} className="mt-0.5 text-[var(--accent)] hover:underline">
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

function AddScene() {
  const { addScene, goToScene } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [heading, setHeading] = useState("");
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 text-[13px] text-[var(--accent)] hover:underline">
        + Añadir escena al final
      </button>
    );
  }
  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const sid = addScene(heading.trim() || "INT. LUGAR - DÍA", "", null);
        if (sid) goToScene(sid);
        setHeading("");
        setOpen(false);
      }}
    >
      <input
        autoFocus
        value={heading}
        onChange={(e) => setHeading(e.target.value)}
        placeholder="INT. LUGAR - DÍA"
        aria-label="Encabezado de la escena nueva"
        className="min-w-0 flex-1 rounded-md border border-[var(--line)] bg-white px-2 py-1.5 font-[family-name:var(--font-courier)] text-[12px] font-bold uppercase outline-none focus:border-[var(--accent)]"
      />
      <button type="submit" className="rounded-md bg-[var(--fg)] px-2.5 text-[12px] text-white">
        Añadir
      </button>
    </form>
  );
}

// ------------------------------------------------------------------ ideas sueltas

function KindTag({ kind, onChange }: { kind: LooseKind; onChange?: (k: LooseKind) => void }) {
  const k = LOOSE_KINDS[kind];
  const tag = (
    <span
      className="inline-block rounded-full px-2 py-px font-[family-name:var(--font-courier)] text-[9.5px] tracking-[0.14em] uppercase"
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

export function LooseIdeasPanel() {
  const { maps, userName, addScene, goToScene, insertNote, currentSid, scenes, openOpenings } = useWorkspace();
  const loose = useYMap<LooseIdea>(maps.loose);
  const [text, setText] = useState("");
  const list = Object.values(loose)
    .filter((l): l is LooseIdea => Boolean(l?.id))
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
  const update = (l: LooseIdea, patch: Partial<LooseIdea>) => maps.loose.set(l.id, { ...l, ...patch });

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
              <button
                type="button"
                onClick={() => maps.loose.delete(l.id)}
                aria-label="Borrar la idea"
                className="ml-auto text-[13px] text-muted opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-danger"
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
              <button
                type="button"
                onClick={() => {
                  const sid = addScene("", "", null, l.text);
                  if (sid) {
                    update(l, { sid });
                    goToScene(sid);
                  }
                }}
                className="font-semibold text-[var(--accent)] hover:underline"
              >
                Escribir como escena →
              </button>
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
