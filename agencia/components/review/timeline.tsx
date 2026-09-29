"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui/cx";
import { formatClock, formatTimecode } from "@/lib/domain/timecode";

export type Marker = { id: string; start: number; end: number | null; color: string; internal: boolean; selected: boolean; label: string };

const pct = (ms: number, d: number) => (d > 0 ? Math.max(0, Math.min(100, (ms / d) * 100)) : 0);

export function Timeline({
  durationMs,
  timeMs,
  bufferedMs,
  markers,
  range,
  onRangeChange,
  onSeek,
  onMarker,
  previewSrc,
  fps,
  scrubbing,
}: {
  durationMs: number;
  timeMs: number;
  bufferedMs: number;
  markers: Marker[];
  range: { start: number; end: number } | null;
  onRangeChange?: (r: { start: number; end: number }) => void;
  onSeek: (ms: number) => void;
  onMarker: (id: string) => void;
  previewSrc?: string;
  fps: number | null;
  scrubbing?: (active: boolean) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; ms: number; w: number } | null>(null);
  const drag = useRef<"seek" | "in" | "out" | null>(null);

  const msAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.max(0, Math.min(durationMs, ((clientX - r.left) / r.width) * durationMs));
  };

  const startHandleDrag = (h: "in" | "out") => (e: React.PointerEvent) => {
    e.stopPropagation();
    track.current?.setPointerCapture(e.pointerId);
    drag.current = h;
  };

  const fmt = (ms: number) => (fps ? formatTimecode(ms, fps) : formatClock(ms, true));

  return (
    <div className="relative select-none">
      {/* Marcadores de comentarios */}
      <div className="relative h-4" aria-label="Marcadores de comentarios">
        {markers.map((m) =>
          m.end != null ? (
            <button
              key={m.id}
              type="button"
              title={m.label}
              aria-label={m.label}
              onClick={() => onMarker(m.id)}
              className={cx("absolute top-1 h-2 rounded-full opacity-90 hover:opacity-100", m.selected && "ring-2 ring-white")}
              style={{ left: `${pct(m.start, durationMs)}%`, width: `${Math.max(0.6, pct(m.end, durationMs) - pct(m.start, durationMs))}%`, background: m.color, outline: m.internal ? "1px dashed rgba(255,255,255,.6)" : undefined }}
            />
          ) : (
            <button
              key={m.id}
              type="button"
              title={m.label}
              aria-label={m.label}
              onClick={() => onMarker(m.id)}
              className={cx("absolute top-0.5 size-3 -translate-x-1/2 rounded-full border-2 border-c-bg transition-transform hover:scale-125", m.selected && "scale-125 ring-2 ring-white")}
              style={{ left: `${pct(m.start, durationMs)}%`, background: m.internal ? "transparent" : m.color, borderColor: m.internal ? m.color : undefined }}
            />
          ),
        )}
      </div>
      {/* Pista */}
      <div
        ref={track}
        className="group relative mt-1 h-6 cursor-pointer touch-none"
        role="slider"
        tabIndex={0}
        aria-label="Posición en el vídeo"
        aria-valuemin={0}
        aria-valuemax={Math.round(durationMs / 1000)}
        aria-valuenow={Math.round(timeMs / 1000)}
        aria-valuetext={formatClock(timeMs)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = "seek";
          scrubbing?.(true);
          onSeek(msAt(e.clientX));
        }}
        onPointerMove={(e) => {
          const ms = msAt(e.clientX);
          const r = track.current!.getBoundingClientRect();
          setHover({ x: e.clientX - r.left, ms, w: r.width });
          if (drag.current === "seek") onSeek(ms);
          else if (drag.current === "in" && range && onRangeChange) onRangeChange({ start: Math.min(ms, range.end - 100), end: range.end });
          else if (drag.current === "out" && range && onRangeChange) onRangeChange({ start: range.start, end: Math.max(ms, range.start + 100) });
        }}
        onPointerUp={() => {
          if (drag.current === "seek") scrubbing?.(false);
          drag.current = null;
        }}
        onPointerLeave={() => !drag.current && setHover(null)}
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/12 transition-[height] group-hover:h-1.5">
          <div className="absolute inset-y-0 left-0 bg-white/20" style={{ width: `${pct(bufferedMs, durationMs)}%` }} />
          <div className="absolute inset-y-0 left-0 bg-c-ink" style={{ width: `${pct(timeMs, durationMs)}%` }} />
        </div>
        {range && (
          <>
            <div
              className="pointer-events-none absolute top-1/2 h-3 -translate-y-1/2 rounded-sm bg-marker/30 ring-1 ring-marker"
              style={{ left: `${pct(range.start, durationMs)}%`, width: `${pct(range.end, durationMs) - pct(range.start, durationMs)}%` }}
            />
            {onRangeChange &&
              (["in", "out"] as const).map((h) => (
                <span
                  key={h}
                  role="slider"
                  tabIndex={0}
                  aria-label={h === "in" ? "Inicio del tramo" : "Final del tramo"}
                  aria-valuenow={Math.round((h === "in" ? range.start : range.end) / 1000)}
                  onPointerDown={startHandleDrag(h)}
                  className="absolute top-0 h-6 w-2.5 -translate-x-1/2 cursor-ew-resize rounded-sm bg-marker shadow"
                  style={{ left: `${pct(h === "in" ? range.start : range.end, durationMs)}%` }}
                />
              ))}
          </>
        )}
        <span className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-marker shadow-[0_0_0_3px_rgba(0,0,0,.4)]" style={{ left: `${pct(timeMs, durationMs)}%` }} />
        {hover && (
          <div className="pointer-events-none absolute bottom-8 z-20 -translate-x-1/2" style={{ left: Math.max(70, Math.min(hover.x, hover.w - 70)) }}>
            {previewSrc && <HoverFrame src={previewSrc} ms={hover.ms} />}
            <div className="mx-auto mt-1 w-fit rounded bg-black/85 px-1.5 py-0.5 font-mono text-[11px] text-white">{fmt(hover.ms)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Fotograma de vista previa al pasar por la línea de tiempo (vídeo secundario oculto). */
function HoverFrame({ src, ms }: { src: string; ms: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const busy = useRef(false);
  const pending = useRef<number | null>(null);

  useEffect(() => {
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.crossOrigin = "anonymous";
    v.src = src;
    const draw = () => {
      const c = canvas.current;
      if (c && v.videoWidth) {
        c.height = Math.round((c.width * v.videoHeight) / v.videoWidth);
        c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      }
      busy.current = false;
      if (pending.current !== null) {
        const next = pending.current;
        pending.current = null;
        busy.current = true;
        v.currentTime = next / 1000;
      }
    };
    v.addEventListener("seeked", draw);
    video.current = v;
    return () => {
      v.removeEventListener("seeked", draw);
      v.removeAttribute("src");
      v.load();
    };
  }, [src]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (busy.current) {
      pending.current = ms;
      return;
    }
    busy.current = true;
    v.currentTime = ms / 1000;
  }, [ms]);

  return <canvas ref={canvas} width={160} height={90} className="block w-40 rounded border border-white/20 bg-black shadow-lg" />;
}
