"use client";

import { useMemo, useState, useTransition } from "react";
import { useYMap } from "@/lib/screenplay/use-ymap";
import type { SceneMeta } from "@/lib/screenplay/story";
import { guidedCoachAction, guidedLoglineAction, guidedTailorAction } from "@/lib/actions/screenplay-guided";
import { InlineText, updateSceneMeta, useWorkspace } from "@/components/screenplay/workspace";
import { CoachCard } from "@/components/screenplay/guided/CoachCard";
import { useAiAvailable, useGuidedData } from "@/components/screenplay/guided/use-guided";
import { markSkeletonMoments, setSkeleton } from "@/components/screenplay/guided/guided-doc";
import { insertSkeletonScenes, liveSceneSids } from "@/components/screenplay/guided/scene-insert";
import {
  ROUTES,
  ROUTE_IDS,
  assembleLogline,
  cardId,
  cardView,
  defaultRoute,
  newSkeleton,
  sceneRanges,
  sceneState,
  scenesToCreate,
  stepOf,
  stepPages,
  switchRoute,
  type RouteId,
  type Skeleton,
  type SkeletonCard,
} from "@/components/screenplay/guided/guided";

const STATE_TEXT = { empty: "vacía", sketched: "esbozada", written: "escrita" } as const;

// Paso «Esqueleto»: la historia en una frase (montada con sus respuestas) y
// una tarjeta por escena, con la pregunta que dice qué tiene que pasar.
// «Pasar al guion» crea las escenas vacías y marca en ellas los momentos de
// la historia: los coloca quien escribe, no un porcentaje.
export function SkeletonStep({ format, title }: { format: string; title: string }) {
  const { maps, editor, blocks, setStep, goToScene, screenplayId } = useWorkspace();
  const { start, skeleton } = useGuidedData(maps);
  const dev = useYMap<string>(maps.dev);
  const meta = useYMap<SceneMeta>(maps.scenes);
  const ai = useAiAvailable();
  const [focus, setFocus] = useState<string | null>(null);
  const [polish, setPolish] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pending, startAi] = useTransition();

  // Si aún no hay esqueleto (se saltaron las preguntas), se enseña el de la
  // ruta por defecto y se guarda con el primer cambio.
  const sk: Skeleton = useMemo(() => skeleton ?? newSkeleton(defaultRoute(format), start), [format, skeleton, start]);
  const route = ROUTES[sk.route];
  const ranges = useMemo(() => new Map(sceneRanges(blocks).map((r) => [r.sid, r])), [blocks]);
  const linked = sk.cards.filter((c) => c.sid && ranges.has(c.sid));
  const pendingCards = sk.cards.filter((c) => !c.sid || !ranges.has(c.sid));
  const created = linked.length > 0;
  const name = start.name;

  const save = (next: Skeleton) => setSkeleton(maps, next);
  const patchCard = (id: string, patch: Partial<SkeletonCard>) => save({ ...sk, cards: sk.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const lineOf = (c: SkeletonCard) => (c.sid && ranges.has(c.sid) ? (meta[c.sid]?.synopsis ?? c.line) : c.line);
  const setLine = (c: SkeletonCard, v: string) => {
    patchCard(c.id, { line: v });
    if (c.sid && ranges.has(c.sid)) updateSceneMeta(maps, c.sid, { synopsis: v || undefined });
  };

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= sk.cards.length) return;
    const cards = [...sk.cards];
    [cards[i], cards[j]] = [cards[j], cards[i]];
    save({ ...sk, cards });
  };
  const addAfter = (i: number) => {
    const cards = [...sk.cards];
    const id = cardId();
    cards.splice(i + 1, 0, { id, step: "extra", line: "", title: "Otra escena" });
    save({ ...sk, cards });
    setFocus(id);
  };
  const remove = (c: SkeletonCard) => save({ ...sk, cards: sk.cards.filter((x) => x.id !== c.id) });

  // Crea las escenas que falten (todas, la primera vez), marca los momentos
  // y abre la página en la primera escena nueva.
  const toScript = () => {
    if (!editor) return;
    const existing = new Set(liveSceneSids(editor));
    const plan = scenesToCreate(sk, existing);
    const keep = new Set(sk.cards.map((c) => c.sid).filter((x): x is string => Boolean(x)));
    const made = insertSkeletonScenes(
      editor,
      plan.map((p) => ({ key: p.cardId, beforeSid: p.beforeSid })),
      keep,
    );
    const next: Skeleton = {
      ...sk,
      created: true,
      cards: sk.cards.map((c) => (made.has(c.id) ? { ...c, sid: made.get(c.id) } : c)),
    };
    maps.structure.doc?.transact(() => {
      for (const c of next.cards) {
        const sid = made.get(c.id);
        if (sid && c.line.trim()) updateSceneMeta(maps, sid, { synopsis: c.line.trim() });
      }
      save(next);
      markSkeletonMoments(maps, next, liveSceneSids(editor).map((sid) => ({ sid })));
    });
    const first = next.cards.find((c) => made.has(c.id))?.sid ?? next.cards.find((c) => c.sid)?.sid;
    setStep("guion");
    if (first) goToScene(first);
  };

  const logline = dev.logline ?? "";
  const assembled = assembleLogline(start);

  const runTailor = () =>
    startAi(async () => {
      setAiError(null);
      const steps = sk.cards.map((c) => {
        const v = cardView(sk, c, name);
        return { title: v.title, question: v.question };
      });
      const res = await guidedTailorAction(screenplayId, start, steps).catch(() => null);
      if (!res) setAiError("No se ha podido conectar. Inténtalo otra vez.");
      else if (!res.ok) setAiError(res.error);
      else save({ ...sk, cards: sk.cards.map((c, i) => ({ ...c, question: res.questions[i] })) });
    });
  const runPolish = () =>
    startAi(async () => {
      setAiError(null);
      const res = await guidedLoglineAction(screenplayId, start, logline).catch(() => null);
      if (!res) setAiError("No se ha podido conectar. Inténtalo otra vez.");
      else if (!res.ok) setAiError(res.error);
      else setPolish(res.logline);
    });
  const tailored = sk.cards.some((c) => c.question);

  const focusCard = sk.cards.find((c) => c.id === focus) ?? null;
  const focusIndex = focusCard ? sk.cards.indexOf(focusCard) : -1;
  const kind = sk.route === "feature8" ? "largo" : "corto";

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pt-10 pb-24 sm:px-8">
      {/* La historia en una frase */}
      <section aria-labelledby="sp-logline">
        <p id="sp-logline" className="sp-label">
          Tu historia en una frase
        </p>
        <div className="mt-2 rounded-[var(--r-lg)] border border-[var(--line)] bg-white px-5 py-4">
          <InlineText
            label="Tu historia en una frase (logline)"
            value={logline}
            onSave={(v) => (v ? maps.dev.set("logline", v) : maps.dev.delete("logline"))}
            placeholder={assembled || "Quién es, qué quiere y qué se lo impide, en una frase."}
            rows={2}
            className="text-[21px] leading-snug font-bold tracking-[-0.01em] sm:text-[23px]"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
          <span>Hecha con tus respuestas. Es tuya: haz clic para cambiar cualquier palabra.</span>
          <details className="relative">
            <summary className="cursor-pointer list-none text-[var(--accent)] hover:underline">¿Qué es una logline?</summary>
            <p className="absolute top-full left-0 z-20 mt-2 w-[min(320px,80vw)] rounded-[var(--r-md)] bg-[#1c1b19] px-3.5 py-3 text-[13px] leading-relaxed text-white shadow-lg">
              La historia en una frase: quién, qué quiere y qué se lo impide. Sirve para no perderte mientras escribes y para contársela a otros.
            </p>
          </details>
          {assembled && logline.trim() !== assembled && (
            <button type="button" onClick={() => maps.dev.set("logline", assembled)} className="text-[var(--accent)] hover:underline">
              Volver a montarla con mis respuestas
            </button>
          )}
          {ai && logline.trim() && (
            <button type="button" onClick={runPolish} disabled={pending} className="sp-ai-btn !py-1 disabled:opacity-60">
              <span aria-hidden className={`sp-ai-dot ${pending ? "animate-pulse" : ""}`} />
              Proponme una frase más clara
            </button>
          )}
        </div>
        {polish && (
          <div className="mt-3 rounded-[var(--r-lg)] border border-dashed border-[#e3b25c] bg-[#fffaf0] px-4 py-3 text-[14.5px] leading-relaxed text-[#6b4a00]">
            <p className="text-[12px] font-semibold tracking-wide uppercase">✦ Propuesta, con tus mismas palabras</p>
            <p className="mt-1 text-[16px] text-[#3d2c00]">{polish}</p>
            <div className="mt-2.5 flex flex-wrap gap-2 text-[13px]">
              <button
                type="button"
                onClick={() => {
                  maps.dev.set("logline", polish);
                  setPolish(null);
                }}
                className="rounded-md bg-[#1c1b19] px-3 py-1.5 font-medium text-white"
              >
                Usar esta
              </button>
              <button type="button" onClick={() => setPolish(null)} className="rounded-md px-3 py-1.5 hover:bg-[#f6e7c4]">
                Quedarme con la mía
              </button>
            </div>
          </div>
        )}
      </section>

      {/* El esqueleto */}
      <section className="mt-12" aria-labelledby="sp-skeleton">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <h2 id="sp-skeleton" className="text-[26px] leading-tight font-black tracking-[-0.02em] sm:text-[30px]">
            Tu esqueleto · {kind} de ~{route.pages} páginas
          </h2>
          <label className="flex max-w-full min-w-0 items-center gap-2 text-[13px] text-muted">
            Forma:
            <select
              value={sk.route}
              disabled={created}
              title={created ? "Las escenas ya están en el guion: el orden se cambia desde «Tu historia»." : route.hint}
              onChange={(e) => save(switchRoute(sk, e.target.value as RouteId))}
              className="max-w-full min-w-0 truncate rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[13px] font-semibold text-fg outline-none focus:border-[var(--accent)] disabled:opacity-70"
            >
              {ROUTE_IDS.map((id) => (
                <option key={id} value={id}>
                  {ROUTES[id].label} · {ROUTES[id].hint}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-muted">
          {sk.cards.length} tarjetas en orden. Cada una será una escena (o dos). Están vacías a propósito: la pregunta te dice qué tiene que pasar; tú decides cómo.
        </p>

        <ol
          className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:[grid-template-columns:var(--cols)]"
          style={{ ["--cols" as string]: `repeat(${Math.min(sk.cards.length, sk.cards.length > 5 ? 4 : 5)}, minmax(0, 1fr))` }}
        >
          {sk.cards.map((c, i) => {
            const v = cardView(sk, c, name);
            const step = stepOf(sk, c);
            const range = c.sid ? ranges.get(c.sid) : undefined;
            const state = range ? sceneState(blocks, range, lineOf(c)) : null;
            const selected = focus === c.id;
            return (
              <li
                key={c.id}
                onFocusCapture={() => setFocus(c.id)}
                className={`group relative flex flex-col rounded-[var(--r-lg)] border bg-white p-4 transition-colors ${
                  selected ? "border-[#e3b25c] shadow-[0_0_0_3px_rgba(227,178,92,0.18)]" : "border-[var(--line)]"
                }`}
              >
                <p className={`font-mono text-[10.5px] tracking-[0.14em] uppercase ${selected ? "text-[#a8640a]" : "text-muted"}`}>
                  {i + 1} · {v.plain}
                  {v.technical && <span className="tracking-normal normal-case"> · {v.technical}</span>}
                </p>
                <h3 className="mt-1.5 text-[15.5px] leading-snug font-bold">{v.title}</h3>
                <p className="mt-1 text-[13.5px] leading-snug text-muted">{v.question}</p>
                <div className="mt-3 border-t border-[var(--line)] pt-2.5">
                  <InlineText
                    label={`Tarjeta ${i + 1}: ${v.title}`}
                    value={lineOf(c)}
                    onSave={(val) => setLine(c, val)}
                    placeholder="Escribe una línea…"
                    rows={2}
                    className="text-[14px] leading-snug"
                  />
                </div>
                <p className="mt-auto flex items-center gap-2 pt-2.5 text-[12px] text-muted">
                  <span>{step ? stepPages(step, route.pages) : "≈ donde la pongas"}</span>
                  {range && (
                    <button type="button" onClick={() => {
                        setStep("guion");
                        goToScene(range.sid);
                      }} className="ml-auto text-[var(--accent)] hover:underline">
                      Escena {STATE_TEXT[state ?? "empty"]} →
                    </button>
                  )}
                </p>
                {!created && (
                  <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
                    <CardTool label="Mover antes" onClick={() => move(i, -1)} disabled={i === 0}>
                      ←
                    </CardTool>
                    <CardTool label="Mover después" onClick={() => move(i, 1)} disabled={i === sk.cards.length - 1}>
                      →
                    </CardTool>
                    <CardTool label="Quitar esta tarjeta" onClick={() => remove(c)} disabled={sk.cards.length <= 1}>
                      ×
                    </CardTool>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => addAfter(i)}
                  aria-label={`Añadir una tarjeta después de la ${i + 1}`}
                  title="Añadir una tarjeta aquí"
                  className="absolute top-1/2 -right-[13px] z-10 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-[var(--line)] bg-white text-[14px] leading-none text-[var(--accent)] shadow-sm group-hover:grid hover:border-[var(--accent)] lg:group-hover:grid"
                >
                  +
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          <button type="button" onClick={() => addAfter(sk.cards.length - 1)} className="text-[var(--accent)] hover:underline">
            + Añadir tarjeta
          </button>{" "}
          (o con el «+» entre dos) · Las vacías también sirven: serán escenas por escribir. No salen en el PDF ni pasan a producción hasta que les pongas lugar y hora.
        </p>

        {(ai || aiError) && (
          <div className="mt-5 flex flex-wrap items-start gap-3">
            {ai && !created && (
              <button type="button" onClick={runTailor} disabled={pending} className="sp-ai-btn disabled:opacity-60">
                <span aria-hidden className={`sp-ai-dot ${pending ? "animate-pulse" : ""}`} />
                {pending ? "Pensando…" : tailored ? "Otras preguntas a medida" : "Preguntas a medida para tu historia"}
              </button>
            )}
            {ai && focusCard && (
              <div className="min-w-[260px] flex-1" key={focusCard.id}>
                <CoachCard
                  label={`Hazme una pregunta sobre la tarjeta ${focusIndex + 1}`}
                  run={() => {
                    const v = cardView(sk, focusCard, name);
                    return guidedCoachAction(screenplayId, start, { kind: "card", title: v.title, question: v.question, text: lineOf(focusCard) });
                  }}
                />
              </div>
            )}
            {aiError && (
              <p role="alert" className="w-full text-[13px] text-danger">
                {aiError}
              </p>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button type="button" onClick={toScript} disabled={!editor} className="rounded-md bg-[#1c1b19] px-4 py-2.5 text-[14.5px] font-semibold text-white hover:bg-black disabled:opacity-50">
            {!created
              ? `Pasar al guion: crear ${sk.cards.length} ${sk.cards.length === 1 ? "escena" : "escenas"} →`
              : pendingCards.length
                ? `Crear ${pendingCards.length} ${pendingCards.length === 1 ? "escena nueva" : "escenas nuevas"} y seguir →`
                : "Seguir escribiendo →"}
          </button>
          {!created && (
            <button
              type="button"
              onClick={() => {
                if (!skeleton) save(sk);
                setStep("guion");
              }}
              className="rounded-md border border-[var(--line)] bg-white px-3.5 py-2.5 text-[14px] text-muted hover:text-fg"
            >
              Prefiero empezar con la página en blanco
            </button>
          )}
          <span className="ml-auto flex flex-wrap gap-x-4 text-[13px] text-muted">
            <button type="button" onClick={() => setStep("empezar")} className="hover:text-fg">
              ← Volver a las preguntas
            </button>
            <button type="button" onClick={() => setStep("idea")} className="hover:text-fg">
              Ver todo el desarrollo
            </button>
          </span>
        </div>
        {title === "Sin título" && (
          <p className="mt-6 text-[13px] text-muted">¿Ya sabes cómo se llama? Cambia el título pulsando en «Sin título», arriba.</p>
        )}
      </section>
    </div>
  );
}

function CardTool({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-6 w-6 place-items-center rounded text-[13px] text-muted hover:bg-black/[0.05] hover:text-fg disabled:opacity-30"
    >
      {children}
    </button>
  );
}
