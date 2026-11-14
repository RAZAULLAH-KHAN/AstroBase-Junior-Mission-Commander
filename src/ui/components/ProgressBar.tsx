/** AstroBase Component: ProgressBar — Visual gauge for resource reserves, capacity, and limits. */
import { cx } from '../format';

interface ProgressBarProps {
  value: number; // 0..1
  color: string; // Tailwind background class, e.g. "bg-o2"
  striped?: boolean;
  marker?: number; // optional 0..1 marker (e.g. projected value)
  className?: string;
  label?: string;
}

export function ProgressBar({ value, color, striped, marker, className, label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={cx('relative h-2 overflow-hidden rounded-full bg-bg', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-700', striped ? 'bar-striped' : color)}
        style={{ width: `${pct}%` }}
      />
      {marker !== undefined && (
        <div
          className="absolute top-0 h-full w-0.5 bg-text/70"
          style={{ left: `${Math.max(0, Math.min(1, marker)) * 100}%` }}
        />
      )}
    </div>
  );
}
