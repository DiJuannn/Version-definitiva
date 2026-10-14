import { Skeleton } from "@/components/Skeleton";

// Misma forma que la biblioteca: cabecera, cifras, mapa y filas (sin cajas).
export default function LocalizacionesLoading() {
  return (
    <div>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3 h-8 w-56" />
      <Skeleton className="mt-3 h-3 w-80" />

      <div className="mt-10 flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-9 w-48 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-[360px] w-full rounded-xl" />

      <div className="mt-8 divide-y divide-line border-y border-line">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-4">
            <div>
              <Skeleton className="h-4 w-44" />
              <Skeleton className="mt-2 h-3 w-64" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
