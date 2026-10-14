"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addManualTake,
  deleteClapLog,
  updateClapLog,
} from "@/lib/actions/clapboard";
import type { ScriptReport as Report, ScriptTake } from "@/lib/script-report";
import { useToast } from "@/components/Toast";

const FIELD = "field px-3 py-2 text-sm";

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

// Parte de script de la web: tomas por día → escena → plano, con "buena" y nota
// editables, y un formulario para apuntar tomas a mano (sin usar la claqueta).
export function ScriptReport({
  projectId,
  initial,
  today,
}: {
  projectId: string;
  initial: Report;
  today: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [report, setReport] = useState(initial);
  const [onlyGood, setOnlyGood] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [, startTransition] = useTransition();

  // Tras añadir una toma, router.refresh() trae datos nuevos del servidor: se adoptan al llegar.
  const [seenInitial, setSeenInitial] = useState(initial);
  if (initial !== seenInitial) {
    setSeenInitial(initial);
    setReport(initial);
  }

  const totals = useMemo(() => {
    let takes = 0;
    let good = 0;
    for (const day of report.days)
      for (const scene of day.scenes)
        for (const shot of scene.shots) {
          takes += shot.takes.length;
          good += shot.takes.filter((t) => t.good).length;
        }
    return { takes, good };
  }, [report]);

  function patchTake(id: string, patch: Partial<ScriptTake>) {
    setReport((prev) => ({
      ...prev,
      days: prev.days.map((day) => ({
        ...day,
        scenes: day.scenes.map((scene) => ({
          ...scene,
          shots: scene.shots.map((shot) => ({
            ...shot,
            takes: shot.takes.map((t) =>
              t.id === id ? { ...t, ...patch } : t,
            ),
          })),
        })),
      })),
    }));
  }

  function save(
    id: string,
    input: { good?: boolean; notes?: string | null },
    revert: Partial<ScriptTake>,
  ) {
    startTransition(async () => {
      let ok = false;
      try {
        ok = await updateClapLog(projectId, id, input);
      } catch {
        ok = false;
      }
      if (!ok) {
        patchTake(id, revert);
        toast("error", "No se pudo guardar el cambio.");
      } else if (input.good !== undefined) {
        router.refresh(); // el plano pasa a "rodado" en el plan
      }
    });
  }

  function toggleGood(take: ScriptTake) {
    patchTake(take.id, { good: !take.good });
    save(take.id, { good: !take.good }, { good: take.good });
  }

  function saveNote(take: ScriptTake, value: string) {
    setEditingNote(null);
    const notes = value.trim() || null;
    if (notes === take.notes) return;
    patchTake(take.id, { notes });
    save(take.id, { notes }, { notes: take.notes });
  }

  function remove(id: string) {
    setReport((prev) => ({
      ...prev,
      days: prev.days
        .map((day) => ({
          ...day,
          scenes: day.scenes
            .map((scene) => ({
              ...scene,
              shots: scene.shots
                .map((shot) => ({
                  ...shot,
                  takes: shot.takes.filter((t) => t.id !== id),
                }))
                .filter((shot) => shot.takes.length > 0),
            }))
            .filter((scene) => scene.shots.length > 0),
        }))
        .filter((day) => day.scenes.length > 0),
    }));
    startTransition(async () => {
      await deleteClapLog(projectId, id);
      router.refresh();
    });
  }

  const shotsRatio =
    report.shotsTotal > 0 ? report.shotsWithGood / report.shotsTotal : 0;

  // Planos de la shot list que aún no tienen ninguna toma rodeada.
  const missingGood = useMemo(() => {
    const good = new Set<string>();
    for (const day of report.days)
      for (const scene of day.scenes)
        for (const shot of scene.shots)
          if (shot.shotNumber && shot.takes.some((t) => t.good))
            good.add(
              `${scene.sceneNumber.trim().toLowerCase()}|${shot.shotNumber.trim().toLowerCase()}`,
            );
    const missing: string[] = [];
    for (const scene of report.scenes)
      for (const shot of scene.shots)
        if (
          !good.has(
            `${scene.number.trim().toLowerCase()}|${shot.number.trim().toLowerCase()}`,
          )
        )
          missing.push(`${scene.number}.${shot.number}`);
    return missing;
  }, [report]);

  return (
    <div>
      {/* Cómo voy: tomas, buenas y lo que falta por tener bueno. */}
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div className="max-w-2xl">
          <p className="font-sans text-[15px] leading-relaxed text-muted">
            <strong className="font-semibold text-fg">
              {totals.takes} {totals.takes === 1 ? "toma" : "tomas"}
            </strong>
            {" · "}
            <strong className="font-semibold text-success">
              {totals.good} {totals.good === 1 ? "buena" : "buenas"}
            </strong>{" "}
            (las rodeadas)
            {report.shotsTotal > 0 && (
              <>
                {" · "}
                <strong className="font-semibold text-fg">
                  {report.shotsWithGood} de {report.shotsTotal}
                </strong>{" "}
                planos de la shot list ya tienen toma buena
              </>
            )}
            .
          </p>
          {report.shotsTotal > 0 && (
            <div
              className="mt-2.5 h-1 w-full max-w-md overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-label="Planos con toma buena"
              aria-valuemin={0}
              aria-valuemax={report.shotsTotal}
              aria-valuenow={report.shotsWithGood}
            >
              <div
                className="h-full bg-success"
                style={{ width: `${Math.round(shotsRatio * 100)}%` }}
              />
            </div>
          )}
          {missingGood.length > 0 && totals.takes > 0 && (
            <p className="mt-4 border-l-2 border-warn pl-3 font-sans text-sm">
              <span className="font-semibold text-warn">
                Sin toma buena todavía:
              </span>{" "}
              <span className="font-mono text-[13px]">
                {missingGood.slice(0, 12).join(" · ")}
                {missingGood.length > 12
                  ? ` y ${missingGood.length - 12} más`
                  : ""}
              </span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
          className="btn btn-primary"
        >
          {showForm ? "Cerrar" : "+ Apuntar toma a mano"}
        </button>
      </div>

      {showForm && (
        <ManualForm
          projectId={projectId}
          report={report}
          today={today}
          onAdded={() => {
            toast("success", "Toma añadida");
            router.refresh();
          }}
        />
      )}

      {report.days.length === 0 ? (
        <div className="mt-14 py-10 text-center">
          <p className="font-display text-lg font-bold">Todavía no hay tomas</p>
          <p className="mx-auto mt-2 max-w-md font-sans text-sm text-muted">
            Marca tomas con la claqueta durante el rodaje y aparecerán aquí
            solas, o apúntalas a mano con &ldquo;Apuntar toma a mano&rdquo;.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
            <div
              className="inline-flex rounded-full bg-fg/[0.06] p-1"
              role="group"
              aria-label="Filtro de tomas"
            >
              {[
                { v: false, label: "Todas las tomas" },
                { v: true, label: "Solo las buenas" },
              ].map((opt) => (
                <button
                  key={String(opt.v)}
                  type="button"
                  onClick={() => setOnlyGood(opt.v)}
                  aria-pressed={onlyGood === opt.v}
                  className={`rounded-full px-4 py-1.5 font-mono text-[11px] tracking-widest uppercase transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                    onlyGood === opt.v
                      ? "bg-bg-raised text-fg shadow-sm"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="flex items-center gap-2 font-sans text-sm text-muted">
              <span
                aria-hidden
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-success font-mono text-xs font-bold text-success"
              >
                2
              </span>
              Toca el número de una toma para rodearla (buena).
            </p>
          </div>

          <div className="mt-6 space-y-10">
            {[...report.days].reverse().map((day) => {
              const dayTakes = day.scenes.flatMap((sc) =>
                sc.shots.flatMap((sh) => sh.takes),
              );
              const dayGood = dayTakes.filter((t) => t.good).length;
              const scenes = day.scenes
                .map((scene) => ({
                  ...scene,
                  shots: scene.shots
                    .map((shot) => ({
                      ...shot,
                      takes: onlyGood
                        ? shot.takes.filter((t) => t.good)
                        : shot.takes,
                    }))
                    .filter((shot) => shot.takes.length > 0),
                }))
                .filter((scene) => scene.shots.length > 0);
              if (scenes.length === 0) return null;
              return (
                // Cada día, una hoja del parte: papel, como la que lleva la
                // script en la carpeta.
                <section
                  key={day.dateKey}
                  aria-label={`Parte del ${day.label}`}
                  className="paper px-4 py-6 sm:px-8 sm:py-8"
                >
                  <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-b-4 border-fg pb-3">
                    <div>
                      <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                        Parte de script
                      </p>
                      <h2 className="mt-1 font-display text-2xl leading-none font-black tracking-tight uppercase">
                        {day.label}
                      </h2>
                    </div>
                    <p className="font-mono text-xs text-muted">
                      {dayTakes.length} toma{dayTakes.length === 1 ? "" : "s"} ·{" "}
                      {dayGood} buena{dayGood === 1 ? "" : "s"}
                    </p>
                  </header>

                  {/* Cabecera de columnas (solo escritorio). */}
                  <div
                    aria-hidden
                    className="hidden grid-cols-[5.5rem_3rem_3.5rem_5rem_minmax(0,1fr)_2rem] gap-x-4 border-b border-line pt-4 pb-2 sm:grid"
                  >
                    {["Plano", "Toma", "Hora", "Clip", "Nota", ""].map(
                      (h, i) => (
                        <span key={i} className="eyebrow">
                          {h}
                        </span>
                      ),
                    )}
                  </div>

                  {scenes.map((scene) => (
                    <div key={scene.sceneNumber} className="mt-5 first:mt-4">
                      <h3 className="flex flex-wrap items-baseline gap-x-3 border-b-2 border-fg pb-1">
                        <span className="font-display text-lg font-black">
                          Escena {scene.sceneNumber}
                        </span>
                        {scene.context && (
                          <span className="font-mono text-[11px] tracking-wider text-muted uppercase">
                            {scene.context}
                          </span>
                        )}
                      </h3>
                      {scene.shots.map((shot) => (
                        <div
                          key={shot.key}
                          className="border-b border-line sm:grid sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-x-4"
                        >
                          <div className="pt-2.5 pb-1 sm:pb-2.5">
                            <p className="font-mono text-sm font-semibold">
                              {shot.label}
                              {shot.size && (
                                <span className="ml-1.5 font-normal text-muted uppercase">
                                  {shot.size}
                                </span>
                              )}
                            </p>
                            {shot.description && (
                              <p className="mt-0.5 font-sans text-xs leading-snug text-muted sm:line-clamp-3">
                                {shot.description}
                              </p>
                            )}
                            {shot.shotNumber && !shot.inShotList && (
                              <p className="mt-0.5 font-mono text-[10px] text-warn">
                                no está en la shot list
                              </p>
                            )}
                          </div>
                          <ul className="pb-1.5 sm:py-1.5">
                            {shot.takes.map((take) => (
                              <li
                                key={take.id}
                                className={`grid grid-cols-[3rem_minmax(0,1fr)_2rem] items-center gap-x-4 rounded-md py-1 sm:grid-cols-[3rem_3.5rem_5rem_minmax(0,1fr)_2rem] ${
                                  take.good ? "bg-success/10" : ""
                                }`}
                              >
                                {/* El círculo de la script: la toma buena va rodeada. */}
                                <button
                                  type="button"
                                  onClick={() => toggleGood(take)}
                                  aria-pressed={take.good}
                                  aria-label={`Toma ${take.take}: ${take.good ? "quitar de buenas" : "marcar como buena"}`}
                                  title={
                                    take.good
                                      ? "Toma buena (rodeada)"
                                      : "Marcar como buena"
                                  }
                                  className={`row-span-2 mx-auto flex h-9 w-9 sm:row-span-1 items-center justify-center rounded-full font-mono text-base tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${
                                    take.good
                                      ? "border-[2.5px] border-success font-bold text-success"
                                      : "border-2 border-transparent text-fg hover:border-dashed hover:border-success/60"
                                  }`}
                                >
                                  {take.take}
                                </button>
                                <span className="font-mono text-xs text-muted tabular-nums sm:text-sm sm:text-fg">
                                  {timeOf(take.at)}
                                  <span className="sm:hidden">
                                    {take.clip ? ` · ${take.clip}` : ""}
                                  </span>
                                </span>
                                <span
                                  className="hidden truncate font-mono text-xs text-muted sm:block"
                                  title="Archivo de la cámara"
                                >
                                  {take.clip ?? "—"}
                                </span>
                                <span className="col-start-2 row-start-2 min-w-0 sm:col-start-auto sm:row-start-auto">
                                  {editingNote === take.id ? (
                                    <input
                                      autoFocus
                                      defaultValue={take.notes ?? ""}
                                      aria-label={`Nota de la toma ${take.take}`}
                                      placeholder="Nota (ej. se ve el micro)"
                                      onBlur={(e) =>
                                        saveNote(take, e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter")
                                          e.currentTarget.blur();
                                        if (e.key === "Escape")
                                          setEditingNote(null);
                                      }}
                                      className="field-line w-full font-sans text-sm"
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setEditingNote(take.id)}
                                      className={`w-full truncate rounded text-left font-sans text-sm hover:text-accent focus-visible:outline-2 focus-visible:outline-accent ${
                                        take.notes ? "text-fg" : "text-muted/70"
                                      }`}
                                    >
                                      {take.notes ?? "+ nota"}
                                    </button>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => remove(take.id)}
                                  aria-label={`Eliminar la toma ${take.take}`}
                                  className="col-start-3 row-start-1 justify-self-end rounded px-1.5 py-1 font-mono text-[11px] text-muted hover:text-danger focus-visible:outline-2 focus-visible:outline-accent sm:col-start-auto sm:row-start-auto"
                                >
                                  ✕
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ManualForm({
  projectId,
  report,
  today,
  onAdded,
}: {
  projectId: string;
  report: Report;
  today: string;
  onAdded: () => void;
}) {
  const [sceneNumber, setSceneNumber] = useState(
    report.scenes[0]?.number ?? "",
  );
  const [shotNumber, setShotNumber] = useState("");
  const [take, setTake] = useState("1");
  const [date, setDate] = useState(today);
  const [good, setGood] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sceneOption = report.scenes.find((s) => s.number === sceneNumber);

  // Siguiente toma para esa escena y plano, mirando todas las ya apuntadas.
  function nextTake(scene: string, shot: string) {
    let max = 0;
    for (const day of report.days)
      for (const sc of day.scenes) {
        if (sc.sceneNumber.trim().toLowerCase() !== scene.trim().toLowerCase())
          continue;
        for (const sh of sc.shots) {
          if (
            (sh.shotNumber ?? "").trim().toLowerCase() !==
            shot.trim().toLowerCase()
          )
            continue;
          for (const t of sh.takes) max = Math.max(max, t.take);
        }
      }
    return max + 1;
  }

  function changeScene(value: string) {
    setSceneNumber(value);
    setTake(String(nextTake(value, shotNumber)));
  }
  function changeShot(value: string) {
    setShotNumber(value);
    setTake(String(nextTake(sceneNumber, value)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const result = await addManualTake(projectId, {
        sceneNumber,
        shotNumber: shotNumber.trim() || null,
        take: Number(take),
        good,
        notes: notes.trim() || null,
        date,
      });
      if (!result.ok) {
        setError(result.error);
      } else {
        setNotes("");
        setGood(false);
        setTake(String(Number(take) + 1));
        onAdded();
      }
    } catch {
      setError("No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="paper mt-6 grid gap-4 p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-4"
    >
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Escena
        </span>
        <input
          list="script-scenes"
          value={sceneNumber}
          onChange={(e) => changeScene(e.target.value)}
          required
          className={FIELD}
        />
        <datalist id="script-scenes">
          {report.scenes.map((s) => (
            <option key={s.number} value={s.number}>
              {s.context ?? ""}
            </option>
          ))}
        </datalist>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Plano
        </span>
        <input
          list="script-shots"
          value={shotNumber}
          onChange={(e) => changeShot(e.target.value)}
          placeholder="Opcional"
          className={FIELD}
        />
        <datalist id="script-shots">
          {(sceneOption?.shots ?? []).map((s) => (
            <option key={s.number} value={s.number}>
              {[s.size, s.description].filter(Boolean).join(" · ")}
            </option>
          ))}
        </datalist>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Toma
        </span>
        <input
          type="number"
          min={1}
          value={take}
          onChange={(e) => setTake(e.target.value)}
          required
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Día
        </span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Nota
        </span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Opcional"
          className={FIELD}
        />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 font-mono text-xs">
        <input
          type="checkbox"
          checked={good}
          onChange={(e) => setGood(e.target.checked)}
        />
        Es una toma buena
      </label>
      <div className="flex items-end gap-3">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Guardando…" : "Añadir toma"}
        </button>
      </div>
      {error && (
        <p className="font-mono text-xs text-danger sm:col-span-2 lg:col-span-4">
          {error}
        </p>
      )}
    </form>
  );
}
