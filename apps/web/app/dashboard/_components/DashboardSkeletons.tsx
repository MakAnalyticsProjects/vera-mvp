/**
 * Shared skeleton primitives for dashboard route loading.tsx files.
 *
 * Next.js App Router renders a route's `loading.tsx` instantly on
 * navigation, while the server component is still fetching data. Without
 * this, users see a blank screen + a stuck "Rendering" dev indicator
 * for the duration of the server fetch (3-13s when reading from the
 * DB-backed path).
 *
 * These mirror the structure of the real views (Cards + MetricTile rows +
 * table chrome) so the swap-in is visually smooth.
 */
import { Card, Skeleton, SkeletonText } from '@vera/ui';

export function MetricTileRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="!py-5">
          <div className="space-y-3">
            <SkeletonText width="w-24" className="h-3" />
            <SkeletonText width="w-32" className="h-8" />
            <SkeletonText width="w-20" className="h-3" />
          </div>
        </Card>
      ))}
    </section>
  );
}

export function TablePageSkeleton({
  title,
  subtitle,
  rows = 10,
}: {
  title?: string;
  subtitle?: string;
  rows?: number;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="space-y-2">
        <SkeletonText width="w-48" className="h-9" />
        {title ? <h1 className="sr-only">{title}</h1> : null}
        {subtitle ? <p className="sr-only">{subtitle}</p> : null}
        <SkeletonText width="w-96" className="h-4" />
      </section>

      <MetricTileRowSkeleton />

      <Card>
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <SkeletonText width="w-32" className="h-9" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
          {/* Table rows */}
          <div className="space-y-2">
            {Array.from({ length: rows }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-4 border-border/40 border-b py-3"
              >
                <SkeletonText width="w-full" className="col-span-4" />
                <SkeletonText width="w-full" className="col-span-2" />
                <SkeletonText width="w-full" className="col-span-2" />
                <SkeletonText width="w-full" className="col-span-2" />
                <SkeletonText width="w-full" className="col-span-2" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-10">
      {/* Briefing card */}
      <section className="space-y-3">
        <SkeletonText width="w-72" className="h-10" />
        <Card>
          <div className="space-y-3">
            <SkeletonText width="w-2/3" className="h-6" />
            <SkeletonText />
            <SkeletonText />
            <SkeletonText width="w-3/4" />
          </div>
        </Card>
      </section>

      {/* Metric tiles */}
      <MetricTileRowSkeleton />

      {/* Heat distribution donut */}
      <section>
        <Card>
          <div className="space-y-1">
            <SkeletonText width="w-40" className="h-3" />
            <SkeletonText width="w-72" className="h-3" />
          </div>
          <div className="mt-6 flex justify-center sm:justify-start">
            <Skeleton className="h-52 w-52 rounded-full" />
          </div>
        </Card>
      </section>

      {/* Top three jobs */}
      <section className="space-y-4">
        <SkeletonText width="w-56" className="h-3" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="!py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
                <div className="flex-1 space-y-2">
                  <SkeletonText width="w-2/3" className="h-6" />
                  <SkeletonText width="w-1/2" />
                  <SkeletonText width="w-32" className="mt-3 h-7" />
                </div>
                <div className="flex gap-3 sm:flex-col sm:items-end">
                  <Skeleton className="h-7 w-24 rounded-full" />
                  <Skeleton className="h-12 w-32" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
