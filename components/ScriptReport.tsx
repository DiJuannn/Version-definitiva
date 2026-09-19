"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addManualTake, deleteClapLog, updateClapLog } from "@/lib/actions/clapboard";
import type { ScriptReport as Report, ScriptTake } from "@/lib/script-report";
import { useToast } from "@/components/Toast";

const FIELD =
  "border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
}

// Parte de script de la web: tomas por día → escena → plano, con "buena" y nota
// editables, y un formulario para apuntar tomas a mano (sin usar la claqueta).
export function ScriptReport({ projectId, initial, today }: { projectId: string; initial: Report; today: string }) {
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
            takes: shot.takes.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          })),
        })),
      })),
    }));
  }

  function save(id: string, input: { good?: boolean; notes?: string | null }, revert: Partial<ScriptTake>) {
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
              shots: scene.shots.map((shot) => ({ ...shot, takes: shot.takes.filter((t) => t.id !== id) })).filter((shot) => shot.takes.length > 0),
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

  const shotsRatio = report.shotsTotal > 0 ? report.shotsWithGood / report.shotsTotal : 0;

  return (
    <div>
      <div className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line sm:grid-cols-4">
        <div className="bg-bg px-4 py-3">
          <p className="font-display text-2xl font-black tabular-nums">{totals.takes}</p>
          <p className="mt-0.5 font-mono text-[10px] tracking-widest text-muted uppercase">Tomas</p>
        </div>
        <div className="bg-bg px-4 py-3">
          <p className="font-display text-2xl font-black text-success tabular-nums">{totals.good}</p>
          <p className="mt-0.5 font-mono text-[10px] tracking-widest text-muted uppercase">Buenas</p>
        </div>
        <div className="bg-bg px-4 py-3 sm:col-span-2">
          <p className="font-display text-2xl font-black tabular-nums">
            {report.shotsWithGood}
            <span className="text-muted">/{report.shotsTotal}</span>
          </p>
          <p className="mt-0.5 font-mono text-[10px] tracking-widest text-muted uppercase">
            Planos de la shot list con toma buena
          </p>
          {report.shotsTotal > 0 && (
            <div className="mt-2 h-1 w-full bg-line">
              <div className="h-full bg-success" style={{ width: `${Math.round(shotsRatio * 100)}%` }} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Filtro de tomas">
          {[
            { v: false, label: "Todas las tomas" },
            { v: true, label: "Solo las buenas" },
          ].map((opt) => (
            <button
              key={String(opt.v)}
              type="button"
              onClick={() => setOnlyGood(opt.v)}
              aria-pressed={onlyGood === opt.v}
              className={`border px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase transition-colors ${
                onlyGood === opt.v ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-fg"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} className="btn btn-secondary btn-sm">
          {showForm ? "Cerrar" : "+ Añadir toma a mano"}
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
        <div className="mt-8 border border-dashed border-line p-8 text-center">
          <p className="font-display text-lg font-bold">Todavía no hay tomas</p>
          <p className="mx-auto mt-2 max-w-md font-mono text-xs text-muted">
            Marca tomas con la claqueta durante el rodaje y aparecerán aquí solas, o apúntalas a mano con
            &ldquo;Añadir toma a mano&rdquo;.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {[...report.days].reverse().map((day) => {
            const dayTakes = day.scenes.flatMap((sc) => sc.shots.flatMap((sh) => sh.takes));
            const dayGood = dayTakes.filter((t) => t.good).length;
            const scenes = day.scenes
              .map((scene) => ({
                ...scene,
                shots: scene.shots
                  .map((shot) => ({ ...shot, takes: onlyGood ? shot.takes.filter((t) => t.good) : shot.takes }))
                  .filter((shot) => shot.takes.length > 0),
              }))
              .filter((scene) => scene.shots.length > 0);
            if (scenes.length === 0) return null;
            return (
              <section key={day.dateKey}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-accent/40 pb-2">
                  <h2 className="font-display text-lg font-black tracking-tight uppercase">{day.label}</h2>
                  <p className="font-mono text-xs text-muted">
                    {dayTakes.length} toma{dayTakes.length === 1 ? "" : "s"} · {dayGood} buena{dayGood === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="mt-4 space-y-6">
                  {scenes.map((scene) => (
                    <div key={scene.sceneNumber} className="border border-line">
                      <div className="flex flex-wrap items-baseline justify-between gap-2 bg-bg-raised px-4 py-2">
                        <p className="font-display text-sm font-bold">Escena {scene.sceneNumber}</p>
                        {scene.context && <p className="font-mono text-[11px] text-muted">{scene.context}</p>}
                      </div>
                      <div className="divide-y divide-line">
                        {scene.shots.map((shot) => (
                          <div key={shot.key} className="px-4 py-3">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <span className="font-mono text-sm text-accent">{shot.label}</span>
                              {shot.size && <span className="font-mono text-xs uppercase">{shot.size}</span>}
                              {shot.description && <span className="font-mono text-xs text-muted">{shot.description}</span>}
                              {shot.shotNumber && !shot.inShotList && (
                                <span className="border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted">
                                  no está en la shot list
                                </span>
                              )}
                            </div>
                            <ul className="mt-2 space-y-1">
                              {shot.takes.map((take) => (
                                <li
                                  key={take.id}
                                  className={`grid grid-cols-[auto_4.5rem_3rem_1fr_auto] items-center gap-3 border-l-2 py-1.5 pl-3 ${
                                    take.good ? "border-success bg-success/5" : "border-transparent"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleGood(take)}
                                    aria-pressed={take.good}
                                    aria-label={`Toma ${take.take}: ${take.good ? "quitar de buenas" : "marcar como buena"}`}
                                    className={`flex h-6 w-6 items-center justify-center border text-xs transition-colors ${
                                      take.good
                                        ? "border-success bg-success text-bg"
                                        : "border-line text-transparent hover:border-success hover:text-success"
                                    }`}
                                  >
                                    ✓
                                  </button>
                                  <span className="font-mono text-sm">Toma {take.take}</span>
                                  <span className="font-mono text-[11px] text-muted">{timeOf(take.at)}</span>
                                  {editingNote === take.id ? (
                                    <input
                                      autoFocus
                                      defaultValue={take.notes ?? ""}
                                      placeholder="Nota (ej. se ve el micro)"
                                      onBlur={(e) => saveNote(take, e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") e.currentTarget.blur();
                                        if (e.key === "Escape") setEditingNote(null);
                                      }}
                                      className="min-w-0 border border-accent bg-transparent px-2 py-1 font-mono text-xs outline-none"
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setEditingNote(take.id)}
                                      className={`min-w-0 truncate text-left font-mono text-xs hover:text-accent ${
                                        take.notes ? "text-fg" : "text-muted"
                                      }`}
                                    >
                                      {take.notes ?? "+ nota"}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => remove(take.id)}
                                    aria-label={`Eliminar la toma ${take.take}`}
                                    className="px-1 font-mono text-[11px] text-muted hover:text-danger"
                                  >
                                    ✕
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
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
  const [sceneNumber, setSceneNumber] = useState(report.scenes[0]?.number ?? "");
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
        if (sc.sceneNumber.trim().toLowerCase() !== scene.trim().toLowerCase()) continue;
        for (const sh of sc.shots) {
          if ((sh.shotNumber ?? "").trim().toLowerCase() !== shot.trim().toLowerCase()) continue;
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
    <form onSubmit={submit} className="mt-4 grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-4">
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Escena</span>
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
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Plano</span>
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
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Toma</span>
        <input type="number" min={1} value={take} onChange={(e) => setTake(e.target.value)} required className={FIELD} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Día</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={FIELD} />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Nota</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" className={FIELD} />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 font-mono text-xs">
        <input type="checkbox" checked={good} onChange={(e) => setGood(e.target.checked)} />
        Es una toma buena
      </label>
      <div className="flex items-end gap-3">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Guardando…" : "Añadir toma"}
        </button>
      </div>
      {error && <p className="font-mono text-xs text-danger sm:col-span-2 lg:col-span-4">{error}</p>}
    </form>
  );
}
