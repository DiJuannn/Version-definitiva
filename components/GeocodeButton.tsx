"use client";

import { useState, useTransition } from "react";
import { geocodeAddress, type GeocodeCandidate } from "@/lib/actions/locations";

export function GeocodeButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([]);

  return (
    <div className="flex flex-col items-start gap-2 sm:col-span-2 lg:col-span-3">
      <button
        type="button"
        disabled={pending}
        onClick={(event) => {
          setMessage(null);
          setCandidates([]);
          const form = event.currentTarget.closest("form");
          if (!form) return;
          const address = (
            form.elements.namedItem("address") as HTMLInputElement | null
          )?.value;
          if (!address) {
            setMessage("Escribe una dirección primero — cuanto más completa (calle, número, ciudad, país), más precisa será la búsqueda.");
            return;
          }
          startTransition(async () => {
            const results = await geocodeAddress(address);
            if (results.length === 0) {
              setMessage(
                "No se encontraron coordenadas. Prueba a añadir ciudad y país, o marca el punto exacto a mano en Latitud/Longitud.",
              );
              return;
            }
            setCandidates(results);
          });
        }}
        className="border border-line px-3 py-2 font-mono text-xs text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {pending ? "Buscando…" : "Buscar coordenadas por dirección"}
      </button>

      {message && <p className="max-w-md font-mono text-[11px] text-muted">{message}</p>}

      {candidates.length > 0 && (
        <div className="w-full max-w-md border border-line">
          <p className="border-b border-line p-2 font-mono text-[10px] tracking-widest text-muted uppercase">
            Elige el resultado correcto
          </p>
          {candidates.map((candidate, i) => (
            <button
              key={i}
              type="button"
              onClick={(event) => {
                const form = event.currentTarget.closest("form");
                if (!form) return;
                const latInput = form.elements.namedItem(
                  "latitude",
                ) as HTMLInputElement | null;
                const lngInput = form.elements.namedItem(
                  "longitude",
                ) as HTMLInputElement | null;
                if (latInput) latInput.value = String(candidate.lat);
                if (lngInput) lngInput.value = String(candidate.lng);
                setCandidates([]);
                setMessage(`Coordenadas asignadas: ${candidate.label}`);
              }}
              className="block w-full border-b border-line p-2 text-left font-mono text-[11px] text-muted last:border-b-0 hover:border-accent hover:text-accent"
            >
              {candidate.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
