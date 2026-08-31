import { Skeleton } from "@/components/Skeleton";

export default function DesgloseLoading() {
  return (
    <div>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-32" />
      <Skeleton className="mt-2 h-3 w-64" />

      <div className="mt-8">
        <Skeleton className="h-3 w-20" />
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, col) => (
            <div key={col}>
              <Skeleton className="h-3 w-16" />
              <div className="mt-2 border-t border-line">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 border-b border-line py-2.5"
                  >
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-14">
        <Skeleton className="h-3 w-28" />
        <div className="mt-6 border-t border-line">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 border-b border-line py-3"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
