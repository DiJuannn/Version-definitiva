"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { logClap, deleteClapLog } from "@/lib/actions/clapboard";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import { DeleteButton } from "@/components/DeleteButton";

type SceneOption = {
  id: string;
  number: string;
  intExt: string;
  dayPart: string;
  locationName: string | null;
};

type ClapLogEntry = {
  id: string;
  sceneNumber: string;
  shotNumber: string | null;
  take: number;
  director: string | null;
  camera: string | null;
  createdAt: string;
};

// Ruido percusivo sintetizado con Web Audio — sin depender de ningún
// archivo de sonido con licencia. Un estallido de ruido blanco con caída
// muy rápida suena como un "clac" seco, parecido al de una claqueta real.
function playClapSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioContextClass();
    const duration = 0.09;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.pow(1 - i / bufferSize, 4);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1, ctx.currentTime);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
    noise.stop(ctx.currentTime + duration);
    // El contexto puede haberse cerrado ya solo (algunos navegadores lo
    // hacen si la pestaña pierde foco) — cerrarlo dos veces rechaza la
    // promesa y Next.js lo muestra como un error sin capturar.
    noise.onended = () => {
      if (ctx.state !== "closed") ctx.close().catch(() => {});
    };
  } catch {
    // Si el navegador bloquea audio sin interacción previa u otra causa,
    // el clap sigue funcionando en silencio — nunca debe romper el flujo.
  }
}

export function ClaquetaBoard({
  projectId,
  projectName,
  scenes,
  lastTakeBySceneNumber,
  initialLog,
}: {
  projectId: string;
  projectName: string;
  scenes: SceneOption[];
  lastTakeBySceneNumber: Record<string, number>;
  initialLog: ClapLogEntry[];
}) {
  // Aunque el proyecto ya tenga escenas cargadas, tiene que poder
  // escribirse el número a mano — no todo el mundo rellena antes el guion.
  const [sceneEntryMode, setSceneEntryMode] = useState<"list" | "manual">(
    scenes.length > 0 ? "list" : "manual",
  );
  const [sceneId, setSceneId] = useState(scenes[0]?.id ?? "");
  const [manualSceneNumber, setManualSceneNumber] = useState("");
  const selectedScene =
    sceneEntryMode === "list" ? scenes.find((s) => s.id === sceneId) ?? null : null;
  const sceneNumber = selectedScene ? selectedScene.number : manualSceneNumber.trim();

  const [take, setTake] = useState(() =>
    sceneNumber ? (lastTakeBySceneNumber[sceneNumber] ?? 0) + 1 : 1,
  );
  const [shotNumber, setShotNumber] = useState("");
  const [director, setDirector] = useState("");
  const [camera, setCamera] = useState("");
  const [clapping, setClapping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState(initialLog);
  const today = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  function pickScene(id: string) {
    setSceneId(id);
    const scene = scenes.find((s) => s.id === id);
    const num = scene ? scene.number : "";
    setTake((lastTakeBySceneNumber[num] ?? 0) + 1);
  }

  function updateManualSceneNumber(value: string) {
    setManualSceneNumber(value);
    setTake((lastTakeBySceneNumber[value.trim()] ?? 0) + 1);
  }

  function switchToManualScene() {
    const prefill = selectedScene?.number ?? manualSceneNumber;
    setManualSceneNumber(prefill);
    setSceneEntryMode("manual");
    setTake((lastTakeBySceneNumber[prefill.trim()] ?? 0) + 1);
  }

  function switchToSceneList() {
    setSceneEntryMode("list");
    const id = sceneId || scenes[0]?.id || "";
    setSceneId(id);
    const scene = scenes.find((s) => s.id === id);
    setTake((lastTakeBySceneNumber[scene?.number ?? ""] ?? 0) + 1);
  }

  async function handleClap() {
    if (!sceneNumber || clapping) return;

    // La animación y el sonido se disparan al instante, sin esperar al
    // servidor — en un rodaje real cada milisegundo de retraso en el
    // "clac" desincroniza la marca de referencia para el montaje.
    setClapping(true);
    playClapSound();
    window.setTimeout(() => setClapping(false), 380);

    const thisTake = take;
    const optimisticId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticEntry: ClapLogEntry = {
      id: optimisticId,
      sceneNumber,
      shotNumber: shotNumber || null,
      take: thisTake,
      director: director || null,
      camera: camera || null,
      createdAt: new Date().toISOString(),
    };
    setLog((prev) => [optimisticEntry, ...prev].slice(0, 20));
    setTake(thisTake + 1);

    setSaving(true);
    const fd = new FormData();
    // sceneId solo tiene sentido si la escena viene de la lista real — si se
    // escribió a mano, sceneId puede quedar apuntando a una escena distinta.
    fd.set("sceneId", selectedScene ? sceneId : "");
    fd.set("sceneNumber", sceneNumber);
    if (shotNumber) fd.set("shotNumber", shotNumber);
    fd.set("take", String(thisTake));
    if (director) fd.set("director", director);
    if (camera) fd.set("camera", camera);
    if (selectedScene) {
      fd.set("intExt", selectedScene.intExt);
      fd.set("dayPart", selectedScene.dayPart);
    }
    const result = await logClap(projectId, fd);
    setSaving(false);

    // Sin esto, la toma recién marcada se queda para siempre con el id
    // provisional y el botón "Eliminar" nunca llega a aparecer para ella.
    if (result && "success" in result) {
      setLog((prev) =>
        prev.map((entry) => (entry.id === optimisticId ? { ...entry, id: result.id } : entry)),
      );
    } else {
      setLog((prev) => prev.filter((entry) => entry.id !== optimisticId));
    }
  }

  async function handleDeleteLog(id: string) {
    setLog((prev) => prev.filter((l) => l.id !== id));
    await deleteClapLog(projectId, id);
  }

  const intExtLabel = selectedScene
    ? INT_EXT_LABELS[selectedScene.intExt as keyof typeof INT_EXT_LABELS]
    : "—";
  const dayPartLabel = selectedScene
    ? DAY_PART_LABELS[selectedScene.dayPart as keyof typeof DAY_PART_LABELS]
    : "—";

  // Agrupa el historial por escena para que, en pleno rodaje, se distingan
  // de un vistazo las tomas de la escena de ahora mismo de las de antes. El
  // orden de los grupos sigue el orden en que aparecen en "log" (más
  // reciente primero), así que la escena que se acaba de claquetar queda
  // arriba de forma natural.
  const groupedLog: { sceneNumber: string; entries: ClapLogEntry[] }[] = [];
  for (const entry of log) {
    const group = groupedLog.find((g) => g.sceneNumber === entry.sceneNumber);
    if (group) {
      group.entries.push(entry);
    } else {
      groupedLog.push({ sceneNumber: entry.sceneNumber, entries: [entry] });
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      {/* min-w-0: sin esto, un elemento de grid no se encoge por debajo del
          ancho mínimo de su contenido y el tablero se sale de la pantalla
          en móvil. */}
      <div className="min-w-0">
        {/* El tablero va primero: es lo que se usa en rodaje, la ficha de
            ajustes es secundaria y viene después. */}
        <div>
          {/* El tablero se queda pegado arriba al hacer scroll: en un rodaje
              hay que poder claquetar sin volver a subir hasta el principio
              de la pantalla. Los ajustes de debajo sí se desplazan normal. */}
          <div className="sticky top-3 z-20 select-none sm:top-4">
            {/* Chapeta a rayas — la parte que "golpea" el tablero al claquetar. */}
            <motion.div
              animate={{ rotateX: clapping ? -38 : 0 }}
              transition={{ duration: clapping ? 0.07 : 0.28, ease: clapping ? "easeIn" : "easeOut" }}
              style={{
                transformOrigin: "top center",
                transformPerspective: 500,
                backgroundImage:
                  "repeating-linear-gradient(135deg, #f2f0ea 0 18px, #0a0a0a 18px 36px)",
              }}
              className="h-11 rounded-t-sm border-2 border-b-0 border-fg sm:h-14"
            />
            <button
              type="button"
              onClick={handleClap}
              disabled={!sceneNumber}
              className="relative block w-full border-2 border-fg bg-black px-4 py-5 text-left transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-60 sm:px-7 sm:py-7"
            >
            <div className="flex items-baseline justify-between gap-3 border-b border-fg/25 pb-3">
              <div className="min-w-0">
                <p className="font-mono text-[9px] tracking-[0.3em] text-fg/50 uppercase">
                  Producción
                </p>
                <p className="mt-0.5 truncate font-display text-sm font-bold uppercase text-fg sm:text-base">
                  {projectName}
                </p>
              </div>
              <p className="shrink-0 font-mono text-[10px] tracking-widest text-fg/50">
                {today}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 border-b border-fg/25 pb-3">
              <div className="min-w-0">
                <p className="font-mono text-[9px] tracking-[0.3em] text-fg/50 uppercase">
                  Director
                </p>
                <p className="mt-0.5 truncate font-mono text-sm text-fg">{director || "—"}</p>
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[9px] tracking-[0.3em] text-fg/50 uppercase">
                  Cámara
                </p>
                <p className="mt-0.5 truncate font-mono text-sm text-fg">{camera || "—"}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 divide-x divide-fg/25 border-b border-fg/25 pb-4">
              <div className="min-w-0 pr-2 sm:pr-4">
                <p className="font-mono text-[9px] tracking-[0.3em] text-fg/50 uppercase">
                  Escena
                </p>
                <p className="mt-1 truncate font-display text-3xl font-bold text-fg sm:text-5xl">
                  {sceneNumber || "—"}
                </p>
              </div>
              <div className="min-w-0 px-2 sm:px-4">
                <p className="font-mono text-[9px] tracking-[0.3em] text-fg/50 uppercase">
                  Plano
                </p>
                <p className="mt-1 truncate font-display text-3xl font-bold text-fg sm:text-5xl">
                  {shotNumber || "—"}
                </p>
              </div>
              <div className="min-w-0 pl-2 sm:pl-4">
                <p className="font-mono text-[9px] tracking-[0.3em] text-fg/50 uppercase">
                  Toma
                </p>
                <p className="mt-1 truncate font-display text-3xl font-bold text-accent sm:text-5xl">
                  {take}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:divide-x sm:divide-fg/25">
              <div className="sm:pr-4">
                <p className="font-mono text-[9px] tracking-[0.3em] text-fg/50 uppercase">
                  Int/Ext
                </p>
                <p className="mt-0.5 font-mono text-sm text-fg">{intExtLabel}</p>
              </div>
              <div className="sm:pl-4">
                <p className="font-mono text-[9px] tracking-[0.3em] text-fg/50 uppercase">
                  Día/Noche
                </p>
                <p className="mt-0.5 font-mono text-sm text-fg">{dayPartLabel}</p>
              </div>
            </div>

            <p className="mt-5 text-center font-mono text-[10px] tracking-[0.35em] text-fg/40 uppercase">
              {!sceneNumber ? "Elige una escena" : saving ? "Guardando…" : "Toca para claquetar"}
            </p>

            <AnimatePresence>
              {clapping && (
                <motion.div
                  initial={{ opacity: 0.9 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="pointer-events-none absolute inset-0 bg-accent"
                />
              )}
            </AnimatePresence>
          </button>
          </div>

          {/* Ficha de ajustes — mismo panel que el tablero (mismo borde,
              mismo fondo), para que se sienta como una sola pieza y no como
              dos bloques sueltos. El tablero ya se actualiza en vivo con
              estos campos según se escriben — esto solo une cómo se ven. */}
          <div className="grid gap-3 rounded-b-sm border-2 border-t-0 border-fg bg-black px-4 pt-4 pb-5 sm:grid-cols-2 sm:px-7 sm:pb-7">
          <label className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
                Escena
              </span>
              {scenes.length > 0 && (
                <button
                  type="button"
                  onClick={sceneEntryMode === "list" ? switchToManualScene : switchToSceneList}
                  className="font-mono text-[10px] tracking-widest text-muted uppercase underline-offset-2 hover:text-accent hover:underline"
                >
                  {sceneEntryMode === "list" ? "Escribir a mano" : "Elegir de la lista"}
                </button>
              )}
            </div>
            {sceneEntryMode === "list" ? (
              <select
                value={sceneId}
                onChange={(e) => pickScene(e.target.value)}
                className="w-full min-w-0 border border-line bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
              >
                {scenes.map((scene) => (
                  <option key={scene.id} value={scene.id} className="bg-bg">
                    {scene.number} — {INT_EXT_LABELS[scene.intExt as keyof typeof INT_EXT_LABELS]}
                    {" · "}
                    {DAY_PART_LABELS[scene.dayPart as keyof typeof DAY_PART_LABELS]}
                    {scene.locationName ? ` · ${scene.locationName}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={manualSceneNumber}
                onChange={(e) => updateManualSceneNumber(e.target.value)}
                placeholder="Número de escena (ej. 04)"
                autoFocus={scenes.length > 0}
                className="w-full min-w-0 border border-line bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
              />
            )}
          </label>

          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Toma
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTake((t) => Math.max(1, t - 1))}
                className="h-14 w-14 shrink-0 border border-line font-mono text-xl text-muted transition hover:border-accent hover:text-accent active:scale-95"
                aria-label="Restar toma"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                value={take}
                onChange={(e) => setTake(Math.max(1, Number(e.target.value) || 1))}
                className="h-14 w-full border border-line bg-transparent px-3 text-center font-mono text-lg outline-none transition-colors focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setTake((t) => t + 1)}
                className="h-14 w-14 shrink-0 border border-line font-mono text-xl text-muted transition hover:border-accent hover:text-accent active:scale-95"
                aria-label="Sumar toma"
              >
                +
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Plano (opcional)
            </span>
            <input
              value={shotNumber}
              onChange={(e) => setShotNumber(e.target.value)}
              placeholder="Plano (ej. 3A)"
              className="border border-line bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted uppercase">
              Director (opcional)
              {/* Aviso puramente visual: el campo ya se mantiene solo entre
                  tomas mientras no salgas de esta pantalla — este punto solo
                  lo comunica, no cambia cuándo ni cómo se recuerda. */}
              {director && (
                <span className="flex items-center gap-1 normal-case tracking-normal text-accent">
                  <span className="h-1 w-1 rounded-full bg-accent" />
                  se mantiene
                </span>
              )}
            </span>
            <input
              value={director}
              onChange={(e) => setDirector(e.target.value)}
              placeholder="Nombre del director"
              className={`border bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent ${director ? "border-accent/40" : "border-line"}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted uppercase">
              Cámara (opcional)
              {camera && (
                <span className="flex items-center gap-1 normal-case tracking-normal text-accent">
                  <span className="h-1 w-1 rounded-full bg-accent" />
                  se mantiene
                </span>
              )}
            </span>
            <input
              value={camera}
              onChange={(e) => setCamera(e.target.value)}
              placeholder="Cámara (ej. A)"
              className={`border bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent ${camera ? "border-accent/40" : "border-line"}`}
            />
          </label>
        </div>
        </div>
      </div>

      <div>
        <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
          Últimas tomas
        </p>
        {log.length === 0 ? (
          <p className="mt-3 font-mono text-xs text-muted">
            Todavía no se ha marcado ninguna toma.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {groupedLog.map((group) => {
              const isCurrentScene =
                sceneNumber !== "" && group.sceneNumber === sceneNumber;
              return (
                <div
                  key={group.sceneNumber}
                  className={`border ${isCurrentScene ? "border-accent" : "border-line"}`}
                >
                  <div
                    className={`flex items-center justify-between px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase ${
                      isCurrentScene ? "bg-accent text-bg" : "bg-bg-raised text-muted"
                    }`}
                  >
                    <span>Escena {group.sceneNumber}</span>
                    {isCurrentScene && <span>Ahora</span>}
                  </div>
                  <div className="divide-y divide-line">
                    {group.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5"
                      >
                        <div>
                          <p className="font-mono text-sm">
                            {entry.shotNumber ? `Plano ${entry.shotNumber} · ` : ""}
                            Toma {entry.take}
                          </p>
                          <p className="font-mono text-[10px] text-muted">
                            {[entry.director, entry.camera].filter(Boolean).join(" · ") || "—"}
                            {" · "}
                            {new Date(entry.createdAt).toLocaleTimeString("es-ES", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </p>
                        </div>
                        {!entry.id.startsWith("pending-") && (
                          <form action={() => handleDeleteLog(entry.id)}>
                            <DeleteButton className="font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent" />
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
