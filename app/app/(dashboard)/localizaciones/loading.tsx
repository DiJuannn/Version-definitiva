import { Skeleton } from "@/components/Skeleton";

export default function LocalizacionesLoading() {
  return (
    <div>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3 h-8 w-48" />
      <Skeleton className="mt-2 h-3 w-72" />

      <Skeleton className="mt-8 h-[160px] w-full" />

      <div className="mt-8 border border-line p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>

      <div className="mt-10 border-t border-line">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 border-b border-line py-4"
          >
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
