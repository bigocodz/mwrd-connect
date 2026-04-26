import { Skeleton } from "@/components/ui/skeleton";

export const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => (
  <div className="space-y-3 rounded-md bg-white p-4 shadow-[inset_0_0_0_1px_rgba(190,184,174,0.42)]">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-6 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export const CardSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="grid gap-4 md:grid-cols-3">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className="h-28 rounded-md" />
    ))}
  </div>
);
