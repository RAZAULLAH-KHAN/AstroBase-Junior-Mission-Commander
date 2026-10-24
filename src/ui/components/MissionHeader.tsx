import { Link } from 'react-router-dom';
import type { MissionView } from '../../store/selectors';
import { fmtPct } from '../format';
import { Button } from './Button';
import { Wordmark } from './SiteLayout';
import { ThemeToggle } from './ThemeToggle';

interface MissionHeaderProps {
  view: MissionView;
  onHistory: () => void;
  onReport: () => void;
  onSettings: () => void;
  onHelp: () => void;
  hasReport: boolean;
}

function Chip({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-lg bg-panel-2/60 px-2.5 py-1.5 text-sm">
      <span className="text-xs text-muted">{label}</span>
      <span className={`num font-medium ${tone ?? ''}`}>{value}</span>
    </div>
  );
}

export function MissionHeader({
  view,
  onHistory,
  onReport,
  onSettings,
  onHelp,
  hasReport,
}: MissionHeaderProps) {
  const { game, dayLabel, known } = view;
  const mars = game.config.location === 'mars';
  const env = game.environment;
  const storm = known.find(
    (k) => k.status === 'active' && (k.def.kind === 'dustStorm' || k.def.kind === 'shadow'),
  );
  const speActive = known.some((k) => k.status === 'active' && k.def.kind === 'spe');
  const speSoon = known.some((k) => k.status === 'forecast' && k.def.kind === 'spe');
  const sky = mars
    ? storm
      ? `Storm · τ ${storm.event.params.tau.toFixed(1)}`
      : `τ ${env.dustOpticalDepth.toFixed(1)}`
    : storm
      ? `Shadow · ${fmtPct(storm.event.params.illumination)}`
      : `${fmtPct(env.illuminationFraction)} sunlit`;

  return (
    <header className="no-print border-b border-border bg-bg/95">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-3 py-2">
        <Link
          to="/"
          className="mr-1 text-text no-underline hover:no-underline"
          aria-label="Leave to the AstroBase home page"
        >
          <Wordmark />
        </Link>
        <span className="text-sm text-muted">
          {mars ? 'Mars' : 'Moon'} ·{' '}
          {game.config.difficulty[0].toUpperCase() + game.config.difficulty.slice(1)}
          {game.config.demo ? ' · Demo' : ''}
        </span>
        <div className="flex flex-wrap items-center gap-2" id="weather" data-tutorial="weather">
          <Chip
            label={dayLabel.toUpperCase()}
            value={`${String(game.day).padStart(2, '0')} / ${game.config.durationDays}`}
          />
          <Chip label={mars ? 'Sky' : 'Sun'} value={sky} tone={storm ? 'text-warn' : undefined} />
          <Chip
            label="Solar activity"
            value={speActive ? 'Particle event' : speSoon ? 'Elevated' : 'Quiet'}
            tone={speActive ? 'text-danger' : speSoon ? 'text-warn' : undefined}
          />
          <Chip label="Science" value={`${Math.round(game.science.points)} SP`} tone="text-science" />
        </div>
        <nav className="ml-auto flex flex-wrap gap-1" aria-label="Mission tools">
          <Button size="sm" variant="ghost" onClick={onReport} disabled={!hasReport}>
            Last report
          </Button>
          <Button size="sm" variant="ghost" onClick={onHistory}>
            History
          </Button>
          <Button size="sm" variant="ghost" onClick={onHelp}>
            Tutorial
          </Button>
          <Button size="sm" variant="ghost" onClick={onSettings}>
            Settings
          </Button>
          <ThemeToggle className="ml-1" />
        </nav>
      </div>
    </header>
  );
}
