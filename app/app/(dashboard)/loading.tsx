import { Skeleton } from "@/components/Skeleton";

// Sin esto, Next.js no muestra nada mientras la página de destino carga sus
// datos en el servidor — la navegación se queda quieta y luego salta de golpe.
// Un esqueleto con la forma de una página (cabecera + lista) se nota más
// rápido que un "Cargando…": el ojo ya sabe dónde va a estar cada cosa. Las
// páginas con forma propia (guion, desglose…) tienen su loading.tsx.
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-56" />
      <Skeleton className="mt-3 h-3 w-full max-w-md" />

      <div className="mt-10 border-t border-line">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-3 w-56" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
