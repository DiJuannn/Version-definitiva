"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { estimateShotMinutes, formatDuration, formatHHMM, type PlanBlock, type PlanShot, type TimedBlock, type TimedShot } from "@/lib/schedule-plan";
import { SceneTag, sceneStripColor } from "@/components/SceneTag";
import { PeopleStack } from "@/components/PersonInitials";
import { SceneChip } from "@/components/ScenePeek";
import type { EditorApi } from "@/components/schedule/ScheduleEditor";

const id = (kind: string, value: string) => `${kind}:${value}`;

// "35′" o "1h15": cabe en la columna estrecha de la fila.
function shortDuration(minutes: number) {
  const m = Math.round(minutes);
  if (m < 60) return `${m}′`;
  return `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
}

// "Bloque A", "Bloque B"… por orden entre los bloques de planos y escenas.
export function blockLabel(blocks: PlanBlock[], blockId: string) {
  const filmed = blocks.filter((b) => b.kind === "SHOTS" || b.kind === "SCENE");
  const i = filmed.findIndex((b) => b.id === blockId);
  return i < 0 ? "" : String.fromCharCode(65 + (i % 26));
}

// Menú ⋯ accesible: se abre con clic o teclado y se cierra al salir.
export function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-line/60 hover:text-fg"
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-8 right-0 z-30 w-64 rounded-lg border border-line bg-bg-raised p-2 text-sm shadow-xl shadow-black/50"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("[data-close]")) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

const MENU_ITEM = "block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-line/60 disabled:opacity-40";
const FIELD = "rounded-md border border-line bg-transparent px-2 py-1 text-sm outline-none focus:border-accent";

function NumberField({ label, value, placeholder, suffix, onSave }: { label: string; value: number | null; placeholder?: string; suffix?: string; onSave: (v: number | null) => void }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  return (
    <label className="flex items-center justify-between gap-2 px-2.5 py-1.5">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-1">
        <input
          value={text}
          inputMode="numeric"
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
          onBlur={() => {
            const v = text === "" ? null : Number(text);
            if (v !== value) onSave(v);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          className={`${FIELD} w-16 font-mono`}
        />
        {suffix && <span className="text-xs text-muted">{suffix}</span>}
      </span>
    </label>
  );
}

function TimeField({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [text, setText] = useState(value ?? "");
  return (
    <label className="flex items-center justify-between gap-2 px-2.5 py-1.5">
      <span className="text-muted">Empieza a las</span>
      <input
        value={text}
        placeholder="a continuación"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const v = text.trim() || null;
          if (v !== value) onSave(v);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        className={`${FIELD} w-28 font-mono`}
      />
    </label>
  );
}

function MoveSelect({ api, current, onPick, label }: { api: EditorApi; current: string; onPick: (v: string) => void; label: string }) {
  return (
    <label className="block px-2.5 py-1.5">
      <span className="text-muted">{label}</span>
      <select
        value=""
        onChange={(e) => e.target.value && onPick(e.target.value)}
        className={`${FIELD} mt-1 w-full bg-bg-raised`}
      >
        <option value="">Elige…</option>
        <optgroup label="Esta jornada">
          {api.blocks
            .filter((b) => b.kind === "SHOTS" && b.id !== current)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.title || `Bloque ${blockLabel(api.blocks, b.id)}`}
              </option>
            ))}
          <option value="new">Bloque nuevo al final</option>
        </optgroup>
        <optgroup label="Otra jornada (bloque nuevo)">
          {api.data.days
            .filter((d) => d.id !== api.dayId)
            .map((d) => (
              <option key={d.id} value={`day:${d.id}`}>
                {d.shortLabel}
              </option>
            ))}
        </optgroup>
        <option value="pool">Por programar (sin día)</option>
      </select>
    </label>
  );
}

// Tarjeta de un plano (en "por programar" y al arrastrar).
export function ShotCard({ shot, note, stacked = false }: { shot: PlanShot; note?: ReactNode; stacked?: boolean }) {
  if (stacked) {
    // En la columna estrecha de "por programar": número arriba, descripción entera debajo.
    return (
      <div className="flex gap-2 px-2.5 py-2 text-[13px]">
        <span className="w-1 shrink-0 self-stretch rounded-full" style={{ background: sceneStripColor(shot.intExt, shot.dayPart) }} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="font-mono">
              {shot.sceneNumber}.{shot.number}
            </span>
            <span className="font-mono text-xs text-muted">{shot.shotSize ?? ""}</span>
            <span className="ml-auto font-mono text-xs text-muted">{formatDuration(estimateShotMinutes(shot))}</span>
          </span>
          <span className="mt-0.5 line-clamp-2 block leading-snug text-fg/85">
            {shot.description || <span className="text-muted">Sin descripción</span>}
          </span>
          {note}
        </span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[4px_2.6rem_2.2rem_minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-2 text-[13px]">
      <span className="h-6 w-1 rounded-full" style={{ background: sceneStripColor(shot.intExt, shot.dayPart) }} />
      <span className="font-mono">
        {shot.sceneNumber}.{shot.number}
      </span>
      <span className="font-mono text-xs text-muted">{shot.shotSize ?? ""}</span>
      <span className="min-w-0 truncate">
        {shot.description || <span className="text-muted">Sin descripción</span>}
        {note}
      </span>
      <span className="font-mono text-xs text-muted">{formatDuration(estimateShotMinutes(shot))}</span>
    </div>
  );
}

function ShotRow({ api, shot, mainSceneId, blockId }: { api: EditorApi; shot: TimedShot; mainSceneId: string | null; blockId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: id("shot", shot.id) });
  const names = shot.characterIds.map((c) => api.data.characters[c]?.name).filter((n): n is string => Boolean(n));
  const scene = api.data.scenes[shot.sceneId];
  const mainLocation = mainSceneId ? api.data.scenes[mainSceneId]?.location : null;
  // Se señala el plano "de fuera": de otra escena que pasa en otro sitio (un
  // inserto de la casa rodado en el faro, por ejemplo).
  const foreign = Boolean(mainSceneId && shot.sceneId !== mainSceneId && scene?.location !== mainLocation);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group/shot grid grid-cols-[4px_2.6rem_2rem_minmax(0,1fr)_2.6rem_1.75rem] items-center gap-2 border-b sm:grid-cols-[1rem_4px_2.75rem_2.3rem_minmax(0,1fr)_auto_3rem_1.75rem] border-line/60 px-2.5 py-1.5 text-[13px] last:border-b-0 ${
        isDragging ? "opacity-30" : ""
      } ${foreign ? "bg-accent/[0.06]" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Arrastrar el plano ${shot.sceneNumber}.${shot.number}`}
        className="hidden cursor-grab touch-none text-[#4a4458] hover:text-muted active:cursor-grabbing sm:block"
      >
        ⋮⋮
      </button>
      <span className="h-6 w-1 rounded-full" style={{ background: sceneStripColor(shot.intExt, shot.dayPart) }} />
      <span className="font-mono">
        {shot.sceneNumber}.{shot.number}
        {shot.done && <span className="ml-0.5 text-success" title="Rodado">✓</span>}
      </span>
      <span className="font-mono text-xs text-muted">{shot.shotSize ?? ""}</span>
      <span className={`min-w-0 line-clamp-2 leading-snug sm:line-clamp-none sm:truncate ${shot.done ? "text-muted line-through decoration-muted/50" : ""}`}>
        {shot.description || <span className="text-muted">Sin descripción</span>}
        {foreign && (
          <span className="ml-2 rounded border border-accent/40 px-1.5 py-px text-xs whitespace-nowrap text-[#d9d0f5] no-underline">
            de la Esc. {scene?.number}
            {scene?.location ? ` · ${scene.location}` : ""}
          </span>
        )}
      </span>
      <span className="hidden sm:block">{names.length > 0 && <PeopleStack names={names} max={3} />}</span>
      <span className="text-right font-mono text-xs text-muted" title={`${formatHHMM(shot.start)}–${formatHHMM(shot.end)}`}>
        {shortDuration(shot.minutes)}
      </span>
      <RowMenu label={`Opciones del plano ${shot.sceneNumber}.${shot.number}`}>
        <p className="px-2.5 pt-1 pb-2 text-xs text-muted">
          Plano {shot.sceneNumber}.{shot.number} · {formatHHMM(shot.start)}–{formatHHMM(shot.end)}
        </p>
        <MoveSelect api={api} current={blockId} label="Mover a" onPick={(v) => api.moveShotTo(shot.id, v)} />
        <button type="button" data-close className={MENU_ITEM} onClick={() => api.nudgeShot(shot.id, -1)}>
          ↑ Subir
        </button>
        <button type="button" data-close className={MENU_ITEM} onClick={() => api.nudgeShot(shot.id, 1)}>
          ↓ Bajar
        </button>
        <NumberField
          label="Minutos de rodaje"
          value={shot.estimatedMin}
          placeholder={String(estimateShotMinutes({ ...shot, estimatedMin: null }))}
          suffix="min"
          onSave={(v) => api.setEstimate(shot.id, v)}
        />
        {shot.done && (
          <button
            type="button"
            data-close
            className={`${MENU_ITEM} text-danger`}
            onClick={() => {
              const note = window.prompt("¿Por qué hay que repetirlo? (opcional)", "");
              if (note !== null) api.retake(shot.id, note || null);
            }}
          >
            Hay que repetirlo
          </button>
        )}
        <button type="button" data-close className={MENU_ITEM} onClick={() => api.moveShotTo(shot.id, "pool")}>
          Quitar de la jornada
        </button>
      </RowMenu>
    </li>
  );
}

function ShotsDrop({ blockId, children, empty }: { blockId: string; children: ReactNode; empty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: id("drop", blockId) });
  return (
    <div ref={setNodeRef} className={`transition-colors ${isOver ? "bg-accent/10" : ""}`}>
      {children}
      {empty && (
        <p className={`m-2 rounded-md border border-dashed px-3 py-3 text-center text-[13px] ${isOver ? "border-accent text-accent" : "border-line text-muted"}`}>
          Arrastra aquí planos de cualquier escena
        </p>
      )}
    </div>
  );
}

function BlockMenu({ api, block, index, total, fixedDuration }: { api: EditorApi; block: TimedBlock; index: number; total: number; fixedDuration: boolean }) {
  return (
    <RowMenu label="Opciones del bloque">
      <TimeField value={block.startTime} onSave={(v) => api.editBlock(block.id, { startTime: v })} />
      {fixedDuration && (
        <NumberField label="Duración" value={block.durationMin} placeholder={String(block.minutes)} suffix="min" onSave={(v) => api.editBlock(block.id, { durationMin: v })} />
      )}
      <button type="button" data-close disabled={index === 0} className={MENU_ITEM} onClick={() => api.nudgeBlock(block.id, -1)}>
        ↑ Subir bloque
      </button>
      <button type="button" data-close disabled={index === total - 1} className={MENU_ITEM} onClick={() => api.nudgeBlock(block.id, 1)}>
        ↓ Bajar bloque
      </button>
      {api.data.days.length > 1 && (
        <label className="block px-2.5 py-1.5">
          <span className="text-muted">Mover el bloque entero a</span>
          <select value="" onChange={(e) => e.target.value && api.moveBlockToDay(block.id, e.target.value)} className={`${FIELD} mt-1 w-full bg-bg-raised`}>
            <option value="">Elige jornada…</option>
            {api.data.days
              .filter((d) => d.id !== api.dayId)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.shortLabel}
                </option>
              ))}
          </select>
        </label>
      )}
      <button
        type="button"
        data-close
        className={`${MENU_ITEM} text-danger`}
        onClick={() => (block.scene ? api.unscheduleScene(block.scene.id) : api.removeBlock(block.id))}
      >
        {block.shots.length > 0 || block.scene ? "Quitar bloque (lo de dentro vuelve a por programar)" : "Quitar"}
      </button>
    </RowMenu>
  );
}

function TitleInput({ value, placeholder, onSave, className = "" }: { value: string | null; placeholder: string; onSave: (v: string | null) => void; className?: string }) {
  const [text, setText] = useState(value ?? "");
  return (
    <input
      value={text}
      placeholder={placeholder}
      aria-label="Nombre del bloque"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const v = text.trim() || null;
        if (v !== value) onSave(v);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      onPointerDown={(e) => e.stopPropagation()}
      className={`min-w-0 rounded-md border border-transparent bg-transparent px-1 py-0.5 outline-none placeholder:text-fg hover:border-line focus:border-accent ${className}`}
    />
  );
}

export function BlockView({ api, block, index, total, letter }: { api: EditorApi; block: TimedBlock; index: number; total: number; letter: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: id("block", block.id) });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label="Arrastrar el bloque"
      className="cursor-grab touch-none px-0.5 text-[#4a4458] hover:text-muted active:cursor-grabbing"
    >
      ⋮⋮
    </button>
  );
  const time = (
    <span className="pt-2 font-mono text-[13px] text-fg/80">
      {formatHHMM(block.start)}
      {block.waitBefore > 0 && <span className="block text-[11px] text-warn">espera {formatDuration(block.waitBefore)}</span>}
    </span>
  );

  if (block.kind === "MEAL" || block.kind === "MOVE" || block.kind === "NOTE") {
    const tone = block.kind === "MEAL" ? "text-warn" : block.kind === "MOVE" ? "text-[#8fb7f2]" : "text-fg/80";
    const icon = block.kind === "MEAL" ? "🍽" : block.kind === "MOVE" ? "⇄" : "✎";
    return (
      <li ref={setNodeRef} style={style} className={`grid grid-cols-[2.75rem_1fr] gap-2 sm:grid-cols-[3.25rem_1fr] sm:gap-3 py-1 ${isDragging ? "opacity-30" : ""}`}>
        {time}
        <div className={`flex items-center gap-2 rounded-lg border border-dashed border-line px-2 py-1 text-sm ${tone}`}>
          {handle}
          <span aria-hidden>{icon}</span>
          <TitleInput
            value={block.title}
            placeholder={block.kind === "MEAL" ? "Comida" : block.kind === "MOVE" ? "Cambio de set" : "Nota"}
            onSave={(v) => api.editBlock(block.id, { title: v })}
            className="flex-1 font-semibold"
          />
          {block.minutes > 0 && <span className="font-mono text-xs text-muted">{formatDuration(block.minutes)}</span>}
          <BlockMenu api={api} block={block} index={index} total={total} fixedDuration />
        </div>
      </li>
    );
  }

  if (block.kind === "SCENE" && block.scene) {
    const scene = api.data.scenes[block.scene.id];
    const names = block.scene.characterIds.map((c) => api.data.characters[c]?.name).filter((n): n is string => Boolean(n));
    return (
      <li ref={setNodeRef} style={style} className={`grid grid-cols-[2.75rem_1fr] gap-2 sm:grid-cols-[3.25rem_1fr] sm:gap-3 py-1.5 ${isDragging ? "opacity-30" : ""}`}>
        {time}
        <div className="rounded-lg border border-l-4 border-line bg-bg" style={{ borderLeftColor: sceneStripColor(block.scene.intExt, block.scene.dayPart) }}>
          <div className="flex flex-wrap items-center gap-2 px-2.5 py-2">
            {handle}
            <span className="text-sm font-bold">
              Bloque {letter} · Escena{" "}
              <SceneChip sceneId={block.scene.id} number={block.scene.number}>
                <span className="font-mono underline decoration-line decoration-dotted underline-offset-4">{block.scene.number}</span>
              </SceneChip>{" "}
              entera
            </span>
            <SceneTag intExt={block.scene.intExt} dayPart={block.scene.dayPart} />
            {scene?.location && <span className="text-sm text-fg/85">{scene.location}</span>}
            <span className="ml-auto flex items-center gap-2">
              {names.length > 0 && <PeopleStack names={names} max={3} />}
              <span className="font-mono text-xs text-muted">{formatDuration(block.minutes)}</span>
              <BlockMenu api={api} block={block} index={index} total={total} fixedDuration />
            </span>
          </div>
          {scene?.description && <p className="px-3 pb-2 text-[13px] text-muted">{scene.description} · sin lista de planos</p>}
        </div>
      </li>
    );
  }

  // Bloque de planos
  const counts = new Map<string, number>();
  for (const s of block.shots) counts.set(s.sceneId, (counts.get(s.sceneId) ?? 0) + 1);
  const mainSceneId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const places = [...new Set(block.shots.map((s) => api.data.scenes[s.sceneId]?.location).filter(Boolean))];
  const looks = [...new Map(block.shots.map((s) => [`${s.intExt}-${s.dayPart}`, s])).values()];
  const done = block.shots.filter((s) => s.done).length;
  return (
    <li ref={setNodeRef} style={style} className={`grid grid-cols-[2.75rem_1fr] gap-2 sm:grid-cols-[3.25rem_1fr] sm:gap-3 py-1.5 ${isDragging ? "opacity-30" : ""}`}>
      {time}
      <div className="min-w-0 rounded-lg border border-line bg-bg">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line/70 px-2 py-1.5">
          {handle}
          <span className="shrink-0 text-sm font-bold">Bloque {letter}</span>
          <TitleInput
            value={block.title}
            placeholder={places.length > 0 ? places.join(" / ") : "ponle nombre"}
            onSave={(v) => api.editBlock(block.id, { title: v })}
            className="min-w-0 flex-1 basis-40 text-sm font-semibold"
          />
          {looks.map((s) => (
            <SceneTag key={`${s.intExt}-${s.dayPart}`} intExt={s.intExt} dayPart={s.dayPart} />
          ))}
          <span className="ml-auto flex items-center gap-2 text-xs text-muted">
            {block.startTime && <span className="rounded bg-line/70 px-1.5 py-0.5 text-fg/80">empieza {block.startTime}</span>}
            {block.shots.length} plano{block.shots.length === 1 ? "" : "s"} · {formatDuration(block.minutes)}
            {done > 0 && <span className="text-success">· {done} ✓</span>}
            <BlockMenu api={api} block={block} index={index} total={total} fixedDuration={false} />
          </span>
        </div>
        <ShotsDrop blockId={block.id} empty={block.shots.length === 0}>
          <SortableContext items={block.shots.map((s) => id("shot", s.id))} strategy={verticalListSortingStrategy}>
            <ul>
              {block.shots.map((shot) => (
                <ShotRow key={shot.id} api={api} shot={shot} mainSceneId={mainSceneId} blockId={block.id} />
              ))}
            </ul>
          </SortableContext>
        </ShotsDrop>
      </div>
    </li>
  );
}
