"use client";

import Link from "next/link";
import { RefStrip } from "@/components/moodboard/RefStrip";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { getScenePeek, type ScenePeekData } from "@/lib/actions/scene-peek";
import { SceneProgress } from "@/components/SceneProgress";
import { ShotFrame } from "@/components/preproduccion/ShotFrame";
import { stripColor } from "@/components/preproduccion/palette";
import { SCENE_STEPS } from "@/lib/scene-status";
import type { DayPart, IntExt } from "@/lib/generated/prisma";
import { courierPrime } from "@/lib/screenplay/font";

const EVENT = "scene-peek";

// Abre la ficha rápida de una escena desde cualquier sitio del proyecto.
export function openScenePeek(sceneId: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: sceneId }));
}

// El número de una escena que, al tocarlo, abre su ficha rápida. Lleva la
// franja de color de la tira de producción (día/noche, int/ext).
export function SceneChip({
  sceneId,
  number,
  intExt,
  dayPart,
  className = "",
  children,
}: {
  sceneId: string;
  number: string;
  intExt?: IntExt;
  dayPart?: DayPart;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openScenePeek(sceneId);
      }}
      title={`Ver todo de la escena ${number}`}
      className={`group/chip inline-flex items-center gap-2 rounded-md text-left transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent ${className}`}
    >
      {intExt && dayPart && (
        <span aria-hidden className="h-[1.1em] w-1 shrink-0 rounded-full" style={{ background: stripColor(intExt, dayPart) }} />
      )}
      {children ?? <span className="poster-sub leading-none">{number}</span>}
    </button>
  );
}

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Madrid" });

// Ficha rápida de escena (como el «peek» de Linear): un panel a la derecha con
// el texto, quién sale, lo desglosado, sus planos y sus días, y el paso
// siguiente. ← → cambian de escena; Esc la cierra. No te saca de donde estás.
export function ScenePeek({ projectId }: { projectId: string }) {
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [data, setData] = useState<ScenePeekData | null>(null);
  const [pending, start] = useTransition();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const load = useCallback(
    (id: string) => {
      setSceneId(id);
      start(async () => setData(await getScenePeek(projectId, id)));
    },
    [projectId],
  );
  const close = useCallback(() => {
    setSceneId(null);
    setData(null);
    opener.current?.focus();
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      opener.current = document.activeElement as HTMLElement | null;
      load((e as CustomEvent<string>).detail);
    };
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, [load]);

  useEffect(() => {
    if (!sceneId) return;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" && data?.nextId) load(data.nextId);
      else if (e.key === "ArrowLeft" && data?.prevId) load(data.prevId);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sceneId, data, close, load]);

  if (!sceneId) return null;
  const base = `/app/${projectId}`;
  const next = data
    ? !data.status.broken
      ? { href: `${base}/desglose?escena=${data.id}`, label: "Desglosar la escena" }
      : !data.status.planned
        ? { href: `${base}/shot-list?escena=${data.id}`, label: "Planificar sus planos" }
        : !data.status.scheduled
          ? { href: `${base}/plan-de-rodaje`, label: "Darle día en el plan de rodaje" }
          : null
    : null;

  return (
    <div className="fixed inset-0 z-50 print:hidden" role="presentation">
      <button type="button" aria-label="Cerrar la ficha" onClick={close} className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={data ? `Escena ${data.number}` : "Escena"}
        className={`${courierPrime.variable} taller-desk absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col overflow-hidden border-l border-line bg-bg text-fg shadow-[-30px_0_60px_-30px_#000] outline-none motion-safe:animate-[peek-in_180ms_ease-out]`}
      >
        {/* Cabecera: número, encabezado y cómo va. */}
        <header className="border-b border-line px-6 pt-5 pb-4">
          <div className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">
            <span>Escena {data ? `${data.index + 1} de ${data.total}` : "…"}</span>
            <span className="ml-auto flex items-center gap-1">
              <button
                type="button"
                disabled={!data?.prevId}
                onClick={() => data?.prevId && load(data.prevId)}
                aria-label="Escena anterior"
                className="grid h-7 w-7 place-items-center rounded-md border border-line hover:text-fg disabled:opacity-30"
              >
                ←
              </button>
              <button
                type="button"
                disabled={!data?.nextId}
                onClick={() => data?.nextId && load(data.nextId)}
                aria-label="Escena siguiente"
                className="grid h-7 w-7 place-items-center rounded-md border border-line hover:text-fg disabled:opacity-30"
              >
                →
              </button>
              <button type="button" onClick={close} aria-label="Cerrar" className="ml-1 grid h-7 w-7 place-items-center rounded-md border border-line hover:text-fg">
                ×
              </button>
            </span>
          </div>
          {data && (
            <>
              <h2 className="mt-3 flex items-baseline gap-3">
                <span className="poster-title text-[52px]">{data.number}</span>
                <span className="font-[family-name:var(--font-courier)] text-[15px] font-bold uppercase">
                  {data.intExtLabel}. {data.location?.name ?? "sin localización"} — {data.dayPartLabel}
                </span>
              </h2>
              <div
                aria-hidden
                className="mt-2 h-1 rounded-full"
                style={{ background: stripColor(data.intExt as IntExt, data.dayPart as DayPart) }}
              />
              <ol className="mt-4 grid grid-cols-4 gap-2">
                {SCENE_STEPS.map((s) => {
                  const on = data.status[s.key];
                  return (
                    <li key={s.key} className="font-sans text-[12px] leading-tight">
                      <span className="block h-1.5 rounded-full" style={{ background: on ? s.color : "var(--line)" }} />
                      <span className={`mt-1.5 block ${on ? "text-fg" : "text-muted"}`}>
                        {on ? "✓ " : ""}
                        {s.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </header>

        <div className={`flex-1 overflow-y-auto px-6 py-5 ${pending ? "opacity-60" : ""}`}>
          {!data ? (
            <p className="font-sans text-sm text-muted">{pending ? "Cargando…" : "No se ha encontrado esta escena."}</p>
          ) : (
            <div className="space-y-7">
              {next && (
                <Link href={next.href} onClick={close} className="btn btn-primary w-full">
                  {next.label} →
                </Link>
              )}

              <section aria-labelledby="pk-texto">
                <h3 id="pk-texto" className="eyebrow">
                  {data.textSource === "guion" ? "En el guion" : "La escena"}
                </h3>
                <div className="paper mt-2 max-h-56 overflow-y-auto px-5 py-4 font-[family-name:var(--font-courier)] text-[12.5px] leading-[1.55]">
                  {data.blocks.length ? (
                    data.blocks.slice(0, 40).map((b, i) => (
                      <p
                        key={i}
                        className={`whitespace-pre-wrap ${
                          b.type === "character" ? "mt-2.5 ml-[30%] uppercase" : b.type === "dialogue" ? "mx-[12%]" : b.type === "parenthetical" ? "ml-[22%]" : "mt-2.5 first:mt-0"
                        }`}
                      >
                        {b.text}
                      </p>
                    ))
                  ) : (
                    <p className="font-sans text-sm text-muted">Sin texto todavía.</p>
                  )}
                </div>
              </section>

              <section aria-labelledby="pk-reparto">
                <h3 id="pk-reparto" className="eyebrow">Quién sale · {data.cast.length}</h3>
                {data.cast.length ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {data.cast.map((c) => (
                      <li key={c.id} className="rounded-full border border-line px-3 py-1 font-sans text-[13px]">
                        <b className="font-semibold">{c.name}</b>
                        <span className="text-muted"> · {c.actor ?? "sin actor"}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 font-sans text-sm text-muted">Nadie todavía.</p>
                )}
              </section>

              <section aria-labelledby="pk-desglose">
                <div className="flex items-baseline justify-between">
                  <h3 id="pk-desglose" className="eyebrow">Lo que hace falta</h3>
                  <Link href={`${base}/desglose?escena=${data.id}`} onClick={close} className="font-sans text-[12.5px] text-accent hover:underline">
                    Desglose →
                  </Link>
                </div>
                {data.breakdown.length ? (
                  <dl className="mt-2 space-y-1.5 font-sans text-[13.5px]">
                    {data.breakdown.map((b) => (
                      <div key={b.category} className="flex gap-3">
                        <dt className="w-24 shrink-0 text-muted">{b.label}</dt>
                        <dd>{b.items.join(", ")}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-2 font-sans text-sm text-muted">Sin desglosar.</p>
                )}
              </section>

              <section aria-labelledby="pk-planos">
                <div className="flex items-baseline justify-between">
                  <h3 id="pk-planos" className="eyebrow">Planos · {data.shots.length}</h3>
                  <Link href={`${base}/shot-list?escena=${data.id}`} onClick={close} className="font-sans text-[12.5px] text-accent hover:underline">
                    {data.shots.length ? "Planificar más →" : "Planificar →"}
                  </Link>
                </div>
                {data.shots.length ? (
                  <ul className="mt-2 divide-y divide-line">
                    {data.shots.map((sh) => (
                      <li key={sh.id}>
                        <Link href={`${base}/shot-list/${sh.id}`} onClick={close} className="group flex items-center gap-3 py-2">
                          <ShotFrame size={sh.shotSize} className="h-8 w-14 shrink-0" />
                          <span className="w-9 font-mono text-[12px] font-semibold">
                            {data.number}.{sh.number}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-sans text-[13.5px] group-hover:text-accent">
                            {sh.description ?? <span className="text-muted">Sin descripción</span>}
                          </span>
                          {sh.done && <span className="font-sans text-[11px] text-success">✓</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 font-sans text-sm text-muted">Sin planos.</p>
                )}
              </section>

              {data.visuals.length > 0 && <RefStrip refs={data.visuals} projectId={projectId} title="Cómo se ve" />}

              <section aria-labelledby="pk-dias">
                <div className="flex items-baseline justify-between">
                  <h3 id="pk-dias" className="eyebrow">Se rueda</h3>
                  <Link href={`${base}/plan-de-rodaje`} onClick={close} className="font-sans text-[12.5px] text-accent hover:underline">
                    Plan de rodaje →
                  </Link>
                </div>
                {data.days.length ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {data.days.map((d) => (
                      <li key={d.id}>
                        <Link
                          href={`${base}/plan-de-rodaje?dia=${d.id}`}
                          onClick={close}
                          className="block rounded-md border border-line px-3 py-1.5 font-sans text-[13px] hover:border-accent"
                        >
                          <b className="font-semibold">Día {d.index}</b> <span className="text-muted">· {fmtDay(d.date)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 font-sans text-sm text-muted">Sin día todavía.</p>
                )}
              </section>
            </div>
          )}
        </div>
        <footer className="hidden border-t border-line px-6 py-2.5 font-mono text-[10px] tracking-widest text-muted uppercase sm:block">
          ← → otra escena · Esc cerrar
        </footer>
      </div>
    </div>
  );
}

export { SceneProgress };
