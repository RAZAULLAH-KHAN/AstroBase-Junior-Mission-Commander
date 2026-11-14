import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  defaultConfig,
  generateSeed,
  normalizeSeed,
  SCENARIOS,
  type Difficulty,
  type Location,
} from '../../engine';
import { useGameStore } from '../../store/gameStore';
import { hasSave } from '../../store/persistence';
import { Button } from '../components/Button';
import { cx } from '../format';
import {
  classify,
  DEFAULT_SNAPSHOT_ID,
  DONKI_HOME,
  fetchLiveSpaceWeather,
  RECORDED_SNAPSHOTS,
  sourceLabel,
  SUN_LEVEL_TEXT,
  type SpaceWeatherSnapshot,
} from '../spaceWeather';

const DIFFICULTIES: { id: Difficulty; name: string; text: string }[] = [
  {
    id: 'training',
    name: 'Training',
    text: '50% more supplies, fewer events, life support locked at top priority, one undo.',
  },
  { id: 'standard', name: 'Standard', text: 'Normal supplies and events. The way the mission was designed.' },
  {
    id: 'commander',
    name: 'Commander',
    text: '15% fewer supplies, more events, and global dust storms on Mars.',
  },
];

function parseLocation(value: string | null): Location | null {
  return value === 'mars' || value === 'moon' ? value : null;
}

function parseDifficulty(value: string | null): Difficulty | null {
  return value === 'training' || value === 'standard' || value === 'commander' ? value : null;
}

export function SetupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const newMission = useGameStore((s) => s.newMission);
  const message = useGameStore((s) => s.message);
  const clearMessage = useGameStore((s) => s.clearMessage);

  const fromLink = Boolean(params.get('seed'));
  const [location, setLocation] = useState<Location>(parseLocation(params.get('loc')) ?? 'mars');
  const [difficulty, setDifficulty] = useState<Difficulty>(parseDifficulty(params.get('diff')) ?? 'training');
  const [seed, setSeed] = useState(() => normalizeSeed(params.get('seed') ?? '') || generateSeed('MARS'));
  const [seedEdited, setSeedEdited] = useState(fromLink);
  const [saveExists, setSaveExists] = useState(false);

  useEffect(() => setSaveExists(hasSave()), []);

  // Sun conditions from NASA DONKI. A teacher link fixes a recorded period so the whole class matches.
  const linkedSun = RECORDED_SNAPSHOTS.find((s) => s.id === params.get('sun'))?.id;
  const [sunId, setSunId] = useState(linkedSun ?? DEFAULT_SNAPSHOT_ID);
  const [sunChosen, setSunChosen] = useState(Boolean(linkedSun));
  const [live, setLive] = useState<SpaceWeatherSnapshot | null>(null);
  const [liveStatus, setLiveStatus] = useState<'loading' | 'ok' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchLiveSpaceWeather()
      .then((s) => {
        if (cancelled) return;
        setLive(s);
        setLiveStatus('ok');
      })
      .catch(() => {
        if (!cancelled) setLiveStatus('failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefer live data once it arrives, unless the player or a teacher link already chose a period.
  useEffect(() => {
    if (live && !sunChosen && !fromLink) setSunId('live');
  }, [live, sunChosen, fromLink]);

  const sunOptions = live ? [live, ...RECORDED_SNAPSHOTS] : RECORDED_SNAPSHOTS;
  const sun = sunOptions.find((s) => s.id === sunId) ?? RECORDED_SNAPSHOTS[0];

  const chooseLocation = (loc: Location) => {
    setLocation(loc);
    if (!seedEdited) setSeed(generateSeed(loc));
  };

  const launch = (e: FormEvent) => {
    e.preventDefault();
    const code = normalizeSeed(seed) || generateSeed(location);
    clearMessage();
    newMission(
      defaultConfig({
        location,
        difficulty,
        seed: code,
        sunActivity: classify(sun),
        sunSource: `${sun.label} (${sourceLabel(sun)})`,
      }),
    );
    navigate('/play');
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Mission setup</h1>
      {fromLink && (
        <p className="mt-2 rounded-lg border border-accent/50 bg-accent/10 p-3 text-sm">
          Your teacher shared this mission. Keep the same settings so everyone in class plays the same events.
        </p>
      )}
      {message && <p className="mt-2 rounded-lg border border-warn/50 bg-warn/10 p-3 text-sm">{message}</p>}

      <form onSubmit={launch} className="mt-6 space-y-8">
        <fieldset>
          <legend className="text-lg font-semibold">Choose your destination</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {(['mars', 'moon'] as Location[]).map((loc) => {
              const s = SCENARIOS[loc];
              const selected = location === loc;
              return (
                <label
                  key={loc}
                  className={cx(
                    'panel cursor-pointer p-5 transition-colors',
                    selected
                      ? loc === 'mars'
                        ? 'border-mars ring-1 ring-mars'
                        : 'border-moon ring-1 ring-moon'
                      : 'hover:border-muted',
                  )}
                >
                  <input
                    type="radio"
                    name="location"
                    value={loc}
                    checked={selected}
                    onChange={() => chooseLocation(loc)}
                    className="sr-only"
                  />
                  <div className="flex items-baseline justify-between">
                    <span
                      className={cx('text-2xl font-semibold', loc === 'mars' ? 'text-mars' : 'text-moon')}
                    >
                      {s.name}
                    </span>
                    {selected && (
                      <span className="text-xs font-semibold uppercase tracking-wide text-text">
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted">{s.site}</div>
                  <p className="mt-3 text-sm">{s.pitch}</p>
                  <dl className="mt-3 space-y-1 text-sm">
                    {s.facts.map((f) => (
                      <div key={f.label} className="flex justify-between gap-3 border-t border-border pt-1">
                        <dt className="text-muted">{f.label}</dt>
                        <dd className="text-right">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-semibold">Difficulty</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {DIFFICULTIES.map((d) => (
              <label
                key={d.id}
                className={cx(
                  'panel flex cursor-pointer gap-3 p-4',
                  difficulty === d.id ? 'border-accent ring-1 ring-accent' : 'hover:border-muted',
                )}
              >
                <input
                  type="radio"
                  name="difficulty"
                  value={d.id}
                  checked={difficulty === d.id}
                  onChange={() => setDifficulty(d.id)}
                  className="mt-1 accent-[rgb(var(--accent))]"
                />
                <span>
                  <span className="block font-semibold">{d.name}</span>
                  <span className="block text-sm text-muted">{d.text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-semibold">Sun conditions (real NASA data)</legend>
          <p className="text-sm text-muted">
            The Sun sometimes throws out bursts of fast particles called a solar particle event. They raise
            the radiation dose: the amount of radiation the crew&apos;s bodies absorb. These periods come from
            NASA&apos;s space weather database,{' '}
            <a href={DONKI_HOME} target="_blank" rel="noreferrer">
              DONKI
            </a>
            . A busier Sun means more solar storms in your mission.
          </p>
          <p className="mt-2 text-sm" role="status">
            {liveStatus === 'loading' && 'Checking NASA DONKI for the last 30 days…'}
            {liveStatus === 'ok' && 'Live data from NASA DONKI is available.'}
            {liveStatus === 'failed' &&
              'NASA DONKI could not be reached right now, so only recorded periods are shown. They are past data, not today’s Sun.'}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {sunOptions.map((s) => {
              const level = classify(s);
              const selected = sun.id === s.id;
              return (
                <label
                  key={s.id}
                  className={cx(
                    'panel flex cursor-pointer gap-3 p-4',
                    selected ? 'border-accent ring-1 ring-accent' : 'hover:border-muted',
                  )}
                >
                  <input
                    type="radio"
                    name="sun"
                    value={s.id}
                    checked={selected}
                    onChange={() => {
                      setSunId(s.id);
                      setSunChosen(true);
                    }}
                    className="mt-1 accent-[rgb(var(--accent))]"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold">{s.label}</span>
                      <span
                        className={cx(
                          'rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
                          level === 'stormy'
                            ? 'bg-danger/15 text-danger'
                            : level === 'active'
                              ? 'bg-warn/15 text-warn'
                              : 'bg-ok/15 text-ok',
                        )}
                      >
                        Sun: {SUN_LEVEL_TEXT[level].name}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm">{s.summary}</span>
                    <span className="mt-1 block text-sm text-muted">{SUN_LEVEL_TEXT[level].effect}</span>
                    <span className="mt-1 block text-xs text-muted">Source: {sourceLabel(s)}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="seed" className="text-lg font-semibold">
            Mission code
          </label>
          <p className="text-sm text-muted">
            The same code, destination and difficulty always give the same mission.
          </p>
          <div className="mt-2 flex max-w-md gap-2">
            <input
              id="seed"
              className="input num flex-1 uppercase"
              value={seed}
              onChange={(e) => {
                setSeed(normalizeSeed(e.target.value));
                setSeedEdited(true);
              }}
              maxLength={24}
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              onClick={() => {
                setSeed(generateSeed(location));
                setSeedEdited(false);
              }}
            >
              New code
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-6">
          <Button type="submit" variant="primary" size="lg">
            Launch mission
          </Button>
          {saveExists && (
            <span className="text-sm text-muted">Launching replaces the mission you have saved.</span>
          )}
        </div>
      </form>
    </div>
  );
}
