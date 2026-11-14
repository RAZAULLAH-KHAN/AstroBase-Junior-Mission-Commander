/** AstroBase Component: ThemeToggle — Light / dark theme toggle button with persistence. */
import { useTheme } from '../hooks/useTheme';
import { cx } from '../format';

/** Switches between the dark mission-console theme and the light theme. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={cx(
        'inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-border px-2.5 text-sm text-muted hover:text-text',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="relative inline-block h-4 w-7 rounded-full bg-panel-2 ring-1 ring-border"
      >
        <span
          className={cx(
            'absolute top-0.5 h-3 w-3 rounded-full bg-accent transition-[left] duration-200',
            theme === 'dark' ? 'left-0.5' : 'left-[14px]',
          )}
        />
      </span>
      {theme === 'dark' ? 'Dark' : 'Light'}
    </button>
  );
}
