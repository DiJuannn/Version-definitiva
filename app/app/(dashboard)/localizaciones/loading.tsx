import { Skeleton } from "@/components/Skeleton";

// Misma forma que la biblioteca: cabecera, línea de estado, lista y mapa.
export default function LocalizacionesLoading() {
  return (
    <div>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3 h-8 w-56" />
      <Skeleton className="mt-3 h-3 w-80" />

      <Skeleton className="mt-10 h-6 w-96 max-w-full" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <Skeleton className="h-[300px] w-full rounded-xl lg:order-2 lg:h-[560px]" />
        <div className="sheet divide-y divide-line lg:order-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-5 py-4">
              <Skeleton className="h-7 w-7 rounded-full" />
              <div>
                <Skeleton className="h-4 w-44" />
                <Skeleton className="mt-2 h-3 w-64" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
