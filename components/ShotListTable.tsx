"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import type { DayPart, IntExt } from "@/lib/generated/prisma";
import { SHOT_SIZE_NAMES } from "@/lib/labels";
import { setShotDone } from "@/lib/actions/shooting-days";
import { SceneTag, sceneStripColor } from "@/components/SceneTag";
import { PeopleStack } from "@/components/PersonInitials";
import { SubmitButton } from "@/components/SubmitButton";

export type ShotListDay = { id: string; label: string };

export type ShotListRow = {
  id: string;
  number: string;
  shotSize: string | null;
  angle: string | null;
  movement: string | null;
  lens: string | null;
  description: string | null;
  done: boolean;
  dayId: string | null;
  characters: string[];
};

export type ShotListScene = {
  id: string;
  number: string;
  intExt: IntExt;
  dayPart: DayPart;
  location: string | null;
  description: string | null;
  // Días en los que está la escena (por si el plano no tiene día propio).
  dayIds: string[];
  shots: ShotListRow[];
  addAction: (formData: FormData) => Promise<void>;
};

type Filter = "all" | "pending" | "noDay";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Sin rodar" },
  { key: "noDay", label: "Sin día" },
];

const FIELD =
  "rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-accent";
const COLS = 9;
// En pantallas estrechas solo quedan plano, tamaño, descripción y día.
const SECONDARY = new Set(["Ángulo", "Movimiento", "Lente", "Personajes"]);

// La lista de planos como una sola tabla: cada escena es una tira con su
// color de plan de rodaje y debajo sus planos, con buscador, filtros y la
// casilla de "rodado" (solo si el plano ya tiene día, como en Plan de rodaje).
export function ShotListTable({
  projectId,
  scenes,
  days,
}: {
  projectId: string;
  scenes: ShotListScene[];
  days: ShotListDay[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const dayLabel = useMemo(() => new Map(days.map((d) => [d.id, d.label])), [days]);

  const q = query.trim().toLowerCase();
  const visible = scenes
    .map((scene) => {
      const shots = scene.shots.filter((shot) => {
        const shotDays = shot.dayId ? [shot.dayId] : scene.dayIds;
        const isDone = done[shot.id] ?? shot.done;
        if (filter === "pending" && isDone) return false;
        if (filter === "noDay" && shotDays.length > 0) return false;
        if (!q) return true;
        return [`${scene.number}.${shot.number}`, shot.description, shot.shotSize, shot.movement, shot.angle, ...shot.characters]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      });
      return { scene, shots };
    })
    .filter(({ scene, shots }) => shots.length > 0 || (!q && filter === "all") || adding === scene.id);

  function toggleDone(shotId: string, value: boolean) {
    setDone((prev) => ({ ...prev, [shotId]: value }));
    startTransition(async () => {
      const ok = await setShotDone(projectId, shotId, value);
      if (!ok) setDone((prev) => ({ ...prev, [shotId]: !value }));
    });
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line px-3 text-muted transition-colors focus-within:border-accent sm:max-w-xs">
          <span aria-hidden>⌕</span>
          <span className="sr-only">Buscar plano</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar plano o personaje…"
            className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted"
          />
        </label>
        <div role="group" aria-label="Filtrar planos" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`h-8 rounded-full border px-3 text-[13px] transition-colors ${
                filter === f.key
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line text-fg/80 hover:border-accent/60 hover:text-fg"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-bg-raised/40">
        <table className="w-full min-w-[34rem] border-collapse text-sm md:min-w-[60rem]">
          <thead>
            <tr className="text-left text-xs text-muted">
              {["Rodado", "Plano", "Tamaño", "Ángulo", "Movimiento", "Lente", "Descripción", "Personajes", "Rodaje"].map(
                (h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={`border-b border-line bg-bg-raised px-3 py-2.5 font-medium whitespace-nowrap ${
                      i === 0 ? "w-12 text-center" : ""
                    } ${h === "Descripción" ? "w-[30%]" : ""} ${SECONDARY.has(h) ? "hidden md:table-cell" : ""}`}
                  >
                    {i === 0 ? <span className="sr-only">{h}</span> : h}
                    {i === 0 && <span aria-hidden>✓</span>}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={COLS} className="px-3 py-8 text-center text-muted">
                  Ningún plano coincide con la búsqueda.
                </td>
              </tr>
            )}
            {visible.map(({ scene, shots }) => (
              <Fragment key={scene.id}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={COLS}
                    className="border-b border-line bg-bg-raised/90 p-0 text-left font-normal"
                  >
                    <div
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-4 px-3 py-2.5"
                      style={{ borderLeftColor: sceneStripColor(scene.intExt, scene.dayPart) }}
                    >
                      <span className="min-w-6 font-mono text-[0.9375rem] font-medium">{scene.number}</span>
                      <SceneTag intExt={scene.intExt} dayPart={scene.dayPart} />
                      {scene.location && <span className="font-semibold">{scene.location}</span>}
                      {scene.description && <span className="text-fg/75">{scene.description}</span>}
                      <span className="ml-auto text-[13px] text-muted">
                        {scene.shots.length} plano{scene.shots.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </th>
                </tr>
                {shots.map((shot) => {
                  const shotDays = shot.dayId ? [shot.dayId] : scene.dayIds;
                  const isDone = done[shot.id] ?? shot.done;
                  const sizeName = shot.shotSize ? SHOT_SIZE_NAMES[shot.shotSize.trim().toUpperCase()] : undefined;
                  const href = `/app/${projectId}/shot-list/${shot.id}`;
                  return (
                    <tr
                      key={shot.id}
                      className={`group border-b border-line/60 transition-colors hover:bg-accent/5 ${isDone ? "text-muted" : ""}`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isDone}
                          disabled={!shot.dayId}
                          onChange={(e) => toggleDone(shot.id, e.target.checked)}
                          aria-label={`Plano ${scene.number}.${shot.number} rodado`}
                          title={shot.dayId ? "Rodado" : "Asígnale un día en Plan de rodaje para marcarlo rodado"}
                          className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Link href={href} className="font-mono text-[13px] text-fg hover:text-accent">
                          {scene.number}.{shot.number}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {shot.shotSize ? (
                          <span className="inline-flex items-baseline gap-1.5">
                            <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-xs text-fg">
                              {shot.shotSize}
                            </span>
                            {sizeName && <span className="hidden text-[13px] text-muted sm:inline">{sizeName}</span>}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="hidden px-3 py-2.5 md:table-cell">{shot.angle ?? <span className="text-muted">—</span>}</td>
                      <td className="hidden px-3 py-2.5 md:table-cell">{shot.movement ?? <span className="text-muted">—</span>}</td>
                      <td className="hidden px-3 py-2.5 font-mono text-[13px] whitespace-nowrap text-muted md:table-cell">
                        {shot.lens ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link href={href} className={`hover:text-accent ${isDone ? "line-through decoration-muted/60" : ""}`}>
                          {shot.description || <span className="text-muted">Sin descripción</span>}
                        </Link>
                      </td>
                      <td className="hidden px-3 py-2.5 md:table-cell">
                        <PeopleStack names={shot.characters} />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {shotDays.length > 0 ? (
                          <span className="inline-flex flex-wrap gap-1">
                            {shotDays.map((id) => (
                              <span key={id} className="inline-flex h-6 items-center rounded-full bg-accent/15 px-2 text-xs text-fg">
                                {dayLabel.get(id) ?? "Día"}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="inline-flex h-6 items-center rounded-full bg-warn/15 px-2 text-xs text-warn">
                            Sin día
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-b border-line print:hidden">
                  <td colSpan={COLS} className="px-3 py-1.5 pl-6">
                    {adding === scene.id ? (
                      <form
                        action={async (formData) => {
                          await scene.addAction(formData);
                        }}
                        className="flex flex-wrap items-end gap-2 py-2"
                      >
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-muted">Nº de plano</span>
                          <input name="number" required autoFocus className={`${FIELD} w-24`} />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-muted">Tamaño</span>
                          <input name="shotSize" placeholder="PG, PM, PP…" className={`${FIELD} w-32`} />
                        </label>
                        <label className="flex min-w-48 flex-1 flex-col gap-1">
                          <span className="text-xs text-muted">Descripción</span>
                          <input name="description" className={FIELD} />
                        </label>
                        <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido" className="btn btn-primary btn-sm">
                          Añadir plano
                        </SubmitButton>
                        <button type="button" onClick={() => setAdding(null)} className="link-action">
                          Cerrar
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAdding(scene.id)}
                        className="link-action"
                      >
                        + Añadir plano a la escena {scene.number}
                      </button>
                    )}
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
