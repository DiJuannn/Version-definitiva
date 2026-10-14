"use client";

import { useEffect, useRef, useState } from "react";
import { useYMap } from "@/lib/screenplay/use-ymap";
import { storyOrder, type SceneMeta } from "@/lib/screenplay/story";
import { SectionLabel, useWorkspace } from "@/components/screenplay/workspace";

const CHIP = 132; // ancho de cada escena en la línea temporal (px)
const GAP = 12;
const PITCH = CHIP + GAP;

// Curva de tensión (la marca el guionista en el corcho) y la doble línea
// temporal: orden en pantalla arriba, orden en la historia abajo. Las líneas
// que se cruzan son saltos en el tiempo (flashbacks, elipsis hacia atrás…).
export function TimeView() {
  const { maps, scenes, goToScene, setView } = useWorkspace();
  const meta = useYMap<SceneMeta>(maps.scenes);
  const acts = useYMap<string>(maps.acts);
  const structure = useYMap<unknown>(maps.structure);
  const saved = Array.isArray(structure.storyOrder) ? (structure.storyOrder as string[]) : undefined;
  const story = storyOrder(scenes, saved);
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const hasScenes = scenes.length > 0;
  const [boxWidth, setBoxWidth] = useState(900);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasScenes]); // el contenedor aparece con la primera escena

  if (!scenes.length) {
    return <p className="max-w-md py-16 font-sans text-sm text-muted">Escribe alguna escena para ver su ritmo y su tiempo.</p>;
  }

  const setStory = (list: string[]) => maps.structure.set("storyOrder", list);
  const moveInStory = (sid: string, to: number) => {
    const ids = story.map((s) => s.sid).filter((x) => x !== sid);
    ids.splice(Math.max(0, Math.min(to, ids.length)), 0, sid);
    setStory(ids);
  };

  // ------------------------------------------------ curva de tensión
  const W = Math.max(boxWidth, scenes.length * 44);
  const H = 220;
  const pad = { l: 36, r: 24, t: 28, b: 36 };
  const x = (i: number) => pad.l + (scenes.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (scenes.length - 1));
  const y = (v: number) => pad.t + (1 - v / 10) * (H - pad.t - pad.b);
  const points = scenes.map((s, i) => ({ s, i, v: meta[s.sid]?.tension }));
  const segments: string[] = [];
  let current = "";
  for (const p of points) {
    if (p.v === undefined) {
      if (current) segments.push(current);
      current = "";
    } else current += `${current ? "L" : "M"}${x(p.i)},${y(p.v)}`;
  }
  if (current) segments.push(current);
  const marked = points.filter((p) => p.v !== undefined).length;
  const hovered = hover !== null ? points[hover] : null;

  // ------------------------------------------------ doble línea temporal
  const storyIndex = new Map(story.map((s, i) => [s.sid, i]));
  const TW = scenes.length * PITCH;
  const jumps = scenes.filter((s, i) => storyIndex.get(s.sid) !== i).length;

  return (
    <div className="space-y-14">
      <section>
        <SectionLabel right={<span className="font-mono text-[10px] text-muted">{marked} de {scenes.length} escenas marcadas · se marca en el corcho</span>}>
          Curva de tensión
        </SectionLabel>
        <div ref={box} className="relative mt-4 overflow-x-auto">
          <svg width={W} height={H} role="img" aria-label="Tensión por escena" className="block">
            {[0, 5, 10].map((v) => (
              <g key={v}>
                <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
                <text x={pad.l - 10} y={y(v) + 3} textAnchor="end" className="fill-muted font-mono text-[10px]">
                  {v}
                </text>
              </g>
            ))}
            {scenes.map((s, i) =>
              acts[s.sid] ? (
                <g key={`act-${s.sid}`}>
                  <line x1={x(i) - 8} x2={x(i) - 8} y1={pad.t - 12} y2={H - pad.b} stroke="var(--muted)" strokeDasharray="3 4" strokeWidth={1} />
                  <text
                    x={x(i) > W - 90 ? x(i) - 12 : x(i) - 4}
                    y={pad.t - 6}
                    textAnchor={x(i) > W - 90 ? "end" : "start"}
                    className="fill-fg font-mono text-[10px] uppercase"
                  >
                    {acts[s.sid]}
                  </text>
                </g>
              ) : null,
            )}
            {segments.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {points.map((p) => (
              <g key={p.s.sid}>
                {p.v !== undefined && (
                  <circle cx={x(p.i)} cy={y(p.v)} r={hover === p.i ? 5.5 : 4} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2} />
                )}
                <text x={x(p.i)} y={H - pad.b + 18} textAnchor="middle" className="fill-muted font-mono text-[10px]">
                  {p.s.number}
                </text>
                <rect
                  x={x(p.i) - 20}
                  y={pad.t - 12}
                  width={40}
                  height={H - pad.t - pad.b + 34}
                  fill="transparent"
                  onMouseEnter={() => setHover(p.i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => {
                    setView("page");
                    goToScene(p.s.sid);
                  }}
                  className="cursor-pointer"
                />
              </g>
            ))}
            {hovered && <line x1={x(hovered.i)} x2={x(hovered.i)} y1={pad.t} y2={H - pad.b} stroke="var(--muted)" strokeWidth={1} pointerEvents="none" />}
          </svg>
          {hovered && (
            <div
              className="pointer-events-none absolute top-0 max-w-[240px] border border-line bg-bg px-3 py-2 font-mono text-[11px] shadow-2xl"
              style={{ left: Math.min(x(hovered.i) + 12, W - 250) }}
            >
              <p className="text-fg">
                {hovered.s.number}. {hovered.s.heading}
              </p>
              <p className="mt-1 text-muted">{hovered.v !== undefined ? `Tensión ${hovered.v} de 10` : "Sin marcar"}</p>
              {meta[hovered.s.sid]?.synopsis && <p className="mt-1 font-sans text-fg/80">{meta[hovered.s.sid]?.synopsis}</p>}
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionLabel
          right={
            <span className="font-mono text-[10px] text-muted">
              {jumps ? `${jumps} ${jumps === 1 ? "escena fuera" : "escenas fuera"} de orden cronológico` : "Historia lineal"} ·{" "}
              {saved && (
                <button type="button" className="underline hover:text-fg" onClick={() => maps.structure.delete("storyOrder")}>
                  restablecer
                </button>
              )}
            </span>
          }
        >
          En pantalla / en la historia
        </SectionLabel>
        <p className="mt-3 max-w-2xl font-sans text-[13px] text-muted">
          Arriba, el orden en que se ve. Abajo, el orden en que pasa: arrastra las escenas de abajo para colocar flashbacks, recuerdos o
          saltos. Las líneas que se cruzan son saltos en el tiempo.
        </p>
        <div className="mt-6 overflow-x-auto pb-4">
          <div style={{ width: TW }}>
            <Row label="En pantalla">
              {scenes.map((s) => (
                <Chip key={s.sid} number={s.number} heading={s.heading} />
              ))}
            </Row>
            <svg width={TW} height={72} aria-hidden className="block">
              {scenes.map((s, i) => {
                const j = storyIndex.get(s.sid) ?? i;
                const x1 = i * PITCH + CHIP / 2;
                const x2 = j * PITCH + CHIP / 2;
                const jump = i !== j;
                return (
                  <path
                    key={s.sid}
                    d={`M${x1},0 C${x1},36 ${x2},36 ${x2},72`}
                    fill="none"
                    stroke={jump ? "var(--accent)" : "var(--line)"}
                    strokeWidth={jump ? 2 : 1}
                  />
                );
              })}
            </svg>
            <Row label="En la historia">
              {story.map((s, j) => (
                <div
                  key={s.sid}
                  draggable
                  onDragStart={() => setDragging(s.sid)}
                  onDragEnd={() => setDragging(null)}
                  onDragOver={(e) => dragging && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragging) moveInStory(dragging, j);
                    setDragging(null);
                  }}
                  className={dragging === s.sid ? "opacity-40" : ""}
                >
                  <Chip number={s.number} heading={s.heading} movable>
                    <span className="flex gap-2">
                      <button type="button" aria-label="Antes en la historia" disabled={j === 0} onClick={() => moveInStory(s.sid, j - 1)} className="disabled:opacity-30">
                        ←
                      </button>
                      <button
                        type="button"
                        aria-label="Después en la historia"
                        disabled={j === story.length - 1}
                        onClick={() => moveInStory(s.sid, j + 1)}
                        className="disabled:opacity-30"
                      >
                        →
                      </button>
                    </span>
                  </Chip>
                </div>
              ))}
            </Row>
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] tracking-widest text-muted uppercase">{label}</p>
      <div className="flex" style={{ gap: GAP }}>
        {children}
      </div>
    </div>
  );
}

function Chip({ number, heading, movable, children }: { number: number; heading: string; movable?: boolean; children?: React.ReactNode }) {
  return (
    <div
      className={`flex h-[74px] flex-col justify-between border-t-2 border-accent/70 bg-white/[0.04] px-2.5 py-2 ${movable ? "cursor-grab" : ""}`}
      style={{ width: CHIP }}
      title={heading}
    >
      <span className="line-clamp-2 font-[family-name:var(--font-courier)] text-[11px] leading-tight font-bold uppercase">
        <span className="text-accent">{number}</span> {heading}
      </span>
      {children && <span className="font-mono text-[11px] text-muted">{children}</span>}
    </div>
  );
}
