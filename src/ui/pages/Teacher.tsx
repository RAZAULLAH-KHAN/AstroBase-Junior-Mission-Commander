import { useMemo, useState } from 'react';
import { generateSeed, normalizeSeed, type Difficulty, type Location } from '../../engine';
import { Button, ButtonLink } from '../components/Button';

const OBJECTIVES = [
  ['LO1', 'Explain why humans need oxygen, water and food in measurable amounts.'],
  ['LO2', 'Describe how solar power changes with dust (Mars) and day and night (Moon).'],
  ['LO3', 'Explain why water recycling is critical far from Earth.'],
  ['LO4', 'Describe radiation sources (cosmic rays and solar storms) and how shielding helps.'],
  ['LO5', 'Reason about trade-offs and priorities in a connected system.'],
];

const QUESTIONS = [
  'Which resource ran out first in your mission, and what caused it?',
  'Why does growing food cost both water and electricity?',
  'What did you do when a dust storm or shadow period arrived? Did it work?',
  'Why is a bigger battery useful even when the solar panels make enough energy in total?',
  'How is radiation on the Moon different from radiation on Mars? Why?',
  'If you could send one extra module from Earth, which would you choose and why?',
];

export function TeacherPage() {
  const [location, setLocation] = useState<Location>('mars');
  const [difficulty, setDifficulty] = useState<Difficulty>('training');
  const [seed, setSeed] = useState(() => generateSeed('MARS'));
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');

  const link = useMemo(() => {
    const params = new URLSearchParams({ seed: normalizeSeed(seed), loc: location, diff: difficulty });
    return `${window.location.origin}/setup?${params.toString()}`;
  }, [seed, location, difficulty]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">For teachers</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Create a mission link so every student plays exactly the same events. No accounts, no installs and no
        personal data. The game keeps working offline once it has loaded.
      </p>

      <section className="panel no-print mt-6 p-5" aria-labelledby="link-title">
        <h2 id="link-title" className="text-xl font-semibold">
          Create a class mission
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Destination</span>
            <select
              className="input w-full"
              value={location}
              onChange={(e) => {
                const loc = e.target.value as Location;
                setLocation(loc);
                setSeed(generateSeed(loc));
              }}
            >
              <option value="mars">Mars</option>
              <option value="moon">Moon</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Difficulty</span>
            <select
              className="input w-full"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              <option value="training">Training (recommended for ages 10–12)</option>
              <option value="standard">Standard</option>
              <option value="commander">Commander</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Mission code</span>
            <div className="flex gap-2">
              <input
                className="input num w-full uppercase"
                value={seed}
                onChange={(e) => setSeed(normalizeSeed(e.target.value))}
                maxLength={24}
              />
              <Button size="sm" onClick={() => setSeed(generateSeed(location))}>
                New
              </Button>
            </div>
          </label>
        </div>
        <label htmlFor="class-link" className="mt-5 block text-sm text-muted">
          Link for students
        </label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            id="class-link"
            readOnly
            value={link}
            className="input num flex-1 text-xs"
            onFocus={(e) => e.target.select()}
          />
          <Button variant="primary" onClick={copyLink}>
            Copy link
          </Button>
          <ButtonLink
            to={`/setup?${new URLSearchParams({ seed: normalizeSeed(seed), loc: location, diff: difficulty })}`}
          >
            Open
          </ButtonLink>
        </div>
        <p className="mt-2 text-sm text-muted" role="status">
          {copied === 'done'
            ? 'Link copied.'
            : copied === 'failed'
              ? 'Copying is blocked in this browser. Select the link and copy it manually.'
              : ''}
        </p>
      </section>

      <div className="mt-6 flex justify-end no-print">
        <Button onClick={() => window.print()}>Print lesson plan</Button>
      </div>

      <section className="panel print-text mt-3 p-5">
        <h2 className="text-xl font-semibold">Learning objectives</h2>
        <p className="mt-1 text-sm text-muted print-text">
          Mission for the class: {location === 'mars' ? 'Mars' : 'Moon'}, {difficulty}, code{' '}
          <span className="num">{normalizeSeed(seed)}</span>
        </p>
        <ul className="mt-3 space-y-2">
          {OBJECTIVES.map(([id, text]) => (
            <li key={id} className="flex gap-3">
              <span className="num w-10 shrink-0 text-accent">{id}</span>
              <span>Students will be able to {text.charAt(0).toLowerCase() + text.slice(1)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel print-text mt-4 p-5">
        <h2 className="text-xl font-semibold">30-minute lesson plan</h2>
        <ol className="mt-3 space-y-3">
          <li>
            <strong>5 min — Introduction.</strong> What does a crew need to survive? List air, water, food,
            warmth and protection from radiation. Ask where each one comes from on a base far from Earth.
          </li>
          <li>
            <strong>15 min — Play.</strong> Students open the mission link and play. Encourage them to open
            “Why did this happen?” after every day.
          </li>
          <li>
            <strong>10 min — Discussion.</strong> Use the questions below. Because everyone had the same
            events, compare the choices different students made on the same day.
          </li>
        </ol>
      </section>

      <section className="panel print-text mt-4 p-5">
        <h2 className="text-xl font-semibold">Discussion questions</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {QUESTIONS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
