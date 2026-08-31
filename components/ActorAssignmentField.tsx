"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

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
  const { pending } = useFormStatus();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actorId, setActorId] = useState(defaultActorId);
  const [prevPending, setPrevPending] = useState(pending);

  // Ajuste durante el render (no en un efecto): al terminar de guardar
  // (pending true→false) se vuelve solo al modo bloqueado, ya con el
  // nombre actualizado — antes el select se quedaba abierto y parecía
  // que el cambio no se había guardado.
  if (pending !== prevPending) {
    setPrevPending(pending);
    if (!pending) setEditing(false);
  }

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const currentName = defaultActorId
    ? (actors.find((a) => a.id === defaultActorId)?.name ?? "Sin actor")
    : "Sin actor";
  const conflictName = actorId ? conflicts[actorId] : undefined;

  if (pending) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs tracking-widest text-muted uppercase opacity-70">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        Guardando…
      </span>
    );
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs">{currentName}</span>
        <button
          type="button"
          onClick={() => {
            setActorId(defaultActorId);
            setConfirming(false);
            setEditing(true);
          }}
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
        >
          Editar
        </button>
      </div>
    );
  }

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
          autoFocus
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
        {conflictName && !confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
          >
            Guardar
          </button>
        ) : (
          <button
            type="submit"
            className={`font-mono text-xs tracking-widest uppercase ${
              conflictName ? "text-accent" : "text-muted hover:text-accent"
            }`}
          >
            {conflictName ? "¿Seguro? Confirmar" : "Guardar"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
        >
          Cancelar
        </button>
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
