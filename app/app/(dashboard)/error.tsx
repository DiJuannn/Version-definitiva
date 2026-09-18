"use client";

import Link from "next/link";
import { useEffect } from "react";

// Si una pantalla de Taller falla al cargar, en vez de una página en blanco se
// ofrece reintentar o volver al inicio.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md border border-danger/50 p-8 text-center">
      <p className="font-display text-lg font-bold">No se pudo cargar esta pantalla</p>
      <p className="mt-2 font-sans text-sm text-muted">
        Ha habido un problema al mostrar los datos. Puede ser la conexión. Tus cambios anteriores
        están a salvo.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          Reintentar
        </button>
        <Link href="/app" className="btn btn-outline">
          Ir al Inicio
        </Link>
      </div>
    </div>
  );
}
