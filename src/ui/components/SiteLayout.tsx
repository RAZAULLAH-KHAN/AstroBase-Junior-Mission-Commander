import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { cx } from '../format';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { to: '/setup', label: 'New mission' },
  { to: '/library', label: 'Science Library' },
  { to: '/teacher', label: 'For teachers' },
  { to: '/about', label: 'About' },
];

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx('font-display font-semibold tracking-[0.18em]', className)}>
      ASTRO<span className="text-accent">BASE</span>
    </span>
  );
}

export function SiteLayout() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-panel focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="no-print border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-text no-underline hover:no-underline" aria-label="AstroBase home">
            <Wordmark className="text-lg" />
          </Link>
          <nav aria-label="Main" className="flex flex-wrap gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cx(
                    'rounded-lg px-3 py-2 text-sm no-underline hover:no-underline',
                    isActive ? 'bg-panel-2 text-text' : 'text-muted hover:text-text',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="no-print border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-muted sm:flex-row sm:justify-between">
          <span>Built by team WAYBACK for NASA Space Apps Challenge 2026</span>
          <span>
            Values based on NASA references — see the <Link to="/library">Science Library</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
