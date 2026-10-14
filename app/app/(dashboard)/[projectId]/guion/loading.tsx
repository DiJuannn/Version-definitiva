import { Skeleton } from "@/components/Skeleton";

export default function GuionLoading() {
  return (
    <div>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-40" />
      <Skeleton className="mt-4 h-3 w-full max-w-lg" />

      <div className="mt-10 grid gap-14 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="sheet divide-y divide-line">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-5 px-5 py-4">
              <Skeleton className="h-7 w-7" />
              <div className="flex-1">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="mt-2 h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}
