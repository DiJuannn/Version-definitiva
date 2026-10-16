"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { DayPart, IntExt } from "@/lib/generated/prisma";
import { computeDayTimeline, formatDuration, formatHHMM, type PlanBlock, type TimedBlock, type TimedShot } from "@/lib/schedule-plan";
import { liveForecast, madridNowOn, REST_MIN_HOURS, type LiveForecast, type LiveUnit } from "@/lib/live-day";
import { addManualTake, updateClapLog } from "@/lib/actions/clapboard";
import { placeShots } from "@/lib/actions/schedule";
import { openScenePeek } from "@/components/ScenePeek";
import { ShotFrame } from "@/components/preproduccion/ShotFrame";

export type LiveTake = { id: string; sceneId: string | null; shotNumber: string | null; take: number; good: boolean; notes: string | null; at: string };

export type LiveDayData = {
  projectId: string;
  projectName: string;
  day: {
    id: string;
    dateISO: string;
    title: string;
    dateLabel: string;
    callTime: string | null;
    prepMin: number | null;
    lat: number | null;
    lng: number | null;
    locations: string[];
    blocks: PlanBlock[];
  };
  dayNumber: number;
  dayCount: number;
  days: { id: string; label: string }[];
  workdayHours: number;
  sunrise: number | null;
  next: { title: string; windows: Record<string, { first: number; last: number }> } | null;
  nextDayId: string | null;
  scenes: Record<string, { number: string; intExt: IntExt; dayPart: DayPart; location: string | null; breakdown: { name: string; category: string }[] }>;
  characters: Record<string, { name: string; actor: string | null }>;
  shots: Record<string, { lens: string | null; frame: string | null }>;
  takes: LiveTake[];
};

const INT_EXT: Record<IntExt, string> = { INT: "INT.", EXT: "EXT.", INT_EXT: "INT./EXT." };
const DAY_PART: Record<DayPart, string> = { DAY: "Día", NIGHT: "Noche", DAWN: "Amanecer", DUSK: "Atardecer" };
const isNight = (p: DayPart) => p === "NIGHT" || p === "DUSK";

const sameShot = (t: LiveTake, sceneId: string, number: string) =>
  t.sceneId === sceneId && (t.shotNumber ?? "").trim().toLowerCase() === number.trim().toLowerCase();

function Clock({ label, value, meta, tone }: { label: string; value: string; meta?: string; tone: "plan" | "real" }) {
  return (
    <div className="min-w-[9.5rem] rounded-[var(--r-md)] border border-line bg-ink-0 px-4 pt-2.5 pb-3">
      <p className="flex items-center justify-between gap-3 font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">
        <span className="flex items-center gap-1.5">
          {tone === "real" && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rec" />}
          {label}
        </span>
        {meta && <span className="tracking-normal normal-case">{meta}</span>}
      </p>
      <p className={`seg seg-display mt-1.5 text-[38px] leading-none ${tone === "real" ? "text-fg" : "text-muted"}`} data-ghost="88:88">
        {value}
      </p>
    </div>
  );
}

export function LiveDay({ data }: { data: LiveDayData }) {
  const router = useRouter();
  const [clock, setClock] = useState(() => new Date());
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<{ block: string | null; shot: string | null }>({ block: null, shot: null });

  // El reloj avanza cada 15 s y los datos (tomas de la claqueta, de otro
  // móvil) se recargan cada 30 s mientras la pestaña está a la vista.
  useEffect(() => {
    const tick = setInterval(() => setClock(new Date()), 15_000);
    const pull = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => {
      clearInterval(tick);
      clearInterval(pull);
    };
  }, [router]);

  const { day } = data;
  const timeline = useMemo(
    () => computeDayTimeline({ date: new Date(day.dateISO), callTime: day.callTime, prepMin: day.prepMin, blocks: day.blocks, lat: day.lat, lng: day.lng }),
    [day],
  );
  const nowMin = madridNowOn(day.dateISO, clock);
  const forecast = liveForecast({
    timeline,
    now: nowMin,
    workdayHours: data.workdayHours,
    next: data.next ? { timeline: { characterWindows: new Map(Object.entries(data.next.windows)) } } : null,
  });

  const workBlocks = timeline.blocks.filter((b) => b.shots.length > 0 || b.scene);
  const currentBlockId = forecast.current?.blockId ?? workBlocks[0]?.id ?? null;
  const blockId = picked.block ?? currentBlockId;
  const block = timeline.blocks.find((b) => b.id === blockId) ?? null;
  const unitById = new Map(forecast.units.map((u) => [u.id, u]));

  const refreshAfter = (p: Promise<unknown>) =>
    start(async () => {
      await p;
      router.refresh();
    });

  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date(day.dateISO));
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(clock);
  const inDays = Math.round((Date.parse(dayKey) - Date.parse(todayKey)) / 86_400_000);
  const nowLabel = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(clock);

  const meal = timeline.blocks.find((b) => b.kind === "MEAL");
  const firstWork = workBlocks[0];

  return (
    <div className="pb-16">
      {/* Cabecera: el día como titular y los dos relojes */}
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <p className="eyebrow flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{data.projectName}</span>
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1.5 text-gel-3">
              <span aria-hidden className="h-2 w-2 rounded-full bg-current" />
              Rodar
            </span>
            <span aria-hidden>·</span>
            <span>Día de rodaje</span>
          </p>
          <h1 className="poster-title mt-2 text-[44px] sm:text-[60px]">
            {day.dateLabel} · <span className="text-gel-3">{day.title}</span> de {data.dayCount}
          </h1>
          {data.days.length > 1 && (
            <nav aria-label="Jornadas" className="mt-3 flex flex-wrap gap-1.5">
              {data.days.map((d) => (
                <Link
                  key={d.id}
                  href={`/app/${data.projectId}/plan-de-rodaje/directo?dia=${d.id}`}
                  aria-current={d.id === day.id ? "page" : undefined}
                  className={`rounded-[var(--r-sm)] border px-2.5 py-1 font-sans text-[12.5px] transition-colors ${
                    d.id === day.id ? "border-gel-3 text-fg" : "border-line text-muted hover:text-fg"
                  }`}
                >
                  {d.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {forecast.started ? (
            <>
              <Clock label="Plan" meta="lo rodado" value={formatHHMM(forecast.planMark)} tone="plan" />
              <Clock label="Real" meta="en set" value={nowLabel} tone="real" />
              <DelayBadge forecast={forecast} />
            </>
          ) : (
            <>
              <Clock label="Primer plano" value={formatHHMM(timeline.firstStart)} tone="plan" />
              <div className="pb-1 font-sans text-[13.5px] leading-snug text-muted">
                {inDays > 0 ? (
                  <>
                    Se rueda {inDays === 1 ? "mañana" : `dentro de ${inDays} días`}.
                    <br />
                    Este día se sigue en directo cuando llegue.
                  </>
                ) : inDays < 0 ? (
                  "Jornada ya rodada."
                ) : (
                  <>Aún no ha empezado: primer plano a las {formatHHMM(timeline.firstStart)}.</>
                )}
              </div>
            </>
          )}
          <Link href={`/app/${data.projectId}/claqueta`} className="btn btn-primary">
            Abrir claqueta
          </Link>
        </div>
      </header>

      {/* Las horas del día en una fila */}
      <dl className="mt-7 flex flex-wrap border-y border-line font-mono text-[12px] tracking-[0.08em] uppercase">
        <Fact label="Citación" value={timeline.callTime !== null ? formatHHMM(timeline.callTime) : "por fijar"} />
        <Fact label="Primer plano" value={formatHHMM(timeline.firstStart)} />
        {meal && <Fact label="Comida" value={formatHHMM(meal.start)} />}
        <Fact label="Fin previsto" value={formatHHMM(timeline.wrap)} />
        {(data.sunrise !== null || timeline.sunset !== null) && (
          <Fact
            label="Sol"
            value={`${data.sunrise !== null ? `sale ${formatHHMM(data.sunrise)}` : ""}${data.sunrise !== null && timeline.sunset !== null ? " · " : ""}${
              timeline.sunset !== null ? `se pone ${formatHHMM(timeline.sunset)}` : ""
            }`}
          />
        )}
        {day.locations.length > 0 && <Fact label="Dónde" value={day.locations.join(" · ")} plain />}
      </dl>

      <DayLine
        timeline={timeline}
        forecast={forecast}
        scenes={data.scenes}
        selected={blockId}
        onSelect={(id) => setPicked({ block: id, shot: null })}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        {block ? (
          <BlockPanel
            key={block.id}
            data={data}
            block={block}
            index={workBlocks.indexOf(block) + 1}
            units={unitById}
            current={forecast.current}
            selectedShot={picked.shot}
            onSelectShot={(id) => setPicked({ block: block.id, shot: id })}
            pending={pending}
            run={refreshAfter}
          />
        ) : (
          <div />
        )}
        <Forecast data={data} timeline={timeline} forecast={forecast} firstWork={firstWork} pending={pending} run={refreshAfter} />
      </div>
    </div>
  );
}

function Fact({ label, value, plain }: { label: string; value: string; plain?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 py-2.5 pr-5 sm:border-r sm:border-line sm:py-3 sm:pl-4 sm:first:pl-0 sm:last:border-r-0">
      <dt className="text-muted">{label}</dt>
      <dd className={plain ? "font-sans text-[13px] tracking-normal normal-case" : "text-fg"}>{value}</dd>
    </div>
  );
}

function DelayBadge({ forecast }: { forecast: LiveForecast }) {
  if (forecast.finished) {
    return <p className="rounded-[var(--r-sm)] border border-success/50 px-2.5 py-1.5 font-mono text-[12.5px] text-success">Día rodado</p>;
  }
  const d = Math.round(forecast.delay);
  const tone = d > 15 ? "border-warn/60 text-warn" : d < -5 ? "border-success/50 text-success" : "border-line text-muted";
  return (
    <div className="pb-1">
      <p className={`rounded-[var(--r-sm)] border px-2.5 py-1 font-mono text-[14px] font-semibold ${tone}`}>
        {d > 0 ? `+${formatDuration(d)}` : d < 0 ? `−${formatDuration(-d)}` : "a tiempo"}
      </p>
      <p className="mt-1 font-mono text-[10.5px] tracking-[0.1em] text-muted uppercase">{d > 0 ? "de retraso" : d < 0 ? "adelantados" : "con el plan"}</p>
    </div>
  );
}

// La jornada de punta a punta: bloques a escala, la hora real y la luz.
function DayLine({
  timeline,
  forecast,
  scenes,
  selected,
  onSelect,
}: {
  timeline: ReturnType<typeof computeDayTimeline>;
  forecast: LiveForecast;
  scenes: LiveDayData["scenes"];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const from = Math.floor(timeline.firstStart / 60) * 60;
  const to = Math.ceil(Math.max(timeline.wrap, forecast.projectedWrap, forecast.now ?? 0) / 60) * 60;
  const span = Math.max(60, to - from);
  const pct = (m: number) => `${((Math.min(Math.max(m, from), to) - from) / span) * 100}%`;
  const hours = Array.from({ length: span / 60 + 1 }, (_, i) => from + i * 60);

  const blockState = (b: TimedBlock) => {
    const units = forecast.units.filter((u) => u.blockId === b.id);
    if (units.length === 0) return "none";
    if (units.every((u) => u.done)) return "done";
    if (forecast.current?.blockId === b.id && forecast.started) return "current";
    return "pending";
  };

  return (
    <section aria-label="La jornada" className="mt-6 rounded-[var(--r-lg)] border border-line bg-ink-1 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="poster-sub text-[19px]">
          El día, de {formatHHMM(from)} a {formatHHMM(to)}
        </h2>
        <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><span aria-hidden className="h-[3px] w-4 bg-[#8a8276]" />Día</span>
          <span className="flex items-center gap-1.5"><span aria-hidden className="h-[3px] w-4 bg-[#5b6ba8]" />Noche</span>
          {forecast.started && <span className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-[2px] bg-rec" />Ahora</span>}
          <span className="flex items-center gap-1.5 text-success">✓ Hecho</span>
        </p>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="relative min-w-[760px]">
          {/* Horas */}
          <div className="relative h-5 font-mono text-[10.5px] text-muted">
            {hours.map((h) => (
              <span key={h} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: pct(h) }}>
                {formatHHMM(h).slice(0, 2)}
              </span>
            ))}
          </div>
          <div className="relative mt-1 h-[104px] rounded-[var(--r-sm)] bg-ink-0">
            {hours.map((h) => (
              <span key={h} aria-hidden className="absolute inset-y-0 w-px bg-line/60" style={{ left: pct(h) }} />
            ))}
            {/* Sin luz natural */}
            {timeline.sunset !== null && timeline.sunset < to && (
              <span
                aria-hidden
                className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(-45deg,rgba(91,107,168,0.18)_0_6px,transparent_6px_12px)]"
                style={{ left: pct(timeline.sunset) }}
              />
            )}
            {timeline.blocks.map((b) => {
              if (b.minutes <= 0) return null;
              const state = blockState(b);
              const scene = b.scene ? scenes[b.scene.id] : b.shots[0] ? scenes[b.shots[0].sceneId] : null;
              const style = { left: pct(b.start), width: `calc(${pct(b.end)} - ${pct(b.start)} - 3px)` };
              if (b.kind === "MEAL" || b.kind === "MOVE" || b.kind === "NOTE") {
                return (
                  <div
                    key={b.id}
                    style={style}
                    className="absolute top-[34px] bottom-[34px] grid place-items-center overflow-hidden rounded-[var(--r-xs)] border border-dashed border-line font-mono text-[10px] tracking-[0.12em] text-muted uppercase"
                  >
                    {b.kind === "MEAL" ? "Comida" : b.kind === "MOVE" ? "Traslado" : (b.title ?? "Nota")}
                  </div>
                );
              }
              const night = scene ? isNight(scene.dayPart) : false;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onSelect(b.id)}
                  style={style}
                  aria-pressed={selected === b.id}
                  className={`absolute inset-y-2 overflow-hidden rounded-[var(--r-sm)] border px-2.5 py-2 text-left transition-colors ${
                    state === "current"
                      ? "border-rec bg-[color-mix(in_srgb,var(--rec)_14%,var(--ink-1))]"
                      : selected === b.id
                        ? "border-fg/50 bg-ink-2"
                        : "border-line bg-ink-1 hover:border-fg/40"
                  } ${state === "done" ? "opacity-70" : ""}`}
                >
                  <span aria-hidden className={`absolute inset-x-0 bottom-0 h-[3px] ${night ? "bg-[#5b6ba8]" : "bg-[#8a8276]"}`} />
                  <span className="flex items-center justify-between gap-2 font-mono text-[10.5px] tracking-[0.08em] text-muted uppercase">
                    <span className="truncate">
                      {night ? "☾" : "☀"} Esc {scene?.number ?? "—"} · {scene ? INT_EXT[scene.intExt] : ""}
                    </span>
                    {state === "done" && <span className="shrink-0 text-success normal-case">✓ hecho</span>}
                    {state === "current" && <span className="flex shrink-0 items-center gap-1 text-rec normal-case"><span className="h-1.5 w-1.5 rounded-full bg-rec" />en curso</span>}
                  </span>
                  <span className="poster-sub mt-1 block truncate text-[15px] leading-tight">{b.title ?? scene?.location ?? `Escena ${scene?.number ?? ""}`}</span>
                  <span className="mt-0.5 block truncate font-mono text-[10.5px] text-muted">
                    {formatHHMM(b.start)} – {formatHHMM(b.end)}
                    {b.shots.length > 0 && ` · ${b.shots.length} pl`}
                  </span>
                </button>
              );
            })}
            {forecast.started && forecast.now !== null && (
              <div aria-hidden className="pointer-events-none absolute -top-6 bottom-0 z-10 w-0" style={{ left: pct(forecast.now) }}>
                <span className="absolute top-0 -translate-x-1/2 rounded-[3px] bg-rec px-1.5 py-px font-mono text-[10.5px] font-semibold text-ink-0">
                  {formatHHMM(forecast.now)}
                </span>
                <span className="absolute top-5 bottom-0 w-[2px] -translate-x-1/2 bg-rec" />
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 font-mono text-[10.5px] text-muted">
            <span>{timeline.sunset !== null ? `Luz natural hasta las ${formatHHMM(timeline.sunset)}` : ""}</span>
            {forecast.started && !forecast.finished && (
              <span className={forecast.projectedWrap > forecast.limit ? "text-warn" : ""}>
                A este ritmo: fin {formatHHMM(forecast.projectedWrap)} →
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function BlockPanel({
  data,
  block,
  index,
  units,
  current,
  selectedShot,
  onSelectShot,
  pending,
  run,
}: {
  data: LiveDayData;
  block: TimedBlock;
  index: number;
  units: Map<string, LiveUnit>;
  current: LiveUnit | null;
  selectedShot: string | null;
  onSelectShot: (id: string) => void;
  pending: boolean;
  run: (p: Promise<unknown>) => void;
}) {
  const sceneIds = [...new Set(block.scene ? [block.scene.id] : block.shots.map((s) => s.sceneId))];
  const mainScene = data.scenes[sceneIds[0]];
  const takesOf = (s: TimedShot) => data.takes.filter((t) => sameShot(t, s.sceneId, s.number));
  const shotId =
    selectedShot ?? (current && current.blockId === block.id && current.kind === "shot" ? current.id : (block.shots.find((s) => !s.done)?.id ?? block.shots[0]?.id ?? null));
  const shot = block.shots.find((s) => s.id === shotId) ?? null;
  const done = block.shots.filter((s) => s.done).length;
  const camera = block.shots.reduce((n, s) => n + s.minutes, 0);

  return (
    <section aria-label={`Bloque ${index}`} className="min-w-0 rounded-[var(--r-lg)] border border-line bg-ink-1">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="poster-sub text-[21px] leading-tight">
            Bloque {index} · Esc {sceneIds.map((id) => data.scenes[id]?.number).join(", ")} {mainScene?.location ?? ""}
          </h2>
          <p className="mt-1 font-mono text-[11.5px] text-muted">
            {mainScene ? `${INT_EXT[mainScene.intExt]} ${DAY_PART[mainScene.dayPart]}` : ""}
            {block.shots.length > 0 && ` · ${done} de ${block.shots.length} planos en caja · ${formatDuration(camera)} de cámara`}
            {block.kind === "SCENE" && ` · escena entera · ${formatDuration(block.minutes)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/app/${data.projectId}/shot-list?vista=tecnico`} className="btn btn-outline btn-sm">
            Guion técnico
          </Link>
          {sceneIds[0] && (
            <button type="button" onClick={() => openScenePeek(sceneIds[0])} className="btn btn-outline btn-sm">
              Ficha de escena
            </button>
          )}
        </div>
      </div>

      {block.shots.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] font-sans text-[13.5px]">
            <thead>
              <tr className="border-b border-line font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
                <th className="py-2.5 pl-5 text-left font-normal">Plano</th>
                <th className="py-2.5 text-left font-normal">Descripción</th>
                <th className="py-2.5 text-left font-normal">Lente</th>
                <th className="py-2.5 text-left font-normal">Previsto</th>
                <th className="py-2.5 text-left font-normal">Tomas</th>
                <th className="py-2.5 pr-5 text-left font-normal">Estado</th>
              </tr>
            </thead>
            <tbody>
              {block.shots.map((s) => {
                const takes = takesOf(s);
                const isCurrent = current?.id === s.id;
                const extra = data.shots[s.id];
                return (
                  <tr
                    key={s.id}
                    onClick={() => onSelectShot(s.id)}
                    className={`cursor-pointer border-b border-line last:border-b-0 ${s.id === shotId ? "bg-ink-2" : "hover:bg-ink-2/60"}`}
                  >
                    <td className="py-2.5 pl-5">
                      <div className="flex items-center gap-3">
                        <span className="relative block w-16 shrink-0">
                          {extra?.frame ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={extra.frame} alt="" className="aspect-video w-16 rounded-[4px] object-cover" />
                          ) : (
                            <ShotFrame size={s.shotSize} title="" className="w-16" />
                          )}
                          {isCurrent && <span aria-hidden className="absolute -left-3 inset-y-0 w-[3px] rounded-full bg-rec" />}
                        </span>
                        <span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectShot(s.id);
                            }}
                            className="font-mono text-[13px] font-semibold"
                          >
                            {s.sceneNumber}.{s.number}
                          </button>
                          {s.shotSize && <span className="ml-2 rounded-[3px] border border-line px-1 font-mono text-[10.5px] text-muted">{s.shotSize}</span>}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-[18rem] py-2.5 pr-3">
                      <span className="line-clamp-2">{s.description ?? "—"}</span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[12px] text-muted">{extra?.lens ?? "—"}</td>
                    <td className="py-2.5 font-mono text-[12px] whitespace-nowrap text-muted">
                      {formatHHMM(s.start)} · {s.minutes} min
                    </td>
                    <td className="py-2.5 font-mono text-[12px] whitespace-nowrap">
                      {takes.length > 0 ? (
                        <>
                          T{takes[takes.length - 1].take}
                          {takes.some((t) => t.good) && <span className="text-success"> · buena</span>}
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-5 whitespace-nowrap">
                      <ShotState done={s.done} current={isCurrent} retake={false} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-6 font-sans text-[14px] text-muted">
          Esta escena se rueda entera, sin lista de planos. Para seguirla plano a plano, añade sus planos en Planos.
        </p>
      )}

      {shot && (
        <TakesPanel
          key={shot.id}
          projectId={data.projectId}
          shot={shot}
          takes={takesOf(shot)}
          breakdown={data.scenes[shot.sceneId]?.breakdown ?? []}
          pending={pending}
          run={run}
          planned={units.get(shot.id)}
        />
      )}
    </section>
  );
}

function ShotState({ done, current }: { done: boolean; current: boolean; retake: boolean }) {
  if (done) return <span className="inline-flex items-center gap-1 rounded-[var(--r-sm)] border border-success/50 px-2 py-0.5 text-[12px] text-success">✓ buena</span>;
  if (current)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border border-rec/60 px-2 py-0.5 text-[12px] text-rec">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rec" />
        en curso
      </span>
    );
  return <span className="inline-flex rounded-[var(--r-sm)] border border-line px-2 py-0.5 text-[12px] text-muted">pendiente</span>;
}

// Las tomas del plano elegido: apuntar una, marcar la buena, la nota de script.
function TakesPanel({
  projectId,
  shot,
  takes,
  breakdown,
  pending,
  run,
}: {
  projectId: string;
  shot: TimedShot;
  takes: LiveTake[];
  breakdown: { name: string; category: string }[];
  pending: boolean;
  run: (p: Promise<unknown>) => void;
  planned?: LiveUnit;
}) {
  const last = takes[takes.length - 1];
  const [note, setNote] = useState(last?.notes ?? "");
  const nextTake = (takes.reduce((n, t) => Math.max(n, t.take), 0) || 0) + 1;
  const add = (good: boolean) =>
    run(addManualTake(projectId, { sceneNumber: shot.sceneNumber, shotNumber: shot.number, take: nextTake, good }));

  return (
    <div className="grid gap-5 border-t border-line px-5 py-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">
          {shot.sceneNumber}.{shot.number} · tomas
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {takes.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={pending}
              onClick={() => run(updateClapLog(projectId, t.id, { good: !t.good }))}
              aria-pressed={t.good}
              title={t.good ? "Buena (toca para desmarcar)" : "Marcar como buena"}
              className={`grid h-12 w-11 place-items-center rounded-[var(--r-sm)] border font-mono text-[14px] leading-none ${
                t.good ? "border-success text-success" : "border-line text-muted hover:border-fg/40"
              }`}
            >
              {t.take}
              <span className="text-[11px]">{t.good ? "✓" : "·"}</span>
            </button>
          ))}
          <button type="button" disabled={pending} onClick={() => add(false)} className="btn btn-outline btn-sm h-12">
            + Toma {nextTake}
          </button>
          <button type="button" disabled={pending} onClick={() => add(true)} className="btn btn-outline btn-sm h-12">
            Buena
          </button>
        </div>
        <p className="mt-2 font-sans text-[12px] text-muted">Toca una toma para marcarla buena. Con una buena, el plano queda rodado.</p>
      </div>
      <div>
        <p className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">Nota de script</p>
        {last ? (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (last.notes ?? "") && run(updateClapLog(projectId, last.id, { notes: note.trim() || null }))}
            rows={3}
            placeholder={`Raccord, incidencias… (toma ${last.take})`}
            className="field mt-2 w-full resize-none text-[13.5px]"
          />
        ) : (
          <p className="mt-2 font-sans text-[13px] text-muted">Apunta la primera toma para escribir su nota.</p>
        )}
      </div>
      <div>
        <p className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">Desglose de la escena</p>
        {breakdown.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {breakdown.map((b) => (
              <li key={b.category + b.name} className="rounded-[var(--r-xs)] border border-line px-2 py-1 font-sans text-[12.5px]">
                {b.name} <span className="text-muted">· {b.category.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 font-sans text-[13px] text-muted">Sin desglose.</p>
        )}
      </div>
    </div>
  );
}

// «¿Qué se cae del día?»: el fin a este ritmo frente al convenio y la luz, y
// qué planos no caben, con la opción de pasarlos a la jornada siguiente.
function Forecast({
  data,
  timeline,
  forecast,
  firstWork,
  pending,
  run,
}: {
  data: LiveDayData;
  timeline: ReturnType<typeof computeDayTimeline>;
  forecast: LiveForecast;
  firstWork: TimedBlock | undefined;
  pending: boolean;
  run: (p: Promise<unknown>) => void;
}) {
  const shotsById = new Map(timeline.blocks.flatMap((b) => b.shots.map((s) => [s.id, s] as const)));
  const wrap = forecast.projectedWrap;
  const overLimit = wrap - forecast.limit;
  const exteriorDayLeft = forecast.units.some((u) => !u.done && u.exteriorDay);
  const afterSunset = forecast.sunset !== null && exteriorDayLeft ? wrap - forecast.sunset : 0;
  const start = firstWork?.start ?? timeline.firstStart;
  const end = Math.max(timeline.wrap, wrap, forecast.limit) + 10;
  const pos = (m: number) => `${Math.min(100, Math.max(0, ((m - start) / (end - start)) * 100))}%`;
  const dropIds = forecast.drops.filter((d) => shotsById.has(d.id)).map((d) => d.id);

  return (
    <aside aria-label="Previsión" className="rounded-[var(--r-lg)] border border-line bg-ink-1 p-5">
      <p className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">
        Previsión · {forecast.started ? "se recalcula con cada toma" : "según el plan"}
      </p>
      <h2 className="poster-sub mt-1.5 text-[21px]">¿Qué se cae del día?</h2>

      <p className="mt-4 font-sans text-[15.5px] leading-relaxed">
        {forecast.finished ? "Terminasteis a las " : forecast.started ? "A este ritmo terminas a las " : "El plan termina a las "}
        <span className="seg text-[20px] text-fg">{formatHHMM(wrap)}</span>
        {overLimit > 0 && (
          <>
            , <span className="text-warn">{formatDuration(overLimit)} más de jornada</span> (convenio: {data.workdayHours} h)
          </>
        )}
        {afterSunset > 0 && (
          <>
            {overLimit > 0 ? " y " : ", "}
            <span className="text-warn">{formatDuration(afterSunset)} después de la puesta de sol</span> con exteriores de día pendientes
          </>
        )}
        {overLimit <= 0 && afterSunset <= 0 && " y todo cabe en la jornada"}.
      </p>

      {forecast.rest.length > 0 && data.next && (
        <ul className="mt-3 space-y-1.5">
          {forecast.rest.slice(0, 3).map((r) => (
            <li key={r.characterId} className="rounded-[var(--r-sm)] border border-warn/40 px-3 py-2 font-sans text-[13.5px] leading-snug">
              <span className="font-semibold text-warn">{data.characters[r.characterId]?.actor ?? data.characters[r.characterId]?.name ?? "Alguien del reparto"}</span>{" "}
              tendría {formatDuration(Math.max(0, r.restMinutes))} de descanso antes del {data.next?.title}{" "}
              <span className="text-muted">(convenio: {REST_MIN_HOURS} h)</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5" aria-hidden>
        <div className="relative h-2 rounded-full bg-ink-3">
          <span className="absolute inset-y-0 left-0 rounded-full bg-fg/40" style={{ width: pos(Math.min(forecast.now ?? start, wrap)) }} />
          <span className="absolute -top-1 -bottom-1 w-[2px] bg-fg/70" style={{ left: pos(timeline.wrap) }} />
          <span className="absolute -top-1 -bottom-1 w-[2px] bg-warn" style={{ left: pos(forecast.limit) }} />
          {wrap !== timeline.wrap && <span className="absolute -top-1.5 h-5 w-[3px] rounded-full bg-rec" style={{ left: pos(wrap) }} />}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-muted">
          <span>{formatHHMM(start)} primer plano</span>
          <span>plan {formatHHMM(timeline.wrap)} · límite {formatHHMM(forecast.limit)}</span>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        {forecast.drops.length === 0 ? (
          <p className="font-sans text-[14px] text-muted">Nada se cae: a este ritmo cabe todo lo que queda.</p>
        ) : (
          <>
            <p className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">No cabe a este ritmo</p>
            <ul className="mt-2 divide-y divide-line">
              {forecast.drops.map((d) => {
                const s = shotsById.get(d.id);
                const b = timeline.blocks.find((x) => x.id === d.id);
                const scene = s ? data.scenes[s.sceneId] : b?.scene ? data.scenes[b.scene.id] : null;
                return (
                  <li key={d.id} className="flex items-start gap-3 py-2.5 font-sans text-[13.5px]">
                    <span className="font-mono text-[12.5px] font-semibold">{s ? `${s.sceneNumber}.${s.number}` : `Esc ${scene?.number ?? ""}`}</span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1">{s?.description ?? scene?.location ?? ""}</span>
                      <span className="block text-[12px] text-warn">
                        {d.reason === "light" ? "Se va la luz" : "Pasa de la jornada"} · acabaría a las {formatHHMM(d.projectedEnd)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {data.nextDayId && dropIds.length > 0 && (
              <div className="mt-3 rounded-[var(--r-md)] border border-line bg-ink-0 p-3.5">
                <p className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">Propuesta</p>
                <p className="mt-1 font-sans text-[14px] leading-snug">
                  Pasar {dropIds.length === 1 ? "este plano" : `estos ${dropIds.length} planos`} a la jornada siguiente. El plan de los dos días se recalcula y la
                  hoja de llamada avisará del cambio.
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(placeShots(data.projectId, dropIds, { kind: "newBlock", dayId: data.nextDayId! }))}
                  className="btn btn-outline btn-sm mt-3"
                >
                  {pending ? "Moviendo…" : "Pasar a la siguiente jornada"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
