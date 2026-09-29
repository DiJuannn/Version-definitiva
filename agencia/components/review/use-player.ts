"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { frameCenterSeconds, msToFrame } from "@/lib/domain/timecode";

export type LoopRange = { start: number; end: number } | null;

export type PlayerState = {
  timeMs: number;
  durationMs: number;
  playing: boolean;
  rate: number;
  volume: number;
  muted: boolean;
  bufferedMs: number;
  status: "loading" | "ready" | "error" | "stalled";
  error: string | null;
  videoWidth: number;
  videoHeight: number;
};

/**
 * Motor del reproductor sobre <video>. Usa requestVideoFrameCallback cuando
 * existe (tiempo del fotograma presentado) y cae a timeupdate si no.
 * `fps` null => paso "por fotograma" aproximado a 1/30 s.
 */
export function usePlayer(fps: number | null, initialDurationMs: number | null) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [s, setS] = useState<PlayerState>({
    timeMs: 0,
    durationMs: initialDurationMs ?? 0,
    playing: false,
    rate: 1,
    volume: 1,
    muted: false,
    bufferedMs: 0,
    status: "loading",
    error: null,
    videoWidth: 0,
    videoHeight: 0,
  });
  const loopRef = useRef<LoopRange>(null);
  const [loop, setLoopState] = useState<LoopRange>(null);
  const stepFps = fps ?? 30;

  const setLoop = useCallback((r: LoopRange) => {
    loopRef.current = r;
    setLoopState(r);
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let frameHandle = 0;
    const hasRvfc = "requestVideoFrameCallback" in HTMLVideoElement.prototype;
    const update = (mediaTime?: number) => {
      const t = (mediaTime ?? v.currentTime) * 1000;
      const lr = loopRef.current;
      if (lr && !v.paused && t >= lr.end) {
        v.currentTime = lr.start / 1000;
      }
      let buffered = 0;
      for (let i = 0; i < v.buffered.length; i++) {
        if (v.buffered.start(i) <= v.currentTime + 0.1) buffered = Math.max(buffered, v.buffered.end(i) * 1000);
      }
      setS((p) => (Math.abs(p.timeMs - t) < 0.5 && p.bufferedMs === buffered ? p : { ...p, timeMs: t, bufferedMs: buffered }));
    };
    const onFrame = (_: number, meta: { mediaTime: number }) => {
      update(meta.mediaTime);
      frameHandle = (v as HTMLVideoElement & { requestVideoFrameCallback: (cb: typeof onFrame) => number }).requestVideoFrameCallback(onFrame);
    };
    if (hasRvfc) frameHandle = (v as HTMLVideoElement & { requestVideoFrameCallback: (cb: typeof onFrame) => number }).requestVideoFrameCallback(onFrame);

    const onMeta = () => {
      const d = Number.isFinite(v.duration) ? v.duration * 1000 : initialDurationMs ?? 0;
      setS((p) => ({ ...p, durationMs: d, videoWidth: v.videoWidth, videoHeight: v.videoHeight, status: "ready", error: null }));
    };
    const onPlay = () => setS((p) => ({ ...p, playing: true }));
    const onPause = () => setS((p) => ({ ...p, playing: false }));
    const onWaiting = () => setS((p) => ({ ...p, status: "stalled" }));
    const onPlaying = () => setS((p) => ({ ...p, status: "ready" }));
    const onTime = () => update();
    const onVolume = () => setS((p) => ({ ...p, volume: v.volume, muted: v.muted }));
    const onRate = () => setS((p) => ({ ...p, rate: v.playbackRate }));
    const onError = () =>
      setS((p) => ({ ...p, status: "error", error: v.error?.code === 4 ? "El navegador no puede reproducir este archivo." : "No se pudo cargar el vídeo." }));
    const onEnded = () => {
      const lr = loopRef.current;
      if (lr) {
        v.currentTime = lr.start / 1000;
        void v.play();
      }
    };
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("durationchange", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("canplay", onPlaying);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeked", onTime);
    v.addEventListener("progress", onTime);
    v.addEventListener("volumechange", onVolume);
    v.addEventListener("ratechange", onRate);
    v.addEventListener("error", onError);
    v.addEventListener("ended", onEnded);
    if (v.readyState >= 1) onMeta();
    return () => {
      if (hasRvfc && frameHandle) (v as HTMLVideoElement & { cancelVideoFrameCallback: (h: number) => void }).cancelVideoFrameCallback(frameHandle);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("durationchange", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("canplay", onPlaying);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeked", onTime);
      v.removeEventListener("progress", onTime);
      v.removeEventListener("volumechange", onVolume);
      v.removeEventListener("ratechange", onRate);
      v.removeEventListener("error", onError);
      v.removeEventListener("ended", onEnded);
    };
  }, [initialDurationMs]);

  const api = {
    ref,
    state: s,
    loop,
    setLoop,
    play: () => void ref.current?.play().catch(() => {}),
    pause: () => ref.current?.pause(),
    toggle: () => {
      const v = ref.current;
      if (!v) return;
      if (v.paused) void v.play().catch(() => {});
      else v.pause();
    },
    seek: (ms: number) => {
      const v = ref.current;
      if (!v) return;
      const max = (Number.isFinite(v.duration) ? v.duration : s.durationMs / 1000) || 0;
      v.currentTime = Math.max(0, Math.min(max, ms / 1000));
      setS((p) => ({ ...p, timeMs: v.currentTime * 1000 }));
    },
    /** Avanza/retrocede n fotogramas. Se sitúa en el centro del fotograma destino. */
    step: (n: number) => {
      const v = ref.current;
      if (!v) return;
      v.pause();
      const frame = msToFrame(v.currentTime * 1000, stepFps) + n;
      const max = Number.isFinite(v.duration) ? v.duration : Infinity;
      v.currentTime = Math.max(0, Math.min(max, frameCenterSeconds(Math.max(0, frame), stepFps)));
    },
    jump: (deltaMs: number) => {
      const v = ref.current;
      if (!v) return;
      v.currentTime = Math.max(0, v.currentTime + deltaMs / 1000);
    },
    setRate: (r: number) => {
      if (ref.current) ref.current.playbackRate = r;
    },
    setVolume: (vol: number) => {
      if (!ref.current) return;
      ref.current.volume = Math.max(0, Math.min(1, vol));
      if (vol > 0) ref.current.muted = false;
    },
    toggleMute: () => {
      if (ref.current) ref.current.muted = !ref.current.muted;
    },
    /** Tiempo real del elemento de vídeo (no depende de que React haya re-renderizado). */
    now: () => (ref.current ? ref.current.currentTime * 1000 : s.timeMs),
    frame: msToFrame(s.timeMs, stepFps),
    stepFps,
  };
  return api;
}

export type Player = ReturnType<typeof usePlayer>;
