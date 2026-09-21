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

const STORAGE_KEY = "taller_festival_zone";
const KIND_LABELS: Record<FestivalKind, string> = { cortos: "Cortos", largos: "Largos", doc: "Documental" };

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

function FestivalCard({ festival }: { festival: Festival }) {
  return (
    <li className="border border-line bg-bg-raised/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-bold">{festival.name}</p>
          <p className="font-mono text-xs text-muted">
            {festival.city}
            {festival.when ? ` · suele ser en ${festival.when.charAt(0).toLowerCase()}${festival.when.slice(1)}` : ""}
          </p>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {festival.kinds.map((kind) => (
            <li key={kind} className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] tracking-widest text-muted uppercase">
              {KIND_LABELS[kind]}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-2 font-sans text-sm text-muted">{festival.note}</p>
      <a
        href={festival.url}
        target="_blank"
        rel="noopener noreferrer"
        className="link-action mt-3 inline-flex"
        aria-label={`Web oficial de ${festival.name} (se abre en otra pestaña)`}
      >
        Web oficial ↗
      </a>
    </li>
  );
}

function Group({ title, festivals }: { title: string; festivals: Festival[] }) {
  if (festivals.length === 0) return null;
  return (
    <div className="mt-8">
      <p className="font-mono text-[11px] tracking-widest text-accent uppercase">{title}</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {festivals.map((f) => (
          <FestivalCard key={f.name} festival={f} />
        ))}
      </ul>
    </div>
  );
}

// Guía de festivales: eliges tu zona y ves primero los de allí, luego los del resto del país, los online y los
// buscadores de convocatorias. La zona se recuerda en este navegador. Los plazos no se guardan aquí: cambian
// cada año y hay que mirarlos en la convocatoria oficial.
export function FestivalGuide({ projectType }: { projectType: string | null }) {
  const zone = useSyncExternalStore(subscribeZone, readZone, () => "");
  const [allKinds, setAllKinds] = useState(false);

  const projectKinds = kindsForProjectType(projectType);
  const kinds = allKinds ? null : projectKinds;
  const { inZone, inCountry, elsewhere, online } = festivalsFor(zone || null, kinds);
  const country = ZONES.find((z) => z.zone === zone)?.country ?? null;

  function chooseZone(value: string) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* sin almacenamiento: no se recuerda */
    }
    window.dispatchEvent(new Event(ZONE_EVENT));
  }

  return (
    <div>
      <div className="mt-8 flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">¿Dónde vives?</span>
          <select
            value={zone}
            onChange={(e) => chooseZone(e.target.value)}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          >
            <option value="" className="bg-bg">
              Elige tu zona
            </option>
            {ZONES.map((z) => (
              <option key={z.zone} value={z.zone} className="bg-bg">
                {z.zone}
              </option>
            ))}
          </select>
        </label>
        {projectKinds && (
          <label className="flex items-center gap-2 pb-2 font-sans text-sm">
            <input
              type="checkbox"
              checked={allKinds}
              onChange={(e) => setAllKinds(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            Ver también festivales de otros formatos
          </label>
        )}
      </div>

      {!zone && (
        <p className="mt-6 max-w-xl font-sans text-sm text-muted">
          Elige tu zona y te enseño primero los festivales cercanos. Si no eliges ninguna, verás la lista completa abajo.
        </p>
      )}

      {zone && inZone.length === 0 && (
        <p className="mt-6 max-w-xl border border-dashed border-line p-4 font-sans text-sm text-muted">
          No tengo todavía festivales de {zone} en la lista para este formato. Mira los del resto de {country}, los online y
          los buscadores de convocatorias de más abajo: allí están casi todos.
        </p>
      )}

      {zone ? (
        <>
          <Group title={`En ${zone}`} festivals={inZone} />
          <Group title={`En el resto de ${country}`} festivals={inCountry} />
          <Group title="Online: valen desde cualquier sitio" festivals={online} />
          <Group title="En otros países" festivals={elsewhere} />
        </>
      ) : (
        <>
          <Group title="Online: valen desde cualquier sitio" festivals={online} />
          <Group title="Todos los festivales de la lista" festivals={elsewhere} />
        </>
      )}

      <div className="mt-10 border border-accent/40 bg-bg-raised/40 p-6">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">Buscar convocatorias abiertas</p>
        <p className="mt-2 max-w-xl font-sans text-sm text-muted">
          Las fechas de inscripción cambian cada año y los festivales que aquí no salen son muchísimos. Estas
          plataformas enseñan las convocatorias abiertas, con su plazo y su precio, y desde ellas envías tu proyecto.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {SUBMISSION_PLATFORMS.map((p) => (
            <li key={p.name} className="border border-line p-4">
              <p className="font-display text-base font-bold">{p.name}</p>
              <p className="mt-1 font-sans text-sm text-muted">{p.note}</p>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="link-action mt-3 inline-flex"
                aria-label={`Abrir ${p.name} (se abre en otra pestaña)`}
              >
                Abrir {p.name} ↗
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 border border-line p-6">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">Antes de enviar</p>
        <ul className="mt-3 grid gap-2 font-sans text-sm text-muted sm:grid-cols-2">
          <li>○ El montaje final exportado, con subtítulos en inglés si puedes.</li>
          <li>○ Sinopsis corta y larga, y la ficha técnica y artística.</li>
          <li>○ Cartel y 3-5 fotogramas o fotos de rodaje en buena calidad.</li>
          <li>○ Un enlace privado para verlo (Vimeo, YouTube no listado).</li>
          <li>○ Ojo con el estreno: muchos festivales piden que aún no esté público en internet.</li>
          <li>○ Lee las bases de cada festival: plazo, duración máxima y año de producción.</li>
        </ul>
      </div>
    </div>
  );
}
