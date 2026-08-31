"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

// Igual que DeleteButton: confirmación en dos clics en vez de un diálogo
// nativo. Solo se activa si el actor elegido ya interpreta a otro
// personaje — si no hay conflicto, "Guardar" envía directamente.
function SubmitOrConfirm({
  hasConflict,
  confirming,
  onNeedConfirm,
}: {
  hasConflict: boolean;
  confirming: boolean;
  onNeedConfirm: () => void;
}) {
  const { pending } = useFormStatus();

  if (pending) {
    return (
      <button
        type="submit"
        disabled
        className="inline-flex items-center gap-1.5 font-mono text-xs tracking-widest text-muted uppercase opacity-70"
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        Guardando…
      </button>
    );
  }

  if (hasConflict && !confirming) {
    return (
      <button
        type="button"
        onClick={onNeedConfirm}
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        Guardar
      </button>
    );
  }

  if (hasConflict && confirming) {
    return (
      <button
        type="submit"
        className="font-mono text-xs tracking-widest text-accent uppercase"
      >
        ¿Seguro? Confirmar
      </button>
    );
  }

  return (
    <button
      type="submit"
      className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
    >
      Guardar
    </button>
  );
}

export function ActorAssignmentField({
  actors,
  defaultActorId,
  conflicts,
}: {
  actors: { id: string; name: string }[];
  defaultActorId: string;
  // actorId -> nombre del OTRO personaje que ya lo tiene asignado.
  conflicts: Record<string, string>;
}) {
  const [actorId, setActorId] = useState(defaultActorId);
  const [confirming, setConfirming] = useState(false);
  const conflictName = actorId ? conflicts[actorId] : undefined;

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          name="actorId"
          value={actorId}
          onChange={(e) => {
            setActorId(e.target.value);
            setConfirming(false);
          }}
          className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
        >
          <option value="" className="bg-bg">
            Sin actor
          </option>
          {actors.map((actor) => (
            <option key={actor.id} value={actor.id} className="bg-bg">
              {actor.name}
            </option>
          ))}
        </select>
        <SubmitOrConfirm
          hasConflict={!!conflictName}
          confirming={confirming}
          onNeedConfirm={() => setConfirming(true)}
        />
      </div>
      {conflictName && (
        <p className="font-mono text-[10px] text-accent">
          Ya interpreta a {conflictName} — pulsa Guardar dos veces si quieres
          que interprete a los dos.
        </p>
      )}
    </div>
  );
}
