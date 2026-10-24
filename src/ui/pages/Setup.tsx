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

  const chooseLocation = (loc: Location) => {
    setLocation(loc);
    if (!seedEdited) setSeed(generateSeed(loc));
  };

  const launch = (e: FormEvent) => {
    e.preventDefault();
    const code = normalizeSeed(seed) || generateSeed(location);
    clearMessage();
    newMission(defaultConfig({ location, difficulty, seed: code }));
    navigate('/play');
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Mission setup</h1>
      {fromLink && (
        <p className="mt-2 rounded-lg border border-info/50 bg-info/10 p-3 text-sm">
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
