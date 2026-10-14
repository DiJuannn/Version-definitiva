"use client";

import { useState, useTransition } from "react";
import { geocodeAddress, type GeocodeCandidate } from "@/lib/actions/locations";

export function GeocodeButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([]);

  return (
    <div className="col-span-full flex flex-col items-start gap-2">
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
        className="btn btn-outline btn-sm"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.3" />
        </svg>
        {pending ? "Buscando…" : "Buscar en el mapa"}
      </button>

      {message && (
        <p role="status" className="max-w-md border-l-2 border-line pl-3 font-sans text-[13px] text-muted">
          {message}
        </p>
      )}

      {candidates.length > 0 && (
        <div className="w-full max-w-md">
          <p className="pb-1 font-mono text-[10px] tracking-widest text-muted uppercase">
            ¿Cuál es? Elige el resultado correcto
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
              className="block w-full border-t border-line py-2 text-left font-sans text-[13px] text-fg transition-colors hover:text-accent"
            >
              {candidate.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
