import { Skeleton } from "@/components/Skeleton";

// Entre herramientas del mismo proyecto el menú de fases se queda quieto y
// solo cambia el contenido: sin este límite la navegación se congelaba hasta
// tener todos los datos. La forma es la de PageHeader (fase, título de cartel,
// una línea) y una lista, que es lo que tienen casi todas las herramientas.
export default function ProjectToolLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-11 w-64 sm:h-14 sm:w-80" />
      <Skeleton className="mt-3.5 h-3.5 w-full max-w-xl" />

      <div className="mt-10 border-t border-line">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line py-4">
            <Skeleton className="h-8 w-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="mt-2 h-3 w-72 max-w-full" />
            </div>
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
