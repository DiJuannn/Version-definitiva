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
  take: number;
  roll: string | null;
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
  scenes,
  lastTakeBySceneNumber,
  initialLog,
}: {
  projectId: string;
  scenes: SceneOption[];
  lastTakeBySceneNumber: Record<string, number>;
  initialLog: ClapLogEntry[];
}) {
  const [sceneId, setSceneId] = useState(scenes[0]?.id ?? "");
  const [manualSceneNumber, setManualSceneNumber] = useState("");
  const selectedScene = scenes.find((s) => s.id === sceneId) ?? null;
  const sceneNumber = selectedScene ? selectedScene.number : manualSceneNumber.trim();

  const [take, setTake] = useState(() =>
    sceneNumber ? (lastTakeBySceneNumber[sceneNumber] ?? 0) + 1 : 1,
  );
  const [roll, setRoll] = useState("");
  const [camera, setCamera] = useState("");
  const [clapping, setClapping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState(initialLog);

  function pickScene(id: string) {
    setSceneId(id);
    const scene = scenes.find((s) => s.id === id);
    const num = scene ? scene.number : manualSceneNumber.trim();
    setTake((lastTakeBySceneNumber[num] ?? 0) + 1);
  }

  function updateManualSceneNumber(value: string) {
    setManualSceneNumber(value);
    setTake((lastTakeBySceneNumber[value.trim()] ?? 0) + 1);
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
    const optimisticEntry: ClapLogEntry = {
      id: `pending-${Date.now()}`,
      sceneNumber,
      take: thisTake,
      roll: roll || null,
      camera: camera || null,
      createdAt: new Date().toISOString(),
    };
    setLog((prev) => [optimisticEntry, ...prev].slice(0, 20));
    setTake(thisTake + 1);

    setSaving(true);
    const fd = new FormData();
    fd.set("sceneId", sceneId);
    fd.set("sceneNumber", sceneNumber);
    fd.set("take", String(thisTake));
    if (roll) fd.set("roll", roll);
    if (camera) fd.set("camera", camera);
    if (selectedScene) {
      fd.set("intExt", selectedScene.intExt);
      fd.set("dayPart", selectedScene.dayPart);
    }
    await logClap(projectId, fd);
    setSaving(false);
  }

  async function handleDeleteLog(id: string) {
    setLog((prev) => prev.filter((l) => l.id !== id));
    await deleteClapLog(projectId, id);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Escena
            </span>
            {scenes.length > 0 ? (
              <select
                value={sceneId}
                onChange={(e) => pickScene(e.target.value)}
                className="border border-line bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
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
                className="border border-line bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
              />
            )}
          </label>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Toma
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTake((t) => Math.max(1, t - 1))}
                className="h-[42px] w-11 shrink-0 border border-line font-mono text-lg text-muted transition hover:border-accent hover:text-accent active:scale-95"
                aria-label="Restar toma"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                value={take}
                onChange={(e) => setTake(Math.max(1, Number(e.target.value) || 1))}
                className="w-full border border-line bg-transparent px-3 py-2.5 text-center font-mono text-lg outline-none transition-colors focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setTake((t) => t + 1)}
                className="h-[42px] w-11 shrink-0 border border-line font-mono text-lg text-muted transition hover:border-accent hover:text-accent active:scale-95"
                aria-label="Sumar toma"
              >
                +
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Rollo / cámara (opcional)
            </span>
            <input
              value={roll}
              onChange={(e) => setRoll(e.target.value)}
              placeholder="Rollo"
              className="border border-line bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 sm:mt-[22px]">
            <input
              value={camera}
              onChange={(e) => setCamera(e.target.value)}
              placeholder="Cámara (ej. A)"
              className="border border-line bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>
        </div>

        <div className="relative mt-8 select-none">
          {/* Barra superior: la "chapeta" que golpea el tablero al hacer clap. */}
          <motion.div
            animate={{ rotateX: clapping ? -38 : 0 }}
            transition={{ duration: clapping ? 0.07 : 0.28, ease: clapping ? "easeIn" : "easeOut" }}
            style={{ transformOrigin: "top center", transformPerspective: 400 }}
            className="h-10 border border-b-0 border-line bg-bg-raised"
          />
          <button
            type="button"
            onClick={handleClap}
            disabled={!sceneNumber}
            className="relative flex w-full flex-col items-center justify-center gap-2 border border-line bg-bg-raised px-6 py-14 text-center transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 sm:py-20"
          >
            <span className="font-display text-4xl font-bold uppercase tracking-wide sm:text-5xl">
              {sceneNumber ? `Esc. ${sceneNumber} · Toma ${take}` : "Elige una escena"}
            </span>
            <span className="font-mono text-xs tracking-[0.3em] text-muted uppercase">
              {saving ? "Guardando…" : "Toca para claquetar"}
            </span>
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
          <div className="mt-3 border-t border-line">
            {log.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 border-b border-line py-2.5"
              >
                <div>
                  <p className="font-mono text-sm">
                    Esc. {entry.sceneNumber} · Toma {entry.take}
                  </p>
                  <p className="font-mono text-[10px] text-muted">
                    {[entry.roll, entry.camera].filter(Boolean).join(" · ") || "—"}
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
        )}
      </div>
    </div>
  );
}
