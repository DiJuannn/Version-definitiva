"use client";

import { useState } from "react";
import {
  ArrowUpRight, ChevronLeft, ChevronRight, Circle, Eraser, Expand, Maximize, Minimize, MousePointer2, Pause, PenLine, Play,
  Redo2, Repeat, RectangleHorizontal, Undo2, Volume2, VolumeX, ZoomIn,
} from "lucide-react";
import { ANNOTATION_COLORS } from "@/lib/domain/annotation";
import { cx } from "@/components/ui/cx";
import type { Player } from "./use-player";
import type { Tool } from "./annotation";

const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

function IconBtn({ label, onClick, children, active, disabled, kbd }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean; disabled?: boolean; kbd?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={kbd ? `${label} (${kbd})` : label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cx("grid size-8 place-items-center rounded-md transition-colors disabled:opacity-40", active ? "bg-white/15 text-marker" : "text-c-ink-2 hover:bg-white/10 hover:text-c-ink")}
    >
      {children}
    </button>
  );
}

export function Controls({
  player,
  fmt,
  showFrames,
  setShowFrames,
  frameApprox,
  loopOn,
  onToggleLoop,
  canLoop,
  zoom,
  setZoom,
  fullscreen,
  onFullscreen,
  focus,
  onFocus,
}: {
  player: Player;
  fmt: (ms: number) => string;
  showFrames: boolean;
  setShowFrames: (v: boolean) => void;
  frameApprox: boolean;
  loopOn: boolean;
  onToggleLoop: () => void;
  canLoop: boolean;
  zoom: number;
  setZoom: (z: number) => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  focus: boolean;
  onFocus: () => void;
}) {
  const s = player.state;
  const [rateOpen, setRateOpen] = useState(false);
  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      <IconBtn label={s.playing ? "Pausa" : "Reproducir"} kbd="Espacio / K" onClick={player.toggle}>
        {s.playing ? <Pause className="size-[18px]" /> : <Play className="size-[18px]" />}
      </IconBtn>
      <IconBtn label={frameApprox ? "Fotograma anterior (aprox.)" : "Fotograma anterior"} kbd="←" onClick={() => player.step(-1)}>
        <ChevronLeft className="size-[18px]" />
      </IconBtn>
      <IconBtn label={frameApprox ? "Fotograma siguiente (aprox.)" : "Fotograma siguiente"} kbd="→" onClick={() => player.step(1)}>
        <ChevronRight className="size-[18px]" />
      </IconBtn>
      <button
        type="button"
        onClick={() => setShowFrames(!showFrames)}
        title="Cambiar formato de tiempo"
        className="ml-1 rounded px-1.5 py-1 font-mono text-[11px] whitespace-nowrap text-c-ink tabular hover:bg-white/10 sm:text-[12px]"
      >
        {fmt(s.timeMs)} <span className="text-c-ink-3">/ {fmt(s.durationMs)}</span>
        {showFrames && <span className="ml-1 text-c-ink-3">{frameApprox ? `≈F${player.frame}` : `F${player.frame}`}</span>}
      </button>
      <div className="ml-auto flex items-center gap-1">
        <span className="hidden sm:contents">
          <IconBtn label="Repetir tramo" kbd="R" active={loopOn} disabled={!canLoop} onClick={onToggleLoop}>
            <Repeat className="size-4" />
          </IconBtn>
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setRateOpen((o) => !o)}
            aria-label="Velocidad de reproducción"
            aria-expanded={rateOpen}
            className="h-8 rounded-md px-2 font-mono text-[12px] text-c-ink-2 hover:bg-white/10 hover:text-c-ink"
          >
            {s.rate}×
          </button>
          {rateOpen && (
            <ul className="absolute right-0 bottom-9 z-30 w-20 overflow-hidden rounded-md border border-c-line bg-c-panel-2 py-1 shadow-xl" onMouseLeave={() => setRateOpen(false)}>
              {RATES.map((r) => (
                <li key={r}>
                  <button type="button" onClick={() => { player.setRate(r); setRateOpen(false); }} className={cx("w-full px-3 py-1 text-left font-mono text-[12px] hover:bg-white/10", r === s.rate ? "text-marker" : "text-c-ink-2")}>
                    {r}×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="group/vol hidden items-center sm:flex">
          <IconBtn label={s.muted ? "Activar sonido" : "Silenciar"} kbd="M" onClick={player.toggleMute}>
            {s.muted || s.volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </IconBtn>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.muted ? 0 : s.volume}
            onChange={(e) => player.setVolume(Number(e.target.value))}
            aria-label="Volumen"
            className="hidden w-20 accent-[var(--marker)] sm:block"
          />
        </div>
        <button
          type="button"
          onClick={() => setZoom(zoom === 1 ? 1.5 : zoom === 1.5 ? 2 : zoom === 2 ? 3 : 1)}
          title="Zoom (Z). Arrastra para desplazar cuando haya zoom."
          aria-label={`Zoom ${Math.round(zoom * 100)} %`}
          className={cx("hidden h-8 items-center gap-1 rounded-md px-2 text-[12px] sm:inline-flex", zoom > 1 ? "bg-white/15 text-marker" : "text-c-ink-2 hover:bg-white/10")}
        >
          <ZoomIn className="size-4" /> {zoom === 1 ? "Ajustar" : `${Math.round(zoom * 100)}%`}
        </button>
        <span className="hidden lg:contents">
          <IconBtn label={focus ? "Salir del modo enfoque" : "Modo enfoque"} kbd="Shift+F" active={focus} onClick={onFocus}>
            <Expand className="size-4" />
          </IconBtn>
        </span>
        <IconBtn label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"} kbd="F" onClick={onFullscreen}>
          {fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
        </IconBtn>
      </div>
    </div>
  );
}

const TOOLS: { t: Tool; label: string; Icon: typeof PenLine }[] = [
  { t: "point", label: "Señalar punto", Icon: MousePointer2 },
  { t: "arrow", label: "Flecha", Icon: ArrowUpRight },
  { t: "rect", label: "Rectángulo", Icon: RectangleHorizontal },
  { t: "ellipse", label: "Elipse", Icon: Circle },
  { t: "pen", label: "Mano alzada", Icon: PenLine },
];

export function DrawToolbar({
  tool,
  setTool,
  color,
  setColor,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onDone,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  color: string;
  setColor: (c: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onDone: () => void;
}) {
  return (
    <div role="toolbar" aria-label="Herramientas de dibujo" className="flex items-center gap-1 rounded-lg border border-c-line bg-c-panel/95 p-1 shadow-2xl backdrop-blur">
      {TOOLS.map(({ t, label, Icon }) => (
        <IconBtn key={t} label={label} active={tool === t} onClick={() => setTool(t)}>
          <Icon className="size-4" />
        </IconBtn>
      ))}
      <span className="mx-1 h-5 w-px bg-c-line" />
      {ANNOTATION_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Color ${c}`}
          aria-pressed={color === c}
          onClick={() => setColor(c)}
          className={cx("grid size-7 place-items-center rounded-md", color === c && "bg-white/15")}
        >
          <span className="size-4 rounded-full ring-1 ring-black/40" style={{ background: c }} />
        </button>
      ))}
      <span className="mx-1 h-5 w-px bg-c-line" />
      <IconBtn label="Deshacer" kbd="Ctrl+Z" disabled={!canUndo} onClick={onUndo}>
        <Undo2 className="size-4" />
      </IconBtn>
      <IconBtn label="Rehacer" kbd="Ctrl+Shift+Z" disabled={!canRedo} onClick={onRedo}>
        <Redo2 className="size-4" />
      </IconBtn>
      <IconBtn label="Borrar dibujo" disabled={!canUndo} onClick={onClear}>
        <Eraser className="size-4" />
      </IconBtn>
      <button type="button" onClick={onDone} className="ml-1 h-8 rounded-md bg-marker px-2.5 text-[12px] font-semibold text-ink">
        Listo
      </button>
    </div>
  );
}
