"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Link2, Link2Off, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Tape } from "@/components/ui/chip";
import { cx } from "@/components/ui/cx";
import { VERSION_STATUS } from "@/lib/domain/labels";
import { formatClock, frameCenterSeconds, msToFrame } from "@/lib/domain/timecode";
import { STATUS_COLOR } from "./thread";
import type { Payload } from "./types";

type Side = { p: Payload };

/**
 * Comparación lado a lado. Con "Enlazar" activo, la izquierda manda: play,
 * pausa, búsqueda y pasos por fotograma se aplican a ambas y se corrige la
 * deriva si se separan más de 80 ms. Los comentarios NO se trasladan.
 */
export function CompareRoom({ left, right, versionHrefBase, backHref }: { left: Side; right: Side; versionHrefBase: string; backHref: string }) {
  const router = useRouter();
  const a = useRef<HTMLVideoElement>(null);
  const b = useRef<HTMLVideoElement>(null);
  const [linked, setLinked] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [audio, setAudio] = useState<"left" | "right" | "none">("left");
  const fps = left.p.version.fps ?? 30;

  useEffect(() => {
    const va = a.current;
    const vb = b.current;
    if (!va || !vb) return;
    const onTime = () => {
      setT(va.currentTime * 1000);
      if (linked && Math.abs(vb.currentTime - va.currentTime) > 0.08 && !va.seeking) vb.currentTime = va.currentTime;
    };
    const onMeta = () => setDur(Math.max(va.duration || 0, vb.duration || 0) * 1000);
    const onPlay = () => {
      setPlaying(true);
      if (linked) void vb.play().catch(() => {});
    };
    const onPause = () => {
      setPlaying(false);
      if (linked) vb.pause();
    };
    va.addEventListener("timeupdate", onTime);
    va.addEventListener("seeked", onTime);
    va.addEventListener("loadedmetadata", onMeta);
    vb.addEventListener("loadedmetadata", onMeta);
    va.addEventListener("play", onPlay);
    va.addEventListener("pause", onPause);
    return () => {
      va.removeEventListener("timeupdate", onTime);
      va.removeEventListener("seeked", onTime);
      va.removeEventListener("loadedmetadata", onMeta);
      vb.removeEventListener("loadedmetadata", onMeta);
      va.removeEventListener("play", onPlay);
      va.removeEventListener("pause", onPause);
    };
  }, [linked]);

  useEffect(() => {
    if (a.current) a.current.muted = audio !== "left";
    if (b.current) b.current.muted = audio !== "right";
  }, [audio]);

  const seek = (ms: number) => {
    if (a.current) a.current.currentTime = ms / 1000;
    if (linked && b.current) b.current.currentTime = ms / 1000;
  };
  const step = (n: number) => {
    a.current?.pause();
    b.current?.pause();
    const f = msToFrame(t, fps) + n;
    seek(frameCenterSeconds(Math.max(0, f), fps) * 1000);
  };
  const toggle = () => {
    const va = a.current;
    if (!va) return;
    if (va.paused) void va.play().catch(() => {});
    else va.pause();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pane = (s: Side, ref: React.RefObject<HTMLVideoElement | null>, which: "left" | "right") => (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-c-line px-3 py-2">
        <Tape variant={s.p.version.id === s.p.piece.approvedVersionId ? "marker" : "dark"}>V{s.p.version.number}</Tape>
        <span className="text-[12px] text-c-ink-2">{VERSION_STATUS[s.p.version.status].label}</span>
        <select
          aria-label={`Versión del lado ${which === "left" ? "izquierdo" : "derecho"}`}
          value={s.p.version.id}
          onChange={(e) => {
            const other = which === "left" ? right.p.version.id : left.p.version.id;
            const [l, r] = which === "left" ? [e.target.value, other] : [other, e.target.value];
            router.push(`${versionHrefBase}${l}/comparar?con=${r}`);
          }}
          className="ml-auto h-7 rounded border border-c-line bg-c-bg px-1.5 text-[12px] text-c-ink-2"
        >
          {s.p.versions.map((v) => (
            <option key={v.id} value={v.id}>V{v.number}</option>
          ))}
        </select>
        <button type="button" onClick={() => setAudio(audio === which ? "none" : which)} aria-label={audio === which ? "Silenciar este lado" : "Escuchar este lado"} className="rounded p-1 text-c-ink-2 hover:bg-white/10">
          {audio === which ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
      </div>
      <div className="relative min-h-0 flex-1 bg-black">
        {s.p.media?.url ? (
          <video ref={ref} src={s.p.media.url} className="absolute inset-0 size-full object-contain" playsInline preload="auto" muted={which === "right"} />
        ) : (
          <p className="absolute inset-0 grid place-items-center text-sm text-c-ink-3">Sin archivo reproducible</p>
        )}
      </div>
      <div className="relative h-3 bg-c-panel">
        {s.p.comments
          .filter((c) => !c.parentId && c.timeMs != null && !c.deleted)
          .map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.body.slice(0, 80)}
              onClick={() => seek(c.timeMs!)}
              className="absolute top-0.5 size-2 -translate-x-1/2 rounded-full"
              style={{ left: `${dur ? (c.timeMs! / dur) * 100 : 0}%`, background: c.correction ? STATUS_COLOR[c.correction.status] : "#A6ADB8" }}
            />
          ))}
      </div>
    </div>
  );

  return (
    <div className="cine fixed inset-0 flex flex-col bg-c-bg text-c-ink">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-c-line px-3">
        <Link href={backHref} className="inline-flex items-center gap-1 rounded-md py-1 pr-2 pl-1 text-[13px] text-c-ink-2 hover:bg-white/8 hover:text-c-ink">
          <ChevronLeft className="size-4" /> {left.p.piece.title}
        </Link>
        <span className="text-[13px] text-c-ink-3">Comparar versiones</span>
        <button
          type="button"
          onClick={() => setLinked((l) => !l)}
          aria-pressed={linked}
          className={cx("ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px]", linked ? "bg-marker text-ink" : "text-c-ink-2 hover:bg-white/10")}
        >
          {linked ? <Link2 className="size-4" /> : <Link2Off className="size-4" />} {linked ? "Reproducción enlazada" : "Independientes"}
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row md:divide-x md:divide-c-line">
        {pane(left, a, "left")}
        {pane(right, b, "right")}
      </div>
      <div className="flex shrink-0 flex-col gap-1 border-t border-c-line bg-c-panel px-3 py-2">
        <input
          type="range"
          min={0}
          max={dur || 1}
          step={1}
          value={t}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Posición (lado izquierdo manda)"
          className="w-full accent-[var(--marker)]"
        />
        <div className="flex items-center gap-1">
          <button type="button" onClick={toggle} aria-label={playing ? "Pausa" : "Reproducir"} className="grid size-8 place-items-center rounded-md hover:bg-white/10">
            {playing ? <Pause className="size-[18px]" /> : <Play className="size-[18px]" />}
          </button>
          <button type="button" onClick={() => step(-1)} aria-label="Fotograma anterior" className="grid size-8 place-items-center rounded-md hover:bg-white/10">
            <ChevronLeft className="size-[18px]" />
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Fotograma siguiente" className="grid size-8 place-items-center rounded-md hover:bg-white/10">
            <ChevronRight className="size-[18px]" />
          </button>
          <span className="ml-2 font-mono text-[12px] text-c-ink-2 tabular">
            {formatClock(t, true)} / {formatClock(dur, true)}
          </span>
          <span className="ml-auto text-[11px] text-c-ink-3">Los comentarios de cada versión se muestran en su propia línea; no se copian entre versiones.</span>
        </div>
      </div>
    </div>
  );
}
