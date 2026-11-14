/** AstroBase Component: LazyHistoryChart — Code-split lazy wrapper for telemetry chart. */
import { lazy, Suspense, type ComponentProps } from 'react';

// Recharts is the largest dependency and only needed for history views, so it loads on demand.
const HistoryChart = lazy(() => import('./HistoryChart').then((m) => ({ default: m.HistoryChart })));

export function LazyHistoryChart(props: ComponentProps<typeof HistoryChart>) {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-sm text-muted">Loading chart…</div>
      }
    >
      <HistoryChart {...props} />
    </Suspense>
  );
}
