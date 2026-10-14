"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";
import { DangerConfirmButton } from "@/components/DangerConfirmButton";
import {
  deleteScreenplay,
  linkScreenplayProject,
  updateScreenplayDetails,
  type ScreenplayDetailsState,
} from "@/lib/actions/screenplays";

const FIELD =
  "w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent)]";

const FORMATS = [
  { value: "SHORT", label: "Cortometraje" },
  { value: "FEATURE", label: "Largometraje" },
  { value: "SERIES_EPISODE", label: "Episodio de serie" },
  { value: "OTHER", label: "Otro" },
];

export type SettingsProps = {
  id: string;
  title: string;
  format: string;
  author: string | null;
  projectId: string | null;
  projects: { id: string; name: string }[];
};

// Ajustes del guion: datos de portada y el proyecto de Taller al que va
// unido (sus personajes y referencias se comparten con ese proyecto).
export function SettingsDialog({ open, onClose, settings }: { open: boolean; onClose: () => void; settings: SettingsProps }) {
  const router = useRouter();
  const [state, formAction] = useActionState<ScreenplayDetailsState, FormData>(async (prev, fd) => {
    const res = await updateScreenplayDetails(settings.id, prev, fd);
    if (res?.ok) {
      router.refresh();
      onClose();
    }
    return res;
  }, undefined);
  const [project, setProject] = useState(settings.projectId ?? "");
  const [linking, startLink] = useTransition();
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} title="Ajustes del guion">
      <form action={formAction} className="mt-5 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[12.5px] text-muted">
          Título
          <input name="title" defaultValue={settings.title} required maxLength={120} className={FIELD} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[12.5px] text-muted">
            Formato
            <select name="format" defaultValue={settings.format} className={FIELD}>
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] text-muted">
            Escrito por
            <input name="author" defaultValue={settings.author ?? ""} maxLength={120} className={FIELD} />
          </label>
        </div>
        {state?.error && (
          <p className="text-[13px] text-danger" role="alert">
            {state.error}
          </p>
        )}
        <SubmitButton pendingLabel="Guardando…" className="self-start rounded-md bg-[var(--fg)] px-3.5 py-2 text-[13px] font-medium text-white">
          Guardar
        </SubmitButton>
      </form>

      <div className="mt-6 border-t border-[var(--line)] pt-5">
        <label className="flex flex-col gap-1 text-[12.5px] text-muted">
          Proyecto de Taller
          <select
            value={project}
            disabled={linking}
            onChange={(e) => {
              const value = e.target.value;
              setProject(value);
              setLinkMsg(null);
              startLink(async () => {
                const res = await linkScreenplayProject(settings.id, value || null);
                if (!res.ok) setLinkMsg(res.error);
                else if (value)
                  setLinkMsg(
                    res.warning ??
                      `Vinculado: ${res.characters} ${res.characters === 1 ? "personaje" : "personajes"} en Personajes y ${res.cards} tarjetas en el Moodboard.`,
                  );
                else setLinkMsg("Desvinculado. Lo que ya estaba en el proyecto se queda allí.");
                router.refresh();
              });
            }}
            className={FIELD}
          >
            <option value="">Sin vincular</option>
            {settings.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          {linking
            ? "Enviando personajes y referencias al proyecto…"
            : (linkMsg ?? "Al vincularlo, los personajes aparecen en Personajes y las referencias e imágenes en el Moodboard, y se mantienen al día solos.")}
        </p>
      </div>

      <div className="mt-6 flex justify-between border-t border-[var(--line)] pt-5">
        <DangerConfirmButton
          trigger="Eliminar guion"
          title="¿Eliminar este guion?"
          description="Se borra el guion entero para todo el equipo. No se puede deshacer: exporta antes un Fountain si quieres guardar una copia."
          action={deleteScreenplay.bind(null, settings.id)}
        />
        <button type="button" onClick={onClose} className="text-[13px] text-muted hover:text-fg">
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
