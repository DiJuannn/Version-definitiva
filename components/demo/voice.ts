"use client";

import { voiceSeconds } from "@/lib/demo-script";

// La voz del ajolote. Por orden: la grabación de public/demo/voz/<id>.mp3 si
// existe; si no, la voz del navegador en español; y si no hay voz (o está en
// silencio), un reloj con lo que se tardaría en decirlo. En los tres casos
// avisa del avance (0–1) para los subtítulos y de cuándo termina.

export type VoiceHandle = { pause: () => void; resume: () => void; stop: () => void };
type Opts = { muted: boolean; onProgress: (p: number) => void; onEnd: () => void; onSpeaking?: (on: boolean) => void };

// Qué capítulos tienen grabación: public/demo/voz/manifest.json ({"voces": ["hola", …]}).
let manifest: Promise<Set<string>> | null = null;
function hasRecording(id: string): Promise<boolean> {
  manifest ??= fetch("/demo/voz/manifest.json")
    .then((r) => (r.ok ? r.json() : { voces: [] }))
    .then((m: { voces?: string[] }) => new Set(m.voces ?? []))
    .catch(() => new Set<string>());
  return manifest.then((set) => set.has(id));
}

let chosen: SpeechSynthesisVoice | null | undefined;
function spanishVoice(): SpeechSynthesisVoice | null {
  if (chosen !== undefined) return chosen;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  if (!voices.length) return null;
  const es = voices.filter((v) => v.lang.toLowerCase().startsWith("es"));
  const prefer = [/elvira|álvaro|alvaro|dalia|helena|laura|lucía|lucia/i, /natural|neural|online/i, /es-es/i, /google/i];
  chosen = prefer.map((re) => es.find((v) => re.test(v.name) || re.test(v.lang))).find(Boolean) ?? es[0] ?? null;
  return chosen;
}
export function warmVoices() {
  window.speechSynthesis?.getVoices();
  window.speechSynthesis?.addEventListener?.("voiceschanged", () => {
    chosen = undefined;
    spanishVoice();
  });
}

function timer(seconds: number, o: Opts): VoiceHandle {
  let elapsed = 0;
  let last = performance.now();
  let raf = 0;
  let running = true;
  const tick = (t: number) => {
    if (running) elapsed += (t - last) / 1000;
    last = t;
    o.onProgress(Math.min(1, elapsed / seconds));
    if (elapsed >= seconds) {
      o.onSpeaking?.(false);
      o.onEnd();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  o.onSpeaking?.(!o.muted);
  raf = requestAnimationFrame(tick);
  return {
    pause: () => {
      running = false;
      o.onSpeaking?.(false);
    },
    resume: () => {
      running = true;
      last = performance.now();
      o.onSpeaking?.(!o.muted);
    },
    stop: () => cancelAnimationFrame(raf),
  };
}

export async function speak(id: string, text: string, o: Opts): Promise<VoiceHandle> {
  if (o.muted) return timer(voiceSeconds(text), o);

  if (await hasRecording(id)) {
    const audio = new Audio(`/demo/voz/${id}.mp3`);
    let raf = 0;
    const tick = () => {
      if (audio.duration) o.onProgress(audio.currentTime / audio.duration);
      raf = requestAnimationFrame(tick);
    };
    audio.addEventListener("playing", () => o.onSpeaking?.(true));
    audio.addEventListener("pause", () => o.onSpeaking?.(false));
    audio.addEventListener("ended", () => {
      cancelAnimationFrame(raf);
      o.onProgress(1);
      o.onSpeaking?.(false);
      o.onEnd();
    });
    try {
      await audio.play();
      tick();
      return { pause: () => audio.pause(), resume: () => void audio.play(), stop: () => (cancelAnimationFrame(raf), audio.pause()) };
    } catch {
      // Sin permiso para sonar (falta un toque del usuario): sigue sin voz.
      return timer(voiceSeconds(text), o);
    }
  }

  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  const voice = synth ? spanishVoice() : null;
  if (!synth || !voice) return timer(voiceSeconds(text), o);

  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 1.02;
  u.pitch = 1.35; // un punto más aguda: es un ajolote
  let done = false;
  // Por si el navegador no avisa de cada palabra: el reloj estimado mueve los subtítulos.
  const estimate = voiceSeconds(text);
  const started = performance.now();
  let pausedAt = 0;
  let pausedTotal = 0;
  let boundary = 0;
  let raf = 0;
  const tick = () => {
    const t = (performance.now() - started - pausedTotal) / 1000;
    o.onProgress(Math.min(0.98, Math.max(boundary, t / estimate)));
    raf = requestAnimationFrame(tick);
  };
  u.onboundary = (e) => {
    boundary = e.charIndex / text.length;
  };
  u.onstart = () => o.onSpeaking?.(true);
  u.onend = u.onerror = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    o.onProgress(1);
    o.onSpeaking?.(false);
    o.onEnd();
  };
  synth.speak(u);
  tick();
  return {
    pause: () => {
      pausedAt = performance.now();
      synth.pause();
      o.onSpeaking?.(false);
    },
    resume: () => {
      pausedTotal += performance.now() - pausedAt;
      synth.resume();
      o.onSpeaking?.(true);
    },
    stop: () => {
      done = true;
      cancelAnimationFrame(raf);
      synth.cancel();
    },
  };
}

// Duración del capítulo: la de la grabación si la hay, o la estimada.
export async function chapterSeconds(id: string, text: string): Promise<number> {
  if (await hasRecording(id)) {
    const d = await new Promise<number>((resolve) => {
      const a = new Audio(`/demo/voz/${id}.mp3`);
      a.preload = "metadata";
      a.onloadedmetadata = () => resolve(a.duration);
      a.onerror = () => resolve(0);
    });
    if (d) return d;
  }
  return voiceSeconds(text);
}

// El golpe de la claqueta, sintetizado (sin archivos).
export function clapSound() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const len = ctx.sampleRate * 0.12;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.value = 0.9;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
    src.onended = () => ctx.close();
  } catch {}
}
