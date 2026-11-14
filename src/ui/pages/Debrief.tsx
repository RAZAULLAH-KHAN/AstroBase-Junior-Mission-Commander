import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import copy from '../../content/i18n/en.json';
import { eventDef, type DayReport, type FailureReason, type GameState } from '../../engine';
import { useGameStore } from '../../store/gameStore';
import { Button, ButtonLink } from '../components/Button';
import { LazyHistoryChart as HistoryChart } from '../components/LazyHistoryChart';
import { cx, fmt1, fmtInt } from '../format';

const AFTERMATH: Record<FailureReason, string> = {
  o2: 'After this day, the oxygen supply kept falling.',
  water: 'After this day, the water supply kept falling.',
  food: 'After this day, the food supply kept falling.',
  evacuated: 'After this day, crew health kept falling.',
  radiation: "After this day, the crew's radiation dose stayed over the mission budget.",
};

const SUN_NAMES = { quiet: 'Quiet', active: 'Active', stormy: 'Stormy' } as const;

const REASON_LESSONS: Record<FailureReason | 'success', string[]> = {
  o2: [
    'Making oxygen takes a lot of electricity. Keep life support at the top of the priority list.',
    'A full oxygen tank is a buffer: it buys time when power runs short.',
    'Repair a broken oxygen generator straight away.',
  ],
  water: [
    'Upgrade the water recycler early. Each level saves water every single day.',
    'Without power, used water waits in a tank. If the tank overflows, that water is lost.',
    'The greenhouse drinks water too. Balance food against water.',
  ],
  food: [
    'New greenhouse beds take 10 days to grow, so expand early.',
    'Greenhouse lights need power. Protect them when you can.',
    'Packaged food runs out. The greenhouse is your long-term food supply.',
  ],
  evacuated: [
    'Crew health falls when air, water, food or heat run short.',
    'Rest and the Medic help the crew recover.',
    'Act on red alerts quickly: they mean someone is in danger.',
  ],
  radiation: [
    'Build a Storm Shelter early and use it when a solar storm is forecast.',
    'Regolith shielding lowers the dose every day.',
    'EVAs add dose. Plan them on quiet days.',
  ],
  success: [
    'Batteries carry the base through nights, storms and shadows.',
    'Reordering power priorities protects what matters most.',
    'Every system is connected: power is the thread that ties them together.',
  ],
};

function lessons(reports: DayReport[], reason: FailureReason | 'success'): string[] {
  const counts = new Map<string, number>();
  for (const r of reports) for (const t of r.tips) counts.set(t, (counts.get(t) ?? 0) + 1);
  const fromPlay = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const forReason = REASON_LESSONS[reason];
  // On a failure, the first lesson always addresses what actually ended the mission.
  const ordered =
    reason === 'success' ? [...fromPlay, ...forReason] : [forReason[0], ...fromPlay, ...forReason];
  return [...new Set(ordered)].slice(0, 3);
}

function summaryText(game: GameState, reports: DayReport[]): string {
  const o = game.outcome!;
  const label = game.config.location === 'mars' ? 'Sol' : 'Day';
  const lines = [
    'AstroBase: Junior Mission Commander — mission summary',
    '',
    `Destination: ${game.config.location === 'mars' ? 'Mars' : 'Moon'}`,
    `Difficulty: ${game.config.difficulty}`,
    `Mission code: ${game.config.seed}`,
    `Sun activity: ${SUN_NAMES[game.config.sunActivity ?? 'active']}${game.config.sunSource ? ` (${game.config.sunSource})` : ''}`,
    `Result: ${o.result === 'success' ? 'Mission complete' : copy.outcome[o.reason!]}`,
    `Score: ${o.score} (${o.stars} of 3 stars)`,
    '',
    'Score breakdown:',
    ...o.breakdown.map((b) => `  ${b.label}: ${b.points}`),
    '',
    'Daily headlines:',
    ...reports.map((r) => `  ${label} ${r.day}: ${r.headline}`),
    '',
    'Lessons:',
    ...lessons(reports, o.reason ?? 'success').map((l) => `  - ${l}`),
  ];
  return lines.join('\n');
}

function download(game: GameState, reports: DayReport[]) {
  const blob = new Blob([summaryText(game, reports)], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `astrobase-${game.config.seed}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function Stars({ stars }: { stars: number }) {
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={`${stars} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={cx('h-3 w-10 rounded-full', i <= stars ? 'bg-power' : 'bg-border')} />
      ))}
      <span className="ml-2 text-sm text-muted">{stars} of 3 stars</span>
    </div>
  );
}

export function DebriefPage() {
  const navigate = useNavigate();
  const game = useGameStore((s) => s.game);
  const reports = useGameStore((s) => s.reports);
  const newMission = useGameStore((s) => s.newMission);
  const startDemo = useGameStore((s) => s.startDemo);

  useEffect(() => {
    const store = useGameStore.getState();
    if (!store.game) store.loadSaved();
    const current = useGameStore.getState().game;
    if (!current) navigate('/', { replace: true });
    else if (!current.outcome) navigate('/play', { replace: true });
  }, [navigate]);

  if (!game?.outcome) return null;
  const o = game.outcome;
  const success = o.result === 'success';
  const label = game.config.location === 'mars' ? 'Sol' : 'Day';
  const turning = o.turningPointDay;
  const turningReport = turning !== undefined ? reports.find((r) => r.day === turning) : undefined;
  const turningEvents =
    turning !== undefined ? (game.history.find((h) => h.day === turning)?.eventIds ?? []) : [];

  const retry = () => {
    if (game.config.demo) startDemo();
    else newMission({ ...game.config });
    navigate(game.config.demo ? '/play?demo=1' : '/play');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="panel-title">
        Mission debrief · {game.config.location === 'mars' ? 'Mars' : 'Moon'} · {game.config.difficulty} ·
        code {game.config.seed} · sun {SUN_NAMES[game.config.sunActivity ?? 'active'].toLowerCase()}
      </p>
      <h1 className={cx('mt-2 text-3xl font-semibold sm:text-4xl', success ? 'text-ok' : 'text-text')}>
        {success
          ? `Mission complete: all ${game.config.durationDays} ${label.toLowerCase()}s survived`
          : copy.outcome[o.reason!]}
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        {success
          ? `Your crew made it home${game.flags.evacuations ? `, although ${game.flags.evacuations} had to be evacuated` : ' safely'}. Here is how the mission went.`
          : `${copy.outcomeExplain[o.reason!]} Here is what happened and how to fix it next time.`}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <section className="panel p-5">
          <h2 className="panel-title">Score</h2>
          <div className="num mt-2 text-4xl font-semibold">{fmtInt(o.score)}</div>
          <div className="mt-3">
            <Stars stars={o.stars} />
          </div>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {o.breakdown.map((b) => (
                <tr key={b.label} className="border-t border-border">
                  <th scope="row" className="py-1.5 text-left font-normal text-muted">
                    {b.label}
                  </th>
                  <td className={cx('num py-1.5 text-right', b.points < 0 && 'text-danger')}>{b.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel p-5 md:col-span-2">
          <h2 className="panel-title">{turning !== undefined ? 'Turning point' : 'Mission at a glance'}</h2>
          {turning !== undefined ? (
            <>
              <div className="mt-2 text-xl font-semibold">
                {label} {turning}
              </div>
              <p className="mt-1">
                {turningReport?.headline ?? 'From this day on, the trend never recovered.'}
              </p>
              {turningEvents.length > 0 && (
                <p className="mt-2 text-sm text-muted">
                  Events that day: {[...new Set(turningEvents)].map((id) => eventDef(id).name).join(', ')}.
                </p>
              )}
              <p className="mt-2 text-sm text-muted">
                {game.outcome?.reason
                  ? AFTERMATH[game.outcome.reason]
                  : 'From this day on, the trend never recovered.'}
              </p>
            </>
          ) : (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                ['Science', `${Math.round(game.science.points)} SP`],
                ['Objectives', `${game.science.objectivesDone.length} of 5`],
                ['Average dose', `${fmt1(game.history[game.history.length - 1].avgDose)} mSv`],
                ['Days life support cut', String(game.flags.lifeSupportShedDays)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-panel-2/60 p-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="num mt-1 text-lg">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <h3 className="panel-title mt-5">Three lessons</h3>
          <ol className="mt-2 space-y-2">
            {lessons(reports, o.reason ?? 'success').map((l, i) => (
              <li key={l} className="flex gap-3 rounded-lg bg-panel-2/60 p-3 text-sm">
                <span className="num text-accent">{i + 1}</span>
                <span>{l}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="panel mt-4 p-5">
        <h2 className="panel-title mb-3">Timeline</h2>
        <HistoryChart
          game={game}
          turningPointDay={turning}
          initial={
            o.reason === 'water'
              ? 'waterKg'
              : o.reason === 'food'
                ? 'foodKcal'
                : o.reason === 'radiation'
                  ? 'avgDose'
                  : o.reason === 'evacuated'
                    ? 'avgHealth'
                    : 'o2Kg'
          }
        />
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="primary" size="lg" onClick={retry}>
          Retry same mission
        </Button>
        <ButtonLink to="/setup" size="lg">
          New mission
        </ButtonLink>
        <ButtonLink to="/library" size="lg" variant="ghost">
          Open Science Library
        </ButtonLink>
        <Button size="lg" variant="ghost" onClick={() => download(game, reports)}>
          Download summary
        </Button>
      </div>
      <p className="mt-4 text-sm text-muted">
        Want the whole class to try this mission? Share code <span className="num">{game.config.seed}</span>{' '}
        or make a link on the <Link to="/teacher">teacher page</Link>.
      </p>
    </div>
  );
}
