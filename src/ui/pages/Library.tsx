/** AstroBase Page: Library — NASA research references, educational math, and source documentation. */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import constants from '../../content/constants.json';
import sources from '../../content/sources.json';
import { cx } from '../format';

interface Entry {
  key: string;
  value: number | number[];
  unit: string;
  kind: 'REF' | 'GAME';
  category: string;
  label: string;
  kidText: string;
  gameNote: string;
  sourceId?: string;
  status?: string;
}

interface Source {
  title: string;
  authors: string;
  publisher: string;
  year: number;
  url: string;
}

const SOURCES = sources as Record<string, Source>;
const ENTRIES: Entry[] = Object.entries(constants).map(([key, c]) => ({ key, ...(c as Omit<Entry, 'key'>) }));

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'lifeSupport', label: 'Life support' },
  { id: 'power', label: 'Power' },
  { id: 'food', label: 'Food' },
  { id: 'radiation', label: 'Radiation' },
  { id: 'science', label: 'Science' },
  { id: 'crew', label: 'Crew' },
  { id: 'rules', label: 'Game rules' },
];

function formatValue(value: number | number[]): string {
  const one = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 3 });
  return Array.isArray(value) ? value.map(one).join(' / ') : one(value);
}

export function LibraryPage() {
  const { hash } = useLocation();
  const anchor = decodeURIComponent(hash.replace('#', ''));
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [kind, setKind] = useState<'all' | 'REF' | 'GAME'>('all');

  useEffect(() => {
    if (!anchor) return;
    setQuery('');
    setCategory('all');
    setKind('all');
    const timer = window.setTimeout(
      () => document.getElementById(anchor)?.scrollIntoView({ block: 'center' }),
      50,
    );
    return () => window.clearTimeout(timer);
  }, [anchor]);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ENTRIES.filter(
      (e) =>
        (category === 'all' || e.category === category) &&
        (kind === 'all' || e.kind === kind) &&
        (!q || `${e.label} ${e.kidText} ${e.gameNote} ${e.key}`.toLowerCase().includes(q)),
    );
  }, [query, category, kind]);

  const refCount = ENTRIES.filter((e) => e.kind === 'REF').length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Science Library</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Every number the simulation uses is listed here.{' '}
        <strong className="text-text">Reference values</strong> ({refCount}) come from published NASA or
        peer-reviewed sources. <strong className="text-text">Game simplifications</strong> are our own choices
        to keep the game playable, and we say why. We never present a game value as a NASA measurement.
      </p>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <label htmlFor="library-search" className="sr-only">
          Search the library
        </label>
        <input
          id="library-search"
          type="search"
          className="input md:w-72"
          placeholder="Search, for example oxygen or dust"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by category">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cx(
                'min-h-[36px] rounded-lg px-3 text-sm',
                category === c.id ? 'bg-panel-2 text-text ring-1 ring-border' : 'text-muted hover:text-text',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-1" role="group" aria-label="Filter by type">
        {(['all', 'REF', 'GAME'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={cx(
              'min-h-[36px] rounded-lg px-3 text-sm',
              kind === k ? 'bg-panel-2 text-text ring-1 ring-border' : 'text-muted hover:text-text',
            )}
          >
            {k === 'all' ? 'All values' : k === 'REF' ? 'Reference values' : 'Game simplifications'}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted" aria-live="polite">
        {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
      </p>
      <ul className="mt-2 space-y-3">
        {entries.map((e) => {
          const source = e.sourceId ? SOURCES[e.sourceId] : undefined;
          return (
            <li
              key={e.key}
              id={e.key}
              className={cx('panel scroll-mt-24 p-4', anchor === e.key && 'ring-2 ring-info')}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">
                  {e.label} — <span className="num">{formatValue(e.value)}</span>{' '}
                  <span className="text-sm font-normal text-muted">{e.unit}</span>
                </h2>
                <span
                  className={cx(
                    'rounded border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
                    e.kind === 'REF' ? 'border-ok/60 text-ok' : 'border-warn/60 text-warn',
                  )}
                >
                  {e.kind === 'REF' ? 'Reference' : 'Game simplification'}
                </span>
              </div>
              <p className="mt-1">“{e.kidText}”</p>
              {e.gameNote && (
                <p className="mt-1 text-sm text-muted">
                  <span className="text-text">{e.kind === 'REF' ? 'How we use it: ' : 'Why: '}</span>
                  {e.gameNote}
                </p>
              )}
              {source && (
                <p className="mt-2 text-sm text-muted">
                  Source:{' '}
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.authors}, “{source.title}” ({source.year})
                    </a>
                  ) : (
                    `${source.title}`
                  )}
                  {e.status === 'to-verify' && (
                    <span className="ml-2 text-warn">· Value check against the source is in progress</span>
                  )}
                </p>
              )}
              <p className="mt-1 text-xs text-muted">
                Code name: <span className="num">{e.key}</span>
              </p>
            </li>
          );
        })}
      </ul>

      <section className="panel mt-10 p-5">
        <h2 className="text-xl font-semibold">How we simplified the science</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
          <li>
            The simulation moves in steps of one day (one sol on Mars). Each system adds up what it makes and
            what it uses.
          </li>
          <li>
            Power links everything. When there is not enough, systems are served in priority order and make
            less output.
          </li>
          <li>
            Oxygen energy: splitting water (2 H₂O → 2 H₂ + O₂) needs about 571.6 kJ per 32 g of oxygen. That
            is 17.9 MJ per kg, or about 5.0 kWh per kg. Our generator is about 70% efficient, so it uses 7 kWh
            per kg.
          </li>
          <li>
            Real radiation sickness needs much higher doses (hundreds of mSv at once). Our health penalty for
            big solar storms is a game simplification to show that solar storms are dangerous and that
            shelters work.
          </li>
          <li>
            Used water waits in a holding tank when the recycler has no power, and is cleaned later. Overflow
            is lost.
          </li>
        </ul>
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="text-xl font-semibold">Bibliography</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {Object.entries(SOURCES).map(([id, s]) => (
            <li key={id}>
              <span className="num text-xs text-muted">{id}</span>
              <br />
              {s.authors}, “{s.title}”, {s.publisher}, {s.year}.{' '}
              {s.url && (
                <a href={s.url} target="_blank" rel="noreferrer">
                  Link
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
