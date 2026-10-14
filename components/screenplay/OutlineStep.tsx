"use client";

import { useEffect, useRef, useState } from "react";
import { useYMap } from "@/lib/screenplay/use-ymap";
import {
  ACT_TEMPLATES,
  formatEighths,
  storyOrder,
  type ActTemplate,
  type SceneInfo,
  type SceneMeta,
} from "@/lib/screenplay/story";
import { InlineText, updateSceneMeta, useWorkspace } from "@/components/screenplay/workspace";

function actTemplate(structure: Record<string, unknown>): ActTemplate {
  const t = structure.template;
  return t === "five" || t === "free" ? t : "three";
}

// Escenas agrupadas en actos: un acto empieza en la escena marcada.
function groupByAct(scenes: SceneInfo[], acts: Record<string, string>) {
  const groups: { label: string | null; scenes: SceneInfo[] }[] = [];
  for (const s of scenes) {
    const label = acts[s.sid];
    if (label || !groups.length) groups.push({ label: label ?? null, scenes: [] });
    groups[groups.length - 1].scenes.push(s);
  }
  return groups;
}

// Paso 2 · Escaleta: la historia escena a escena, como una lista. Lo que se
// escribe en el guion aparece aquí solo; lo que se añade aquí crea su
// encabezado en el guion. Arrastrar una fila mueve la escena en el guion.
export function OutlineStep() {
  const { maps, scenes } = useWorkspace();
  const meta = useYMap<SceneMeta>(maps.scenes);
  const acts = useYMap<string>(maps.acts);
  const structure = useYMap<unknown>(maps.structure);
  const [order, setOrder] = useState<"screen" | "story">("screen");
  const template = actTemplate(structure);
  const totalEighths = scenes.reduce((n, s) => n + s.eighths, 0);

  return (
    <div className="mx-auto max-w-[1180px] px-5 py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="sp-label">
            Escaleta · {scenes.length} {scenes.length === 1 ? "escena" : "escenas"}
            {totalEighths > 0 && ` · ${formatEighths(totalEighths)} pág.`}
          </p>
          <h1 className="mt-2 text-4xl leading-none font-black tracking-tight">La historia, escena a escena</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <Segmented
            label="Estructura"
            value={template}
            options={(Object.keys(ACT_TEMPLATES) as ActTemplate[]).map((t) => [t, ACT_TEMPLATES[t].label])}
            onChange={(t) => maps.structure.set("template", t)}
          />
          <Segmented
            label="Orden"
            value={order}
            options={[
              ["screen", "Como se ve"],
              ["story", "Como pasa"],
            ]}
            onChange={setOrder}
          />
        </div>
      </div>

      {scenes.length > 0 && <TensionLine scenes={scenes} meta={meta} acts={acts} />}

      {scenes.length === 0 ? (
        <div className="mt-10 max-w-xl">
          <p className="text-[15px] leading-relaxed text-muted">
            Aún no hay escenas. Apunta la primera aquí (o escribe un «INT.» o «EXT.» en el guion y aparecerá sola).
          </p>
          <AddScene beforeSid={null} />
        </div>
      ) : order === "screen" ? (
        <ScreenOrder template={template} acts={acts} meta={meta} />
      ) : (
        <StoryOrder meta={meta} />
      )}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-[var(--line)] bg-[#ebebe7]">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`px-3 py-1.5 transition-colors ${value === v ? "bg-white font-medium text-fg shadow-sm" : "text-muted hover:text-fg"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

// Curva de tensión: una línea fina sobre la lista, alineada con las escenas.
function TensionLine({ scenes, meta, acts }: { scenes: SceneInfo[]; meta: Record<string, SceneMeta>; acts: Record<string, string> }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(1000);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 64;
  const pad = 10;
  const x = (i: number) => (scenes.length === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (scenes.length - 1));
  const y = (v: number) => 8 + (1 - v / 10) * (H - 16);
  const pts = scenes.map((s, i) => ({ s, i, v: meta[s.sid]?.tension }));
  const marked = pts.filter((p) => p.v !== undefined);
  const d = marked.map((p, k) => `${k ? "L" : "M"}${x(p.i)},${y(p.v!)}`).join("");
  return (
    <div ref={box} className="relative mt-8 border-b border-[var(--line)] pb-2">
      <p className="sp-label">
        Tensión {marked.length === 0 && <span className="normal-case tracking-normal">— márcala en cada escena (de 1 a 10)</span>}
      </p>
      <svg width={w} height={H} role="img" aria-label="Curva de tensión por escena" className="block">
        {scenes.map((s, i) =>
          acts[s.sid] ? <line key={s.sid} x1={x(i)} x2={x(i)} y1={0} y2={H} stroke="var(--line)" strokeDasharray="3 3" /> : null,
        )}
        {d && <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />}
        {pts.map((p) => (
          <g key={p.s.sid} onMouseEnter={() => setHover(p.i)} onMouseLeave={() => setHover(null)}>
            <rect x={x(p.i) - 14} y={0} width={28} height={H} fill="transparent" />
            {p.v !== undefined ? (
              <circle cx={x(p.i)} cy={y(p.v)} r={hover === p.i ? 5.5 : 4} fill="var(--accent)" stroke="#f5f5f3" strokeWidth={2} />
            ) : (
              <circle cx={x(p.i)} cy={H - 6} r={2.5} fill="#c8c8cc" />
            )}
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-6 z-10 max-w-[260px] rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[12.5px] shadow-lg"
          style={{ left: Math.min(Math.max(x(hover) - 40, 0), w - 260) }}
        >
          <p className="font-[family-name:var(--font-courier)] font-bold">
            {pts[hover].s.number}. {pts[hover].s.heading}
          </p>
          <p className="mt-0.5 text-muted">{pts[hover].v !== undefined ? `Tensión ${pts[hover].v} de 10` : "Sin marcar"}</p>
        </div>
      )}
    </div>
  );
}

function ScreenOrder({ template, acts, meta }: { template: ActTemplate; acts: Record<string, string>; meta: Record<string, SceneMeta> }) {
  const { scenes, moveScene } = useWorkspace();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const groups = groupByAct(scenes, acts);

  return (
    <div>
      {groups.map((g, gi) => {
        const next = groups[gi + 1]?.scenes[0]?.sid ?? null;
        return (
          <section key={gi} className="mt-9">
            <div className="flex items-baseline gap-3 border-b border-[var(--line)] pb-2">
              <h2 className="text-xl font-black tracking-tight">{g.label ?? (template === "free" ? "Escenas" : "Sin acto")}</h2>
              <span className="text-[12.5px] text-muted">{formatEighths(g.scenes.reduce((n, s) => n + s.eighths, 0))} pág.</span>
            </div>
            <ol>
              {g.scenes.map((s) => {
                const index = scenes.indexOf(s);
                return (
                  <SceneRow
                    key={s.sid}
                    scene={s}
                    meta={meta[s.sid] ?? {}}
                    template={template}
                    actLabel={acts[s.sid]}
                    dragging={dragging === s.sid}
                    dropTarget={over === index && dragging !== null && dragging !== s.sid}
                    onDragStart={() => setDragging(s.sid)}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    onDragOver={() => setOver(index)}
                    onDrop={() => {
                      if (dragging) moveScene(dragging, index);
                      setDragging(null);
                      setOver(null);
                    }}
                    onUp={index > 0 ? () => moveScene(s.sid, index - 1) : undefined}
                    onDown={index < scenes.length - 1 ? () => moveScene(s.sid, index + 2) : undefined}
                  />
                );
              })}
            </ol>
            <AddScene beforeSid={next} label={g.label ? `+ Escena en ${g.label}` : "+ Añadir escena"} />
          </section>
        );
      })}
    </div>
  );
}

function SceneRow({
  scene: s,
  meta: m,
  template,
  actLabel,
  dragging,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onUp,
  onDown,
  storyBadge,
}: {
  scene: SceneInfo;
  meta: SceneMeta;
  template: ActTemplate;
  actLabel?: string;
  dragging: boolean;
  dropTarget: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onUp?: () => void;
  onDown?: () => void;
  storyBadge?: React.ReactNode;
}) {
  const { maps, goToScene, setStep } = useWorkspace();
  const actNames = ACT_TEMPLATES[template].acts;
  // Solo se arrastra desde el asa: así seleccionar texto en la fila sigue funcionando.
  const [armed, setArmed] = useState(false);
  return (
    <li
      draggable={armed}
      onPointerUp={() => setArmed(false)}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={() => {
        setArmed(false);
        onDragEnd();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={`group grid grid-cols-[18px_30px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 sm:grid-cols-[18px_30px_minmax(0,300px)_minmax(0,1fr)] sm:gap-x-4 border-b border-[var(--line)] py-3.5 transition-colors md:grid-cols-[18px_30px_minmax(0,300px)_minmax(0,1fr)_120px_70px] ${
        dragging ? "opacity-40" : ""
      } ${dropTarget ? "shadow-[inset_0_2px_0_var(--accent)]" : "hover:bg-white"}`}
    >
      <span
        aria-hidden
        onPointerDown={() => setArmed(true)}
        className="cursor-grab pt-0.5 text-[#b9b9bd] select-none group-hover:text-muted"
      >
        ⋮⋮
      </span>
      <span className="pt-0.5 font-[family-name:var(--font-courier)] font-bold text-[#a3a3a8]">{s.number}</span>
      <div>
        <button
          type="button"
          onClick={() => {
            setStep("guion");
            goToScene(s.sid);
          }}
          className="text-left font-[family-name:var(--font-courier)] text-[14px] leading-snug font-bold hover:text-[var(--accent)]"
          title="Abrir en el guion"
        >
          {s.heading}
        </button>
        {storyBadge}
      </div>
      <InlineText
        label={`De qué va la escena ${s.number}`}
        value={m.synopsis ?? ""}
        onSave={(v) => updateSceneMeta(maps, s.sid, { synopsis: v })}
        placeholder={s.firstAction ? s.firstAction.slice(0, 110) : "De qué va esta escena…"}
        className="col-start-3 text-[14.5px] leading-snug sm:col-start-auto"
      />
      <div className="col-start-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted sm:col-span-2 md:col-span-1 md:col-start-auto md:block">
        <p className="truncate">{s.present.join(" · ") || "—"}</p>
        <div className="mt-1.5 flex gap-[2px]" role="group" aria-label={`Tensión de la escena ${s.number}`}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
            <button
              key={v}
              type="button"
              aria-label={`Tensión ${v}`}
              aria-pressed={(m.tension ?? 0) >= v}
              onClick={() => updateSceneMeta(maps, s.sid, { tension: m.tension === v ? undefined : v })}
              className={`h-2 w-2.5 rounded-[1px] ${(m.tension ?? 0) >= v ? "bg-[var(--accent)]" : "bg-[#e0e0dc] hover:bg-[#c8c8cc]"}`}
            />
          ))}
        </div>
      </div>
      <div className="hidden text-right text-[12px] text-muted md:block">
        <p>{formatEighths(s.eighths)}</p>
        <div className="mt-1 flex justify-end gap-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {actNames.length > 0 && (
            <select
              aria-label="Empieza un acto en esta escena"
              value={actLabel ?? ""}
              onChange={(e) => (e.target.value ? maps.acts.set(s.sid, e.target.value) : maps.acts.delete(s.sid))}
              className="max-w-[64px] bg-transparent text-[11px] outline-none"
              title="Empezar un acto aquí"
            >
              <option value="">Acto…</option>
              {actNames.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}
          <button type="button" aria-label="Subir" disabled={!onUp} onClick={onUp} className="disabled:opacity-30">
            ↑
          </button>
          <button type="button" aria-label="Bajar" disabled={!onDown} onClick={onDown} className="disabled:opacity-30">
            ↓
          </button>
        </div>
      </div>
    </li>
  );
}

// "Como pasa": el orden cronológico. Las escenas fuera de su sitio son
// saltos en el tiempo (flashbacks, recuerdos, elipsis hacia atrás).
function StoryOrder({ meta }: { meta: Record<string, SceneMeta> }) {
  const { maps, scenes } = useWorkspace();
  const structure = useYMap<unknown>(maps.structure);
  const saved = Array.isArray(structure.storyOrder) ? (structure.storyOrder as string[]) : undefined;
  const story = storyOrder(scenes, saved);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const move = (sid: string, to: number) => {
    const ids = story.map((s) => s.sid).filter((x) => x !== sid);
    ids.splice(Math.max(0, Math.min(to, ids.length)), 0, sid);
    maps.structure.set("storyOrder", ids);
  };
  const jumps = story.filter((s, i) => s.number !== i + 1).length;

  return (
    <section className="mt-9">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--line)] pb-2">
        <h2 className="text-xl font-black tracking-tight">En el orden en que pasa</h2>
        <p className="text-[12.5px] text-muted">
          {jumps ? `${jumps} ${jumps === 1 ? "escena va" : "escenas van"} fuera de orden en pantalla` : "La historia se cuenta en orden"}
          {saved && (
            <>
              {" · "}
              <button type="button" onClick={() => maps.structure.delete("storyOrder")} className="underline hover:text-fg">
                volver al orden de pantalla
              </button>
            </>
          )}
        </p>
      </div>
      <p className="mt-3 max-w-2xl text-[13.5px] text-muted">
        Arrastra para poner las escenas en el orden en que ocurren. El guion no cambia: así ves dónde van los flashbacks y los saltos.
      </p>
      <ol>
        {story.map((s, j) => (
          <SceneRow
            key={s.sid}
            scene={s}
            meta={meta[s.sid] ?? {}}
            template="free"
            dragging={dragging === s.sid}
            dropTarget={over === j && dragging !== null && dragging !== s.sid}
            onDragStart={() => setDragging(s.sid)}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            onDragOver={() => setOver(j)}
            onDrop={() => {
              if (dragging) move(dragging, j);
              setDragging(null);
              setOver(null);
            }}
            onUp={j > 0 ? () => move(s.sid, j - 1) : undefined}
            onDown={j < story.length - 1 ? () => move(s.sid, j + 1) : undefined}
            storyBadge={
              s.number !== j + 1 ? (
                <span className="mt-1 inline-block rounded-full bg-[#ece9f7] px-2 py-0.5 text-[11px] text-[var(--accent)]">
                  Se ve en {s.number}.º lugar · salto
                </span>
              ) : null
            }
          />
        ))}
      </ol>
    </section>
  );
}

function AddScene({ beforeSid, label = "+ Añadir escena" }: { beforeSid: string | null; label?: string }) {
  const { addScene } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [heading, setHeading] = useState("");
  const [synopsis, setSynopsis] = useState("");
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 text-[14px] text-[var(--accent)] hover:underline">
        {label}
      </button>
    );
  }
  return (
    <form
      className="mt-3 grid gap-2 rounded-lg border border-[var(--line)] bg-white p-3 md:grid-cols-[300px_1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!heading.trim()) return;
        addScene(heading.trim(), synopsis.trim(), beforeSid);
        setHeading("");
        setSynopsis("");
        setOpen(false);
      }}
    >
      <input
        autoFocus
        value={heading}
        onChange={(e) => setHeading(e.target.value)}
        placeholder="INT. LUGAR - DÍA"
        aria-label="Encabezado de la escena nueva"
        className="rounded-md border border-[var(--line)] px-3 py-2 font-[family-name:var(--font-courier)] text-sm font-bold uppercase outline-none focus:border-[var(--accent)]"
      />
      <input
        value={synopsis}
        onChange={(e) => setSynopsis(e.target.value)}
        placeholder="De qué va (opcional)"
        aria-label="De qué va la escena nueva"
        className="rounded-md border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-md bg-[var(--fg)] px-3.5 py-2 text-[13px] font-medium text-white">
          Añadir
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-muted">
          Cancelar
        </button>
      </div>
      <p className="text-[12px] text-muted md:col-span-3">Se crea su encabezado en el guion, en este punto de la historia.</p>
    </form>
  );
}
