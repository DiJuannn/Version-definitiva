import { Skeleton } from "@/components/Skeleton";

export default function GuionLoading() {
  return (
    <div>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-40" />

      <div className="mt-8">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-4 h-8 w-36 rounded-full" />
      </div>

      <div className="mt-14">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-4 h-10 w-full max-w-sm" />
        <div className="mt-10 border-t border-line">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 border-b border-line py-4"
            >
              <div>
                <Skeleton className="h-5 w-28" />
                <Skeleton className="mt-2 h-3 w-40" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
