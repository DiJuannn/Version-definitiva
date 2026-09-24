"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { logClap, deleteClapLog, updateClapLog } from "@/lib/actions/clapboard";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import { nextClip, takeKey } from "@/lib/clip-number";
import { DeleteButton } from "@/components/DeleteButton";
import { useToast } from "@/components/Toast";

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
  clip?: string | null;
  // Parte de script: toma buena y nota.
  good?: boolean;
  notes?: string | null;
  createdAt: string;
  // La toma se marcó en pantalla pero el servidor no llegó a guardarla.
  failed?: boolean;
};

// Lo que tarda la chapeta en cerrarse — el golpe (sonido y destello) cae
// justo al final, para que en cámara el fotograma del cierre y el pico de
// audio coincidan y el montador los pueda sincronizar sin aplausos extra.
const CLOSE_MS = 70;
// Cuánto se queda cerrada antes de volver a abrirse (visible varios fotogramas).
const HOLD_MS = 650;

let sharedAudio: AudioContext | null = null;

// Golpe percusivo sintetizado con Web Audio (sin archivos con licencia): un
// "crack" de ruido con cuerpo más un golpe grave, comprimido para que suene
// fuerte y seco — tiene que oírse bien en el micro de la cámara. Se programa
// en el reloj de audio para caer justo cuando se cierra la chapeta.
function playClapSound(delaySeconds: number) {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    // Un solo contexto reutilizado: crear uno nuevo en cada toque añade
    // retraso variable, justo lo que desincroniza la marca.
    if (!sharedAudio || sharedAudio.state === "closed") sharedAudio = new AudioContextClass();
    const ctx = sharedAudio;
    if (ctx.state === "suspended") void ctx.resume();
    const at = ctx.currentTime + delaySeconds;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 0;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.001;
    compressor.release.value = 0.1;
    const master = ctx.createGain();
    master.gain.value = 2.2;
    compressor.connect(master);
    master.connect(ctx.destination);

    // Crack: ruido blanco con caída rápida pero con cuerpo (0,18 s).
    const duration = 0.18;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 250;
    const presence = ctx.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 2500;
    presence.gain.value = 8;
    noise.connect(highpass);
    highpass.connect(presence);
    presence.connect(compressor);
    noise.start(at);
    noise.stop(at + duration);

    // Golpe grave: la madera chocando.
    const thump = ctx.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(180, at);
    thump.frequency.exponentialRampToValueAtTime(60, at + 0.08);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.9, at);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, at + 0.1);
    thump.connect(thumpGain);
    thumpGain.connect(compressor);
    thump.start(at);
    thump.stop(at + 0.1);
  } catch {
    // Si el navegador bloquea audio sin interacción previa u otra causa,
    // el clap sigue funcionando en silencio — nunca debe romper el flujo.
  }
}

type SavedBoard = {
  sceneEntryMode: "list" | "manual";
  sceneId: string;
  manualSceneNumber: string;
  shotNumber: string;
  director: string;
  camera: string;
  clip: string;
  take: number;
};

const storageKey = (projectId: string) => `taller_claqueta_${projectId}`;

function readSaved(projectId: string): Partial<SavedBoard> | null {
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    return raw ? (JSON.parse(raw) as Partial<SavedBoard>) : null;
  } catch {
    return null;
  }
}

export function ClaquetaBoard({
  projectId,
  projectName,
  scenes,
  lastTakeByKey,
  initialLog,
}: {
  projectId: string;
  projectName: string;
  scenes: SceneOption[];
  lastTakeByKey: Record<string, number>;
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

  // Última toma usada por escena+plano; se actualiza en cada clap para que
  // volver a una escena ya rodada hoy siga donde se quedó.
  const [takeMap, setTakeMap] = useState(lastTakeByKey);
  const nextTakeFor = (scene: string, shot: string) => (takeMap[takeKey(scene, shot)] ?? 0) + 1;

  const [shotNumber, setShotNumber] = useState("");
  const [take, setTake] = useState(() => (sceneNumber ? nextTakeFor(sceneNumber, "") : 1));
  const [director, setDirector] = useState("");
  const [camera, setCamera] = useState("");
  const [clip, setClip] = useState("");
  const [clapping, setClapping] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const retries = useRef(new Map<string, () => Promise<void>>());
  const [log, setLog] = useState(initialLog);
  const today = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Memoria: al volver de otra herramienta (o recargar), la claqueta sigue
  // con lo último que tenía puesto en este navegador. Se lee tras montar (en
  // el servidor no hay localStorage) y solo después se empieza a guardar,
  // para no pisar lo guardado con los valores por defecto.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const saved = readSaved(projectId);
    if (saved) {
      const mode = saved.sceneEntryMode === "manual" || scenes.length === 0 ? "manual" : "list";
      const id = saved.sceneId && scenes.some((s) => s.id === saved.sceneId) ? saved.sceneId : scenes[0]?.id ?? "";
      const manual = saved.manualSceneNumber ?? "";
      const shot = saved.shotNumber ?? "";
      const scene = mode === "list" ? scenes.find((s) => s.id === id)?.number ?? "" : manual.trim();
      // Nunca por debajo de lo que ya hay guardado en el servidor para esa
      // escena+plano: repetir un número de toma es peor que saltarse uno.
      const serverNext = scene ? nextTakeFor(scene, shot) : 1;
      /* eslint-disable react-hooks/set-state-in-effect */
      setSceneEntryMode(mode);
      setSceneId(id);
      setManualSceneNumber(manual);
      setShotNumber(shot);
      setDirector(saved.director ?? "");
      setCamera(saved.camera ?? "");
      setClip(saved.clip ?? "");
      setTake(Math.max(Number(saved.take) || 1, serverNext));
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    setRestored(true);
    // Solo al montar: después manda lo que la persona toque.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restored) return;
    const data: SavedBoard = { sceneEntryMode, sceneId, manualSceneNumber, shotNumber, director, camera, clip, take };
    try {
      window.localStorage.setItem(storageKey(projectId), JSON.stringify(data));
    } catch {
      // Sin almacenamiento (modo privado estricto): la claqueta sigue funcionando sin memoria.
    }
  }, [restored, projectId, sceneEntryMode, sceneId, manualSceneNumber, shotNumber, director, camera, clip, take]);

  // Escena nueva o plano nuevo = toma 1 (o la siguiente a la última que ya
  // tenga esa escena+plano).
  function pickScene(id: string) {
    setSceneId(id);
    const scene = scenes.find((s) => s.id === id);
    setTake(nextTakeFor(scene?.number ?? "", shotNumber));
  }

  function updateManualSceneNumber(value: string) {
    setManualSceneNumber(value);
    setTake(nextTakeFor(value.trim(), shotNumber));
  }

  function updateShotNumber(value: string) {
    setShotNumber(value);
    setTake(nextTakeFor(sceneNumber, value));
  }

  function switchToManualScene() {
    const prefill = selectedScene?.number ?? manualSceneNumber;
    setManualSceneNumber(prefill);
    setSceneEntryMode("manual");
    setTake(nextTakeFor(prefill.trim(), shotNumber));
  }

  function switchToSceneList() {
    setSceneEntryMode("list");
    const id = sceneId || scenes[0]?.id || "";
    setSceneId(id);
    const scene = scenes.find((s) => s.id === id);
    setTake(nextTakeFor(scene?.number ?? "", shotNumber));
  }

  async function handleClap() {
    if (!sceneNumber || clapping) return;

    // La animación y el sonido se disparan al instante, sin esperar al
    // servidor — en un rodaje real cada milisegundo de retraso en el
    // "clac" desincroniza la marca de referencia para el montaje.
    setClapping(true);
    playClapSound(CLOSE_MS / 1000);
    window.setTimeout(() => setClapping(false), CLOSE_MS + HOLD_MS);

    const thisTake = take;
    const thisClip = clip.trim();
    const optimisticId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticEntry: ClapLogEntry = {
      id: optimisticId,
      sceneNumber,
      shotNumber: shotNumber || null,
      take: thisTake,
      director: director || null,
      camera: camera || null,
      clip: thisClip || null,
      createdAt: new Date().toISOString(),
    };
    setLog((prev) => [optimisticEntry, ...prev].slice(0, 20));
    setTake(thisTake + 1);
    setTakeMap((prev) => {
      const key = takeKey(sceneNumber, shotNumber);
      return { ...prev, [key]: Math.max(prev[key] ?? 0, thisTake) };
    });
    // La cámara crea un archivo nuevo por toma: el siguiente es el mismo
    // nombre con el número sumado (C0009 → C0010).
    if (thisClip) setClip(nextClip(thisClip));

    const fd = new FormData();
    // sceneId solo tiene sentido si la escena viene de la lista real — si se
    // escribió a mano, sceneId puede quedar apuntando a una escena distinta.
    fd.set("sceneId", selectedScene ? sceneId : "");
    fd.set("sceneNumber", sceneNumber);
    if (shotNumber) fd.set("shotNumber", shotNumber);
    fd.set("take", String(thisTake));
    if (director) fd.set("director", director);
    if (camera) fd.set("camera", camera);
    if (thisClip) fd.set("clip", thisClip);
    if (selectedScene) {
      fd.set("intExt", selectedScene.intExt);
      fd.set("dayPart", selectedScene.dayPart);
    }

    async function persist() {
      setSaving(true);
      let ok = false;
      try {
        const result = await logClap(projectId, fd);
        // Sin esto, la toma recién marcada se queda para siempre con el id
        // provisional y el botón "Eliminar" nunca llega a aparecer para ella.
        if (result && "success" in result) {
          ok = true;
          retries.current.delete(optimisticId);
          setLog((prev) =>
            prev.map((entry) =>
              entry.id === optimisticId ? { ...entry, id: result.id, failed: false } : entry,
            ),
          );
        }
      } catch {
        ok = false;
      }
      setSaving(false);
      if (!ok) {
        // En rodaje no se puede perder una toma en silencio: se queda en el
        // historial marcada como "sin guardar" y con reintento.
        retries.current.set(optimisticId, persist);
        setLog((prev) =>
          prev.map((entry) => (entry.id === optimisticId ? { ...entry, failed: true } : entry)),
        );
        toast("error", `No se guardó la toma ${thisTake} de la escena ${sceneNumber}. Reintenta cuando haya conexión.`);
      }
    }
    await persist();
  }

  async function retryLog(id: string) {
    await retries.current.get(id)?.();
  }

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  async function setGood(entry: ClapLogEntry) {
    const next = !entry.good;
    setLog((prev) => prev.map((l) => (l.id === entry.id ? { ...l, good: next } : l)));
    const ok = await updateClapLog(projectId, entry.id, { good: next }).catch(() => false);
    if (!ok) {
      setLog((prev) => prev.map((l) => (l.id === entry.id ? { ...l, good: entry.good } : l)));
      toast("error", "No se pudo marcar la toma.");
    }
  }

  async function saveNote(entry: ClapLogEntry, value: string) {
    setEditingNoteId(null);
    const notes = value.trim() || null;
    if (notes === (entry.notes ?? null)) return;
    setLog((prev) => prev.map((l) => (l.id === entry.id ? { ...l, notes } : l)));
    const ok = await updateClapLog(projectId, entry.id, { notes }).catch(() => false);
    if (!ok) {
      setLog((prev) => prev.map((l) => (l.id === entry.id ? { ...l, notes: entry.notes ?? null } : l)));
      toast("error", "No se pudo guardar la nota.");
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
          {/* No es "sticky": con el historial de tomas lleno (justo cuando
              más se usa en rodaje) un tablero pegado arriba terminaba
              deslizándose por encima de la ficha de ajustes de debajo,
              solapando los campos y volviéndolos ilegibles. */}
          <div className="select-none">
            {/* Chapeta de dos piezas, como una claqueta de verdad: la de arriba
                está ABIERTA en reposo (bisagra a la izquierda) y al tocar se
                cierra de golpe sobre la fija. Así, en cámara, el fotograma en
                que se juntan se ve sin dudas — y el sonido cae justo ahí. */}
            <div className="relative pt-12 sm:pt-16">
              <motion.div
                initial={false}
                animate={{ rotate: clapping ? 0 : -7 }}
                transition={
                  clapping
                    ? { duration: CLOSE_MS / 1000, ease: "easeIn" }
                    : { duration: 0.3, ease: "easeOut" }
                }
                style={{
                  transformOrigin: "0% 100%",
                  backgroundImage:
                    "repeating-linear-gradient(45deg, #f2f0ea 0 18px, #0a0a0a 18px 36px)",
                }}
                className="h-10 rounded-t-sm border-2 border-fg sm:h-12"
              />
              <div
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(135deg, #f2f0ea 0 18px, #0a0a0a 18px 36px)",
                }}
                className="h-10 border-2 border-t-0 border-b-0 border-fg sm:h-12"
              />
            </div>
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
                <p className="mt-0.5 truncate font-display text-sm font-bold text-fg sm:text-base">
                  {projectName}
                </p>
              </div>
              <p className="shrink-0 font-mono text-[10px] tracking-widest text-fg/50">
                {today}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3 border-b border-fg/25 pb-3">
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
              <div className="min-w-0">
                <p className="font-mono text-[9px] tracking-[0.3em] text-fg/50 uppercase">
                  Clip
                </p>
                <p className="mt-0.5 truncate font-mono text-sm text-fg">{clip || "—"}</p>
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

            {/* Destello blanco en el instante del cierre — lo más visible en
                cámara (varios fotogramas a tope y luego se apaga). */}
            <AnimatePresence>
              {clapping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: (CLOSE_MS + HOLD_MS) / 1000,
                    times: [0, CLOSE_MS / (CLOSE_MS + HOLD_MS), (CLOSE_MS + 180) / (CLOSE_MS + HOLD_MS), 1],
                    ease: "linear",
                  }}
                  className="pointer-events-none absolute inset-0 bg-white"
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
              onChange={(e) => updateShotNumber(e.target.value)}
              placeholder="Plano (ej. 3A)"
              className="border border-line bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted uppercase">
              Clip de cámara (opcional)
              {clip && (
                <span className="flex items-center gap-1 normal-case tracking-normal text-accent">
                  <span className="h-1 w-1 rounded-full bg-accent" />
                  sube solo
                </span>
              )}
            </span>
            <input
              value={clip}
              onChange={(e) => setClip(e.target.value)}
              placeholder="Archivo de la cámara (ej. C0009)"
              autoCapitalize="characters"
              className={`border bg-transparent px-3 py-2.5 font-mono text-sm outline-none transition-colors focus:border-accent ${clip ? "border-accent/40" : "border-line"}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted uppercase">
              Director (opcional)
              {/* Aviso puramente visual: toda la claqueta se recuerda en este
                  navegador aunque salgas a otra herramienta (ver readSaved). */}
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
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
            Últimas tomas
          </p>
          <Link href={`/app/${projectId}/script`} className="link-action !text-muted hover:!text-accent">
            Ver script →
          </Link>
        </div>
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
                        className={`flex items-center justify-between gap-3 border-l-2 px-3 py-2.5 ${
                          entry.good ? "border-success bg-success/5" : "border-transparent"
                        }`}
                      >
                        {!entry.failed && !entry.id.startsWith("pending-") && (
                          <button
                            type="button"
                            onClick={() => setGood(entry)}
                            aria-pressed={Boolean(entry.good)}
                            aria-label={`Toma ${entry.take}: ${entry.good ? "quitar de buenas" : "marcar como buena"}`}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center border text-xs transition-colors ${
                              entry.good
                                ? "border-success bg-success text-bg"
                                : "border-line text-transparent hover:border-success hover:text-success"
                            }`}
                          >
                            ✓
                          </button>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-sm">
                            {entry.shotNumber ? `Plano ${entry.shotNumber} · ` : ""}
                            Toma {entry.take}
                            {entry.clip ? <span className="text-muted"> · {entry.clip}</span> : ""}
                            {entry.failed && (
                              <span className="ml-2 text-[10px] tracking-widest text-warn uppercase">
                                Sin guardar
                              </span>
                            )}
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
                          {!entry.failed && !entry.id.startsWith("pending-") &&
                            (editingNoteId === entry.id ? (
                              <input
                                autoFocus
                                defaultValue={entry.notes ?? ""}
                                placeholder="Nota (ej. se ve el micro)"
                                onBlur={(e) => saveNote(entry, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.currentTarget.blur();
                                  if (e.key === "Escape") setEditingNoteId(null);
                                }}
                                className="mt-1 w-full border border-accent bg-transparent px-2 py-1 font-mono text-[11px] outline-none"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingNoteId(entry.id)}
                                className={`mt-0.5 block max-w-full truncate text-left font-mono text-[10px] hover:text-accent ${
                                  entry.notes ? "text-fg" : "text-muted/70"
                                }`}
                              >
                                {entry.notes ?? "+ nota"}
                              </button>
                            ))}
                        </div>
                        {entry.failed ? (
                          <button
                            type="button"
                            onClick={() => retryLog(entry.id)}
                            className="link-action !text-warn"
                          >
                            Reintentar
                          </button>
                        ) : (
                          !entry.id.startsWith("pending-") && (
                            <form action={() => handleDeleteLog(entry.id)}>
                              <DeleteButton />
                            </form>
                          )
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
