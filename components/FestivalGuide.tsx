"use client";

import { useState, useSyncExternalStore } from "react";
import {
  ZONES,
  SUBMISSION_PLATFORMS,
  festivalsFor,
  kindsForProjectType,
  type Festival,
  type FestivalKind,
} from "@/lib/festivals";
import { PREFILL_EVENT } from "@/components/FestivalSubmissionsPanel";

const STORAGE_KEY = "taller_festival_zone";
const KIND_LABELS: Record<FestivalKind, string> = {
  cortos: "Cortos",
  largos: "Largos",
  doc: "Documental",
};

// La zona se guarda en este navegador. useSyncExternalStore: en el servidor no hay zona («») y en el
// cliente se lee del almacenamiento sin descuadrar la hidratación.
const ZONE_EVENT = "taller-festival-zone";

function readZone(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && ZONES.some((z) => z.zone === stored) ? stored : "";
  } catch {
    return "";
  }
}

function subscribeZone(callback: () => void) {
  window.addEventListener(ZONE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(ZONE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function FestivalRow({
  festival,
  tracked,
}: {
  festival: Festival;
  tracked: boolean;
}) {
  return (
    <li className="flex flex-col gap-2 border-t border-line py-5 first:border-t-0 lg:[&:nth-child(2)]:border-t-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-[17px] leading-tight font-bold tracking-tight">
            {festival.name}
          </p>
          <p className="mt-1 font-sans text-[13px] text-muted">
            {festival.city}
            {festival.when
              ? ` · suele ser en ${festival.when.charAt(0).toLowerCase()}${festival.when.slice(1)}`
              : ""}
          </p>
        </div>
        <ul className="flex shrink-0 gap-1.5" aria-label="Formatos">
          {festival.kinds.map((kind) => (
            <li
              key={kind}
              className="rounded-full bg-fg/[0.06] px-2 py-0.5 font-mono text-[10px] tracking-wider text-muted uppercase"
            >
              {KIND_LABELS[kind]}
            </li>
          ))}
        </ul>
      </div>
      <p className="font-sans text-sm leading-relaxed text-muted">
        {festival.note}
      </p>
      <div className="flex items-center gap-5">
        {tracked ? (
          <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-widest text-success uppercase">
            <span aria-hidden>✓</span> En tus plazos
          </span>
        ) : (
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent(PREFILL_EVENT, {
                  detail: { festivalName: festival.name, url: festival.url },
                }),
              )
            }
            className="link-action !min-h-0 !text-accent"
          >
            + Apuntar a mis plazos
          </button>
        )}
        <a
          href={festival.url}
          target="_blank"
          rel="noopener noreferrer"
          className="link-action !min-h-0"
          aria-label={`Web oficial de ${festival.name} (se abre en otra pestaña)`}
        >
          Web oficial ↗
        </a>
      </div>
    </li>
  );
}

function Group({
  title,
  festivals,
  isTracked,
}: {
  title: string;
  festivals: Festival[];
  isTracked: (f: Festival) => boolean;
}) {
  if (festivals.length === 0) return null;
  return (
    <div className="mt-8">
      <h3 className="flex items-baseline gap-3">
        <span className="font-display text-base font-bold">{title}</span>
        <span className="font-mono text-[11px] text-muted tabular-nums">
          {festivals.length}
        </span>
      </h3>
      <ul
        className={`sheet mt-3 grid px-5 sm:px-6 ${festivals.length > 1 ? "lg:grid-cols-2 lg:gap-x-10" : ""}`}
      >
        {festivals.map((f) => (
          <FestivalRow key={f.name} festival={f} tracked={isTracked(f)} />
        ))}
      </ul>
    </div>
  );
}

type KindFilter = "proyecto" | "todos" | FestivalKind;

function matches(f: Festival, q: string) {
  if (!q) return true;
  const hay = `${f.name} ${f.city} ${f.note}`.toLocaleLowerCase("es");
  return hay.includes(q);
}

// Guía de festivales como catálogo: buscas por nombre o ciudad, filtras por
// formato y eliges tu zona para ver primero los cercanos. Cada ficha se puede
// apuntar a tus plazos de un toque. La zona se recuerda en este navegador.
// Los plazos no se guardan aquí: cambian cada año y hay que mirarlos en la
// convocatoria oficial.
export function FestivalGuide({
  projectType,
  trackedNames = [],
}: {
  projectType: string | null;
  // Festivales que ya están en tus plazos (para marcarlos en el catálogo).
  trackedNames?: string[];
}) {
  const tracked = trackedNames.map((n) => n.toLocaleLowerCase("es"));
  const isTracked = (f: Festival) => {
    const name = f.name.toLocaleLowerCase("es");
    return tracked.some(
      (t) => t === name || t.startsWith(`${name} `) || name.startsWith(`${t} `),
    );
  };
  const zone = useSyncExternalStore(subscribeZone, readZone, () => "");
  const projectKinds = kindsForProjectType(projectType);
  const [kindFilter, setKindFilter] = useState<KindFilter>(
    projectKinds ? "proyecto" : "todos",
  );
  const [query, setQuery] = useState("");

  const kinds: FestivalKind[] | null =
    kindFilter === "proyecto"
      ? projectKinds
      : kindFilter === "todos"
        ? null
        : [kindFilter];
  const raw = festivalsFor(zone || null, kinds);
  const q = query.trim().toLocaleLowerCase("es");
  const inZone = raw.inZone.filter((f) => matches(f, q));
  const inCountry = raw.inCountry.filter((f) => matches(f, q));
  const elsewhere = raw.elsewhere.filter((f) => matches(f, q));
  const online = raw.online.filter((f) => matches(f, q));
  const total =
    inZone.length + inCountry.length + elsewhere.length + online.length;
  const country = ZONES.find((z) => z.zone === zone)?.country ?? null;

  function chooseZone(value: string) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* sin almacenamiento: no se recuerda */
    }
    window.dispatchEvent(new Event(ZONE_EVENT));
  }

  const chips: { value: KindFilter; label: string }[] = [
    ...(projectKinds
      ? [
          {
            value: "proyecto" as const,
            label: `Tu formato (${projectKinds.map((k) => KIND_LABELS[k]).join(" y ")})`,
          },
        ]
      : []),
    { value: "todos", label: "Todos" },
    { value: "cortos", label: "Cortos" },
    { value: "largos", label: "Largos" },
    { value: "doc", label: "Documental" },
  ];

  return (
    <section
      aria-labelledby="guia-title"
      className="mt-16 border-t border-line pt-10"
    >
      <h2
        id="guia-title"
        className="font-display text-xl font-black tracking-tight sm:text-2xl"
      >
        Dónde presentarlo
      </h2>
      <p className="mt-1 max-w-2xl font-sans text-sm text-muted">
        Una guía de festivales para empezar. Apunta los que te interesen y mira
        su plazo en la web oficial.
      </p>

      {/* Filtros, en una fila */}
      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-4">
        <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
          <span className="eyebrow">Buscar</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre o ciudad"
            className="field w-full"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Tu zona</span>
          <select
            value={zone}
            onChange={(e) => chooseZone(e.target.value)}
            className="field min-w-52"
          >
            <option value="" className="bg-bg">
              Sin elegir
            </option>
            {ZONES.map((z) => (
              <option key={z.zone} value={z.zone} className="bg-bg">
                {z.zone}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        role="group"
        aria-label="Formato"
        className="mt-4 flex flex-wrap gap-2"
      >
        {chips.map((chip) => {
          const active = kindFilter === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={active}
              onClick={() => setKindFilter(chip.value)}
              className={`rounded-full px-3 py-1.5 font-mono text-[11px] tracking-wide uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                active
                  ? "bg-accent text-bg"
                  : "bg-fg/[0.06] text-muted hover:text-fg"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
      <p className="mt-4 font-mono text-[11px] text-muted" aria-live="polite">
        {total} festival{total === 1 ? "" : "es"}
      </p>

      {zone && inZone.length === 0 && !q && (
        <p className="mt-4 max-w-2xl border-l-2 border-warn pl-3 font-sans text-sm text-muted">
          No tengo todavía festivales de {zone} en la lista para este formato.
          Mira los del resto de {country}, los online y los buscadores de
          convocatorias de más abajo: allí están casi todos.
        </p>
      )}
      {total === 0 && q && (
        <p className="mt-6 font-sans text-sm text-muted">
          Ninguno coincide con «{query.trim()}».
        </p>
      )}

      {zone ? (
        <>
          <Group
            title={`En ${zone}`}
            festivals={inZone}
            isTracked={isTracked}
          />
          <Group
            title={`En el resto de ${country}`}
            festivals={inCountry}
            isTracked={isTracked}
          />
          <Group
            title="Online: valen desde cualquier sitio"
            festivals={online}
            isTracked={isTracked}
          />
          <Group
            title="En otros países"
            festivals={elsewhere}
            isTracked={isTracked}
          />
        </>
      ) : (
        <>
          <Group
            title="Online: valen desde cualquier sitio"
            festivals={online}
            isTracked={isTracked}
          />
          <Group
            title="Todos los festivales de la lista"
            festivals={elsewhere}
            isTracked={isTracked}
          />
        </>
      )}

      <div className="mt-16 grid gap-x-16 gap-y-12 lg:grid-cols-2">
        <section aria-labelledby="plataformas-title">
          <h3 id="plataformas-title" className="font-display text-lg font-bold">
            Buscar convocatorias abiertas
          </h3>
          <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
            Los plazos cambian cada año y hay muchísimos más festivales. Estas
            plataformas enseñan las convocatorias abiertas, con plazo y precio,
            y desde ellas se envía el proyecto.
          </p>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {SUBMISSION_PLATFORMS.map((p) => (
              <li key={p.name}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-baseline justify-between gap-4 py-3"
                  aria-label={`${p.name}: ${p.note} (se abre en otra pestaña)`}
                >
                  <span className="min-w-0">
                    <span className="block font-sans text-[15px] font-medium transition-colors group-hover:text-accent">
                      {p.name}
                    </span>
                    <span className="block font-sans text-sm text-muted">
                      {p.note}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="shrink-0 font-mono text-xs text-muted group-hover:text-accent"
                  >
                    ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="antes-title">
          <h3 id="antes-title" className="font-display text-lg font-bold">
            Antes de enviar
          </h3>
          <p className="mt-1 font-sans text-sm text-muted">
            Lo que piden casi todos.
          </p>
          <ul className="mt-4 space-y-3 font-sans text-sm leading-relaxed">
            {[
              "El montaje final exportado, con subtítulos en inglés si puedes.",
              "Sinopsis corta y larga, y la ficha técnica y artística.",
              "Cartel y 3-5 fotogramas o fotos de rodaje en buena calidad.",
              "Un enlace privado para verlo (Vimeo, YouTube no listado).",
              "Ojo con el estreno: muchos festivales piden que aún no esté público en internet.",
              "Lee las bases de cada festival: plazo, duración máxima y año de producción.",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border border-muted"
                />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
