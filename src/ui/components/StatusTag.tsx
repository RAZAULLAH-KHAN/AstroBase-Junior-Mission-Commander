import type { AlertLevel } from '../../engine';
import { cx } from '../format';

const STYLES: Record<AlertLevel | 'ok', { label: string; cls: string; marker: string }> = {
  red: { label: 'Critical', cls: 'border-danger/60 bg-danger/15 text-danger', marker: 'bg-danger rotate-45' },
  amber: { label: 'Warning', cls: 'border-warn/60 bg-warn/15 text-warn', marker: 'bg-warn' },
  info: { label: 'Info', cls: 'border-info/50 bg-info/10 text-info', marker: 'bg-info rounded-full' },
  ok: { label: 'OK', cls: 'border-ok/50 bg-ok/10 text-ok', marker: 'bg-ok rounded-full' },
};

/** Status is always shown as shape + text label, never colour alone. */
export function StatusTag({
  level,
  label,
  className,
}: {
  level: AlertLevel | 'ok';
  label?: string;
  className?: string;
}) {
  const s = STYLES[level];
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        s.cls,
        className,
      )}
    >
      <span aria-hidden="true" className={cx('h-1.5 w-1.5', s.marker)} />
      {label ?? s.label}
    </span>
  );
}
