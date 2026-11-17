import { Skeleton } from "@/components/admin/ui/skeleton";

/**
 * Route-level loading state for the admin segment. Charts and tables load from
 * Supabase per request, so a skeleton that mirrors the page rhythm prevents the
 * layout jumping between navigations.
 */
export default function AdminLoading() {
  return (
    <div className="admin-page" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading admin content</span>

      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-7 w-44 rounded-md" />
        <Skeleton className="h-4 w-64 rounded-md" />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="mb-3 h-3 w-20 rounded" />
            <Skeleton className="h-7 w-28 rounded" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="mb-4 h-4 w-32 rounded" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-3.5 flex-1 rounded" />
              <Skeleton className="hidden h-3.5 w-24 rounded sm:block" />
              <Skeleton className="h-3.5 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
