import { Skeleton } from "@/components/Skeleton";

export default function PersonajesLoading() {
  return (
    <div>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-40" />

      <div className="mt-8">
        <Skeleton className="h-3 w-20" />
        <div className="mt-4 border-t border-line">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 border-b border-line py-3"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-14">
        <Skeleton className="h-3 w-24" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-line p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-1 h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
