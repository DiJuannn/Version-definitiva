"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { CHAPTERS, SHOT_SIZE, type Chapter, type Focus } from "@/lib/demo-script";
import { chapterSeconds, clapSound, speak, warmVoices, type VoiceHandle } from "@/components/demo/voice";

const GEL = ["", "var(--gel-1)", "var(--gel-2)", "var(--gel-3)", "var(--gel-4)"];
const NUMBERED = CHAPTERS.filter((c) => !c.special || c.special === "lectura" || c.special === "corten");

// Dónde va la cámara para enseñar `focus` dentro del escenario: escala y
// desplazamiento de la captura (que de base ocupa el ancho del escenario).
function frameFor(shot: string, focus: Focus, W: number, H: number, reduced: boolean) {
  const [iw, ih] = SHOT_SIZE[shot] ?? [1800, 1250];
  const dispH = (W * ih) / iw;
  const fx = focus[0] * W;
  const fy = focus[1] * dispH;
  const fw = focus[2] * W;
  const fh = focus[3] * dispH;
  const s = reduced ? 1 : Math.min(2.4, Math.max(1, Math.min(W / fw, H / fh) * 0.86));
  let x = W / 2 - (fx + fw / 2) * s;
  let y = H / 2 - (fy + fh / 2) * s;
  x = Math.min(0, Math.max(W - W * s, x));
  y = dispH * s > H ? Math.min(0, Math.max(H - dispH * s, y)) : (H - dispH * s) / 2;
  return { s, x, y, ring: { left: fx * s + x, top: fy * s + y, width: fw * s, height: fh * s } };
}

function Title({ text }: { text: string }) {
  return (
    <span aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pr-[0.18em] align-bottom">
          {[...w].map((ch, j) => (
            <span key={j} className="demo-char inline-block will-change-transform">
              {ch}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

function bubbles(host: HTMLElement | null, n = 7) {
  if (!host) return;
  const r = host.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const b = document.createElement("span");
    const size = 6 + Math.random() * 12;
    Object.assign(b.style, {
      position: "fixed",
      left: `${r.left + r.width * (0.3 + Math.random() * 0.4)}px`,
      top: `${r.top + r.height * 0.25}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "50%",
      border: "1.5px solid rgba(207,232,245,0.75)",
      background: "rgba(207,232,245,0.12)",
      pointerEvents: "none",
      zIndex: "60",
    });
    document.body.appendChild(b);
    gsap.to(b, {
      y: -(80 + Math.random() * 140),
      x: (Math.random() - 0.5) * 70,
      opacity: 0,
      scale: 1.4,
      duration: 1.4 + Math.random() * 1.2,
      delay: Math.random() * 0.4,
      ease: "power1.out",
      onComplete: () => b.remove(),
    });
  }
}

type Env = { root: React.RefObject<HTMLDivElement | null>; stage: React.RefObject<HTMLDivElement | null>; axo: React.RefObject<HTMLDivElement | null>; reduced: boolean; muted: boolean };
type Q = (s: string) => Element[];

function buildTimeline(chapter: Chapter, D: number, env: Env) {
  const { root, stage, axo, muted } = env;
  const tl = gsap.timeline();
  const q = gsap.utils.selector(root);
  const el = stage.current;
  const W = el?.clientWidth ?? 1000;
  const H = el?.clientHeight ?? 620;
  const rm = env.reduced;

  // Entrada: el título letra a letra, el bocadillo y el ajolote nadando.
  tl.fromTo(q(".demo-kicker"), { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.5, ease: "power2.out" }, 0);
  tl.fromTo(q(".demo-char"), { yPercent: 110, rotate: 6 }, { yPercent: 0, rotate: 0, duration: 0.7, stagger: 0.022, ease: "power3.out" }, 0.05);
  tl.fromTo(q(".demo-bubble"), { opacity: 0, scale: 0.85, y: 14 }, { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: "back.out(1.8)" }, 0.35);
  if (!rm) tl.fromTo(axo.current, { x: -60, rotation: -14 }, { x: 0, rotation: 0, duration: 1, ease: "elastic.out(1, 0.6)" }, 0);

  let a = 0.5;
  let b = D;
  if (chapter.special === "lectura") {
    a = D * 0.46;
    scriptReading(tl, q, 0.4, a);
  }
  if (chapter.special === "corten") b = D * 0.7;
  if (chapter.special === "intro") intro(tl, q);
  if (chapter.special === "outro") outro(tl, q, muted);

  const beats = chapter.beats;
  const seg = (b - a) / Math.max(1, beats.length);
  let prevShot: string | null = null;
  beats.forEach((beat, i) => {
    const t0 = a + i * seg;
    const f = frameFor(beat.shot, beat.focus, W, H, rm);
    const img = q(`[data-shot="${beat.shot}"]`)[0];
    if (!img) return;
    if (beat.shot !== prevShot) {
      if (prevShot) tl.to(q(`[data-shot="${prevShot}"]`), { opacity: 0, duration: 0.6 }, t0);
      // El revelado: de borroso y en sepia a nítido, como una foto en la cubeta.
      tl.fromTo(
        img,
        { opacity: 0, scale: 1, x: 0, y: 0, filter: "blur(16px) sepia(0.7) brightness(0.7)" },
        { opacity: 1, filter: "blur(0px) sepia(0) brightness(1)", duration: 1, ease: "power2.out" },
        t0,
      );
    }
    prevShot = beat.shot;
    tl.to(img, { scale: f.s, x: f.x, y: f.y, duration: Math.min(1.6, seg * 0.45), ease: "power3.inOut" }, t0 + 0.35);
    if (!rm) tl.to(img, { scale: f.s * 1.03, x: f.x - (W * f.s * 0.015), duration: seg * 0.5, ease: "none" }, t0 + 0.35 + Math.min(1.6, seg * 0.45));
    const ring = q(".demo-ring")[0];
    const label = q(".demo-label")[0];
    tl.set(ring, { ...f.ring, opacity: 1 }, t0 + 0.3 + Math.min(1.6, seg * 0.45));
    tl.fromTo(q(".demo-ring rect"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, ease: "power2.inOut" }, "<");
    if (beat.label) {
      tl.call(() => {
        if (label) label.textContent = beat.label ?? "";
      }, [], "<");
      tl.fromTo(label, { opacity: 0, y: 10, left: f.ring.left, top: Math.max(8, f.ring.top - 40) }, { opacity: 1, y: 0, duration: 0.45, ease: "back.out(2)" }, "<0.2");
    }
    tl.to([ring, label], { opacity: 0, duration: 0.35 }, t0 + seg - 0.3);
  });

  if (chapter.special === "corten") clapper(tl, q, b, D, stage.current, muted);
  return tl;
}

// Capítulo 1: una página de guion cae sobre la mesa, se escanea y salen las
// escenas, los personajes y los lugares.
function scriptReading(tl: gsap.core.Timeline, q: Q, t: number, end: number) {
  tl.fromTo(q(".demo-page"), { yPercent: -130, rotate: -9, opacity: 1 }, { yPercent: 0, rotate: -2, duration: 1, ease: "bounce.out" }, t);
  tl.fromTo(q(".demo-scan"), { top: "0%", opacity: 0 }, { top: "92%", opacity: 1, duration: 1.8, ease: "sine.inOut" }, t + 1);
  tl.fromTo(q(".demo-mark"), { backgroundSize: "0% 100%" }, { backgroundSize: "100% 100%", duration: 0.35, stagger: 0.22 }, t + 1.2);
  tl.fromTo(q(".demo-found"), { opacity: 0, x: -40, scale: 0.7 }, { opacity: 1, x: 0, scale: 1, duration: 0.6, stagger: 0.3, ease: "back.out(2)" }, t + 2.2);
  q(".demo-count").forEach((n, i) => {
    const target = Number((n as HTMLElement).dataset.to);
    const o = { v: 0 };
    tl.to(o, { v: target, duration: 0.9, ease: "power2.out", onUpdate: () => ((n as HTMLElement).textContent = String(Math.round(o.v))) }, t + 2.3 + i * 0.3);
  });
  tl.to(q(".demo-page"), { scale: 0.6, opacity: 0, rotate: 4, duration: 0.6, ease: "power2.in" }, end - 0.4);
  tl.to(q(".demo-found"), { opacity: 0, x: 40, duration: 0.4, stagger: 0.08 }, end - 0.4);
}

// Capítulo 8: la claqueta se cierra al «¡acción!».
function clapper(tl: gsap.core.Timeline, q: Q, from: number, D: number, stageEl: HTMLDivElement | null, muted: boolean) {
  tl.to(q("[data-shot]"), { opacity: 0.15, filter: "blur(4px)", duration: 0.5 }, from);
  tl.fromTo(q(".demo-clapper"), { opacity: 0, y: 80, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.6)" }, from);
  tl.fromTo(q(".demo-stick"), { rotate: -32 }, { rotate: -32, duration: 0.1 }, from);
  const hit = Math.max(from + 1, D - 1.2);
  tl.to(q(".demo-stick"), { rotate: 0, duration: 0.22, ease: "power4.in" }, hit - 0.22);
  tl.call(() => !muted && clapSound(), [], hit);
  tl.fromTo(q(".demo-flash"), { opacity: 0.85 }, { opacity: 0, duration: 0.5, immediateRender: false }, hit);
  tl.fromTo(stageEl, { x: -8 }, { x: 0, duration: 0.4, ease: "elastic.out(1.2, 0.3)", immediateRender: false }, hit);
  tl.fromTo(q(".demo-accion"), { opacity: 0, scale: 2.6, rotate: -10 }, { opacity: 1, scale: 1, rotate: -4, duration: 0.45, ease: "back.out(2.5)" }, hit + 0.05);
}

function intro(tl: gsap.core.Timeline, q: Q) {
  tl.fromTo(q(".demo-hero-axo"), { opacity: 0, scale: 0.3, rotate: -30, y: 120 }, { opacity: 1, scale: 1, rotate: 0, y: 0, duration: 1.4, ease: "elastic.out(1, 0.55)" }, 0.2);
  tl.fromTo(q(".demo-strip-frame"), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.12, ease: "power2.out" }, 1);
  tl.to(q(".demo-hero-axo"), { y: -14, duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: 6 }, 1.6);
}

function outro(tl: gsap.core.Timeline, q: Q, muted: boolean) {
  tl.fromTo(q(".demo-hero-axo"), { opacity: 0, scale: 0.4, y: 100 }, { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: "elastic.out(1, 0.5)" }, 0.1);
  tl.fromTo(q(".demo-stamp"), { opacity: 0, scale: 3, rotate: -16 }, { opacity: 1, scale: 1, rotate: -7, duration: 0.5, ease: "back.out(2.2)" }, 0.5);
  tl.call(() => !muted && clapSound(), [], 0.55);
  tl.fromTo(q(".demo-cta"), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.12 }, 1.4);
  q(".demo-frame-fall").forEach((f, i) => {
    tl.fromTo(
      f,
      { y: -80, x: 0, rotate: 0, opacity: 0 },
      { y: 520 + Math.random() * 120, x: (Math.random() - 0.5) * 260, rotate: (Math.random() - 0.5) * 220, opacity: 1, duration: 2.4 + Math.random(), ease: "power1.in" },
      0.55 + i * 0.05,
    );
    tl.to(f, { opacity: 0, duration: 0.6 }, ">-0.6");
  });
}


export function DemoPlayer() {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const axo = useRef<HTMLDivElement>(null);
  const axoImg = useRef<HTMLImageElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const voiceRef = useRef<VoiceHandle | null>(null);
  const playingRef = useRef(playing);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useRef(false);

  const ch: Chapter = CHAPTERS[index];
  const shots = [...new Set(ch.beats.map((b) => b.shot))];

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    warmVoices();
  }, []);

  const go = useCallback((i: number) => {
    if (advanceRef.current) clearTimeout(advanceRef.current);
    setProgress(0);
    setIndex(Math.max(0, Math.min(CHAPTERS.length - 1, i)));
  }, []);

  // El ajolote flota siempre; al hablar, rebota un poco.
  useEffect(() => {
    if (reduced.current || !axo.current) return;
    const t = gsap.to(axo.current, { y: -12, rotation: 2.5, duration: 1.9, ease: "sine.inOut", yoyo: true, repeat: -1 });
    return () => {
      t.kill();
    };
  }, []);
  useEffect(() => {
    if (!axoImg.current || reduced.current) return;
    if (!speaking) {
      gsap.to(axoImg.current, { scaleY: 1, scaleX: 1, duration: 0.2 });
      return;
    }
    const t = gsap.to(axoImg.current, { scaleY: 1.045, scaleX: 0.975, duration: 0.17, ease: "sine.inOut", yoyo: true, repeat: -1, transformOrigin: "50% 100%" });
    return () => {
      t.kill();
    };
  }, [speaking]);

  // Cada capítulo: su animación (a la medida de lo que dura la voz) y la voz.
  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    const chapter = CHAPTERS[index];
    const ctx = gsap.context(() => {}, root);
    (async () => {
      const D = await chapterSeconds(chapter.id, chapter.voice);
      if (cancelled) return;
      ctx.add(() => {
        tlRef.current = buildTimeline(chapter, D, { root, stage, axo, reduced: reduced.current, muted });
      });
      bubbles(axo.current, 9);
      const v = await speak(chapter.id, chapter.voice, {
        muted,
        onProgress: (p) => !cancelled && setProgress(p),
        onSpeaking: (on) => !cancelled && setSpeaking(on),
        onEnd: () => {
          if (cancelled || chapter.special === "outro") return;
          advanceRef.current = setTimeout(() => playingRef.current && go(index + 1), 1100);
        },
      });
      if (cancelled) v.stop();
      else {
        voiceRef.current = v;
        if (!playingRef.current) {
          v.pause();
          tlRef.current?.pause();
        }
      }
    })();
    return () => {
      cancelled = true;
      voiceRef.current?.stop();
      voiceRef.current = null;
      if (advanceRef.current) clearTimeout(advanceRef.current);
      tlRef.current = null;
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, index, muted]);

  useEffect(() => {
    playingRef.current = playing;
    if (playing) {
      tlRef.current?.resume();
      voiceRef.current?.resume();
    } else {
      tlRef.current?.pause();
      voiceRef.current?.pause();
    }
  }, [playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started) return;
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key.toLowerCase() === "m") setMuted((m) => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, index, go]);

  const words = ch.voice.split(" ");
  const spoken = Math.round(progress * words.length);
  const numberedIndex = NUMBERED.findIndex((c) => c.id === ch.id);

  return (
    <div ref={root} className="taller-ink relative flex min-h-[100dvh] flex-col overflow-hidden bg-ink-0 text-fg" data-phase={ch.phase}>
      {/* La luz de la mesa, del color de la fase */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60 transition-[background] duration-1000" style={{ background: `radial-gradient(70% 60% at 70% 45%, color-mix(in srgb, ${GEL[ch.phase]} 12%, transparent), transparent 70%)` }} />

      <header className="relative z-10 flex items-center gap-4 px-5 py-4 sm:px-8">
        <Link href="/taller" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ajolote.png" alt="" className="h-7 w-auto" />
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase">Taller · demo</span>
        </Link>
        {started && (
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="btn btn-outline btn-sm" aria-label="Capítulo anterior">
              ←
            </button>
            <button type="button" onClick={() => setPlaying((p) => !p)} className="btn btn-outline btn-sm w-24">
              {playing ? "Pausa" : "Seguir"}
            </button>
            <button type="button" onClick={() => go(index + 1)} disabled={index === CHAPTERS.length - 1} className="btn btn-outline btn-sm" aria-label="Capítulo siguiente">
              →
            </button>
            <button type="button" onClick={() => setMuted((m) => !m)} aria-pressed={muted} className="btn btn-outline btn-sm w-28">
              {muted ? "Sin voz" : "Con voz"}
            </button>
          </div>
        )}
      </header>

      {!started ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ajolote.png" alt="El ajolote del Taller" className="demo-idle h-56 w-auto drop-shadow-[0_20px_40px_rgba(243,182,197,0.25)]" />
          <p className="mt-6 font-mono text-[11px] tracking-[0.2em] text-muted uppercase">Versión definitiva · Taller</p>
          <h1 className="poster-title mt-3 text-[56px] sm:text-[96px]">
            Del guion
            <br />
            <span className="text-gel-3">al rodaje</span>
          </h1>
          <p className="mt-4 max-w-md font-sans text-[16px] leading-relaxed text-fg/80">Dos minutos, con el ajolote de guía. Mejor con sonido.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setMuted(false);
                setStarted(true);
              }}
              className="btn btn-primary h-12 px-6 text-[16px]"
            >
              ▶ Empezar con voz
            </button>
            <button
              type="button"
              onClick={() => {
                setMuted(true);
                setStarted(true);
              }}
              className="btn btn-outline h-12 px-6"
            >
              Sin sonido
            </button>
          </div>
        </div>
      ) : (
        <main className="relative z-10 grid flex-1 gap-6 px-5 pb-28 sm:px-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-center lg:gap-10">
          {/* Izquierda: el capítulo, el bocadillo y el ajolote */}
          <section key={`t-${ch.id}`} className="relative order-2 lg:order-1">
            <p className="demo-kicker font-mono text-[11px] tracking-[0.18em] uppercase" style={{ color: GEL[ch.phase] }}>
              {ch.kicker}
            </p>
            <h1 className="poster-title mt-2 text-[44px] leading-[0.88] sm:text-[60px]">
              <Title text={ch.title} />
            </h1>
            <div className="demo-bubble relative mt-6 rounded-[var(--r-lg)] bg-[#f6f4ee] px-5 py-4 text-[#1c1b19] shadow-[0_18px_40px_-20px_rgba(0,0,0,0.8)]">
              <p className="font-sans text-[16.5px] leading-snug" aria-live="polite">
                {words.map((w, i) => (
                  <span key={i} className="transition-opacity duration-200" style={{ opacity: i < spoken ? 1 : 0.32 }}>
                    {w}{" "}
                  </span>
                ))}
              </p>
              <span aria-hidden className="absolute -bottom-2.5 left-10 h-5 w-5 rotate-45 bg-[#f6f4ee]" />
            </div>
            <div ref={axo} className={`mt-4 ml-2 w-fit transition-opacity duration-500 ${ch.special === "intro" || ch.special === "outro" ? "opacity-0" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={axoImg} src="/ajolote.png" alt="" className="h-40 w-auto drop-shadow-[0_18px_30px_rgba(243,182,197,0.18)] sm:h-48" />
            </div>
          </section>

          {/* Derecha: el escenario con la app de verdad */}
          <section className="relative order-1 lg:order-2" aria-label="La app">
            <div
              ref={stage}
              className="relative aspect-[16/10] w-full overflow-hidden rounded-[var(--r-lg)] bg-ink-1 shadow-[0_0_0_1px_var(--line),0_40px_80px_-40px_rgba(0,0,0,0.9)]"
            >
              {shots.map((s) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${ch.id}-${s}`} data-shot={s} src={`/demo/shots/${s}.webp`} alt="" className="absolute top-0 left-0 w-full origin-top-left opacity-0 will-change-transform" />
              ))}

              {ch.special === "lectura" && (
                <>
                  <div className="demo-page absolute top-[7%] left-[8%] w-[46%] rounded-[3px] bg-[#f6f4ee] px-[4%] py-[4%] font-[family-name:var(--font-courier)] text-[clamp(8px,1.05vw,13px)] leading-[1.5] text-[#1c1b19] opacity-0 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]">
                    <p className="font-bold">
                      <span className="demo-mark bg-[linear-gradient(#f0c94a,#f0c94a)] bg-no-repeat">EXT. PISTA DE TENIS — DÍA</span>
                    </p>
                    <p className="mt-2">La pista es de cemento azul. El cielo está despejado, sol de mediodía.</p>
                    <p className="mt-2">
                      <span className="demo-mark bg-[linear-gradient(#f3cfd9,#f3cfd9)] bg-no-repeat">AUREL</span> (23) entrena solo en la mitad derecha de la pista. Golpea una{" "}
                      <span className="demo-mark bg-[linear-gradient(#cfe0f3,#cfe0f3)] bg-no-repeat">pelota</span>.
                    </p>
                    <p className="mt-3 pl-[30%]">
                      <span className="demo-mark bg-[linear-gradient(#f3cfd9,#f3cfd9)] bg-no-repeat">DORIAN</span>
                    </p>
                    <p className="pl-[16%]">Diez minutos tarde. Ya sé, ya sé…</p>
                    <p className="mt-3 font-bold">
                      <span className="demo-mark bg-[linear-gradient(#f0c94a,#f0c94a)] bg-no-repeat">INT. RESTAURANTE — DÍA</span>
                    </p>
                    <p className="mt-2">Luz tenue y amarillenta. Las mesas tienen manteles blancos.</p>
                    <span aria-hidden className="demo-scan absolute inset-x-0 h-10 bg-[linear-gradient(transparent,rgba(156,199,238,0.55),transparent)] opacity-0" />
                  </div>
                  <ul className="absolute top-[14%] right-[7%] w-[34%] space-y-3">
                    {(
                      [
                        [10, "escenas", "#f0c94a"],
                        [4, "personajes", "#f3b6c5"],
                        [7, "localizaciones", "#9cc7ee"],
                      ] as const
                    ).map(([n, label, c]) => (
                      <li key={label} className="demo-found flex items-baseline gap-3 rounded-[var(--r-md)] border border-line bg-ink-0/80 px-4 py-3 opacity-0 backdrop-blur">
                        <span className="demo-count poster-title text-[clamp(28px,4vw,52px)]" data-to={n} style={{ color: c }}>
                          0
                        </span>
                        <span className="font-sans text-[clamp(12px,1.3vw,16px)]">{label}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {ch.special === "corten" && (
                <div className="demo-clapper absolute inset-0 flex flex-col items-center justify-center opacity-0">
                  <div className="w-[52%]">
                    <div className="relative h-[clamp(20px,3.4vw,44px)]">
                      <div className="demo-stick absolute inset-0 origin-bottom-left rounded-t-[3px] bg-[repeating-linear-gradient(-58deg,#f2f0ea_0_22px,#0b0b0d_22px_44px)] shadow-[0_0_0_1px_#0b0b0d]" />
                    </div>
                    <div className="h-[clamp(16px,2.6vw,34px)] bg-[repeating-linear-gradient(58deg,#f2f0ea_0_22px,#0b0b0d_22px_44px)] shadow-[0_0_0_1px_#0b0b0d]" />
                    <div className="grid grid-cols-3 border border-t-0 border-line bg-[#0d0d10] font-mono text-[clamp(9px,1vw,12px)] tracking-[0.14em] text-muted uppercase">
                      <div className="col-span-3 border-b border-line px-4 py-2">
                        Prod. <span className="poster-title ml-2 text-[clamp(18px,2.6vw,34px)] text-fg normal-case">Distorsión</span>
                      </div>
                      {(
                        [
                          ["Esc.", "1"],
                          ["Plano", "3"],
                          ["Toma", "1"],
                        ] as const
                      ).map(([l, v], i) => (
                        <div key={l} className={`px-4 py-2 ${i ? "border-l border-line" : ""}`}>
                          {l} <span className="seg ml-2 text-[clamp(18px,2.6vw,34px)] text-fg">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="demo-accion poster-title mt-[4%] text-[clamp(40px,7vw,96px)] text-gel-3 opacity-0">¡Acción!</p>
                </div>
              )}

              {(ch.special === "intro" || ch.special === "outro") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(60%_60%_at_50%_45%,rgba(243,182,197,0.14),transparent)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/ajolote.png" alt="" className="demo-hero-axo h-[62%] w-auto opacity-0" />
                  {ch.special === "intro" && (
                    <div className="mt-[3%] flex gap-2">
                      {NUMBERED.map((c) => (
                        <span key={c.id} className="demo-strip-frame h-[clamp(18px,2.4vw,30px)] w-[clamp(30px,4vw,52px)] rounded-[2px] opacity-0" style={{ background: GEL[c.phase] }} />
                      ))}
                    </div>
                  )}
                  {ch.special === "outro" && (
                    <>
                      <p className="demo-stamp poster-title absolute top-[8%] right-[5%] rounded-[6px] border-[5px] border-gel-3 px-5 py-2 text-[clamp(32px,6vw,80px)] text-gel-3 opacity-0">
                        ¡Corten!
                      </p>
                      {Array.from({ length: 18 }).map((_, i) => (
                        <span
                          key={i}
                          aria-hidden
                          className="demo-frame-fall absolute top-0 h-5 w-8 rounded-[2px] opacity-0"
                          style={{ left: `${8 + ((i * 47) % 84)}%`, background: GEL[(i % 4) + 1] }}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}

              <svg aria-hidden className="demo-ring pointer-events-none absolute opacity-0" style={{ overflow: "visible" }} width="100%" height="100%" preserveAspectRatio="none">
                <rect x="-6" y="-6" width="calc(100% + 12px)" height="calc(100% + 12px)" rx="12" fill="none" stroke={GEL[ch.phase]} strokeWidth="3" pathLength={1} strokeDasharray="1" style={{ filter: "drop-shadow(0 0 8px rgba(0,0,0,0.6))" }} />
              </svg>
              <span className="demo-label pointer-events-none absolute rounded-[var(--r-sm)] px-2.5 py-1 font-sans text-[13px] font-semibold text-ink-0 opacity-0 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.7)]" style={{ background: GEL[ch.phase] }} />
              <span aria-hidden className="demo-flash pointer-events-none absolute inset-0 bg-white opacity-0" />
            </div>

            {ch.special === "outro" && (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link href="/app/signup" className="demo-cta btn btn-primary h-12 px-6 text-[16px] opacity-0">
                  Crear mi cuenta y subir mi guion
                </Link>
                <button type="button" onClick={() => go(0)} className="demo-cta btn btn-outline h-12 px-6 opacity-0">
                  Ver otra vez
                </button>
              </div>
            )}
          </section>
        </main>
      )}

      {/* La tira de avance: un fotograma por capítulo */}
      {started && (
        <nav aria-label="Capítulos" className="absolute inset-x-0 bottom-0 z-20 bg-[#2b211c]/95 px-4 py-3 backdrop-blur">
          <span aria-hidden className="absolute inset-x-0 top-1 h-1.5 bg-[repeating-linear-gradient(90deg,#0b0b0d_0_8px,transparent_8px_18px)]" />
          <ol className="mx-auto mt-1.5 flex max-w-5xl gap-1.5">
            {NUMBERED.map((c, i) => {
              const on = c.id === ch.id;
              const done = numberedIndex > i || ch.special === "outro";
              return (
                <li key={c.id} className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => go(CHAPTERS.indexOf(c))}
                    aria-current={on ? "step" : undefined}
                    className={`relative block h-11 w-full overflow-hidden rounded-[3px] px-2 text-left transition-colors ${on ? "bg-[#f6f4ee] text-ink-0" : done ? "bg-ink-2 text-fg" : "bg-ink-0 text-muted hover:text-fg"}`}
                  >
                    <span className="block truncate font-mono text-[10px] tracking-[0.1em] uppercase opacity-70">{c.kicker.split(" · ")[0]}</span>
                    <span className="block truncate font-sans text-[12.5px] font-semibold">{c.title}</span>
                    <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: GEL[c.phase], transform: `scaleX(${on ? progress : done ? 1 : 0})`, transformOrigin: "left", transition: on ? "none" : "transform .4s" }} />
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}
    </div>
  );
}
