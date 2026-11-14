/** AstroBase Component: AlertList — Displays active system warnings and critical alerts. */
import type { Alert } from '../../engine';
import { StatusTag } from './StatusTag';

interface AlertListProps {
  alerts: Alert[];
  onSelect?: (target: string) => void;
}

export function AlertList({ alerts, onSelect }: AlertListProps) {
  return (
    <section aria-labelledby="alerts-title" className="panel p-3" id="alerts">
      <h2 id="alerts-title" className="panel-title mb-2 px-1">
        Alerts
      </h2>
      {alerts.length === 0 ? (
        <p className="px-1 text-sm text-muted">No alerts. All systems are steady.</p>
      ) : (
        <ul className="space-y-1.5" aria-live="polite">
          {alerts.map((a) => (
            <li key={a.code}>
              <button
                type="button"
                onClick={() => a.target && onSelect?.(a.target)}
                className="flex w-full items-start gap-2 rounded-lg bg-panel-2/60 p-2 text-left text-sm hover:bg-panel-2"
              >
                <StatusTag level={a.level} className="mt-0.5" />
                <span>{a.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
