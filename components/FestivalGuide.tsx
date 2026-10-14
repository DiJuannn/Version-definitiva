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

function FestivalRow({ festival }: { festival: Festival }) {
  return (
    <li className="border-t border-line py-4 first:border-t-0 lg:[&:nth-child(2)]:border-t-0">
      <div className="flex items-baseline justify-between gap-4">
        <p className="min-w-0 font-sans text-[15px] font-medium">{festival.name}</p>
        <a
          href={festival.url}
          target="_blank"
          rel="noopener noreferrer"
          className="link-action shrink-0 !min-h-0"
          aria-label={`Web oficial de ${festival.name} (se abre en otra pestaña)`}
        >
          Web ↗
        </a>
      </div>
      <p className="font-mono text-[11px] text-muted">
        {festival.city}
        {festival.when ? ` · suele ser en ${festival.when.charAt(0).toLowerCase()}${festival.when.slice(1)}` : ""}
        {" · "}
        {festival.kinds.map((kind) => KIND_LABELS[kind]).join(", ")}
      </p>
      <p className="mt-1.5 font-sans text-sm leading-relaxed text-muted">{festival.note}</p>
    </li>
  );
}

function Group({ title, festivals }: { title: string; festivals: Festival[] }) {
  if (festivals.length === 0) return null;
  return (
    <div className="mt-10">
      <h3 className="flex items-baseline justify-between gap-4">
        <span className="font-display text-lg font-bold">{title}</span>
        <span className="eyebrow">{festivals.length}</span>
      </h3>
      <ul className={`sheet mt-3 grid px-5 sm:px-6 ${festivals.length > 1 ? "lg:grid-cols-2 lg:gap-x-10" : ""}`}>
        {festivals.map((f) => (
          <FestivalRow key={f.name} festival={f} />
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
    <section aria-labelledby="guia-title" className="mt-20 border-t border-line pt-10">
      <h2 id="guia-title" className="font-display text-2xl font-black tracking-tight">
        Dónde presentarlo
      </h2>
      <p className="mt-1 max-w-2xl font-sans text-sm text-muted">
        Una guía de festivales para empezar. Elige tu zona y verás primero los cercanos.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-3">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">¿Dónde vives?</span>
          <select value={zone} onChange={(e) => chooseZone(e.target.value)} className="field min-w-56">
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
          <label className="flex items-center gap-2 pb-2.5 font-sans text-sm">
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

      {zone && inZone.length === 0 && (
        <p className="mt-6 max-w-2xl border-l-2 border-warn pl-3 font-sans text-sm text-muted">
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

      <div className="mt-16 grid gap-x-16 gap-y-12 lg:grid-cols-2">
        <section aria-labelledby="plataformas-title">
          <h3 id="plataformas-title" className="font-display text-lg font-bold">
            Buscar convocatorias abiertas
          </h3>
          <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
            Los plazos cambian cada año y hay muchísimos más festivales. Estas plataformas enseñan las convocatorias abiertas,
            con plazo y precio, y desde ellas se envía el proyecto.
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
                    <span className="block font-sans text-sm text-muted">{p.note}</span>
                  </span>
                  <span aria-hidden className="shrink-0 font-mono text-xs text-muted group-hover:text-accent">
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
          <p className="mt-1 font-sans text-sm text-muted">Lo que piden casi todos.</p>
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
                <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border border-muted" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
