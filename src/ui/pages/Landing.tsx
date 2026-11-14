import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { createMission, defaultConfig } from '../../engine';
import { hasSave } from '../../store/persistence';
import { BaseView } from '../components/BaseView';
import { ButtonLink } from '../components/Button';

const FEATURES = [
  {
    title: 'Five connected systems',
    text: 'Life support, power, food, radiation and science all share one power supply. Change one and the others feel it.',
  },
  {
    title: 'Learn why, every day',
    text: 'After each day, the report shows what changed and the chain of causes behind it, with a tip for next time.',
  },
  {
    title: 'Every number has a source',
    text: 'Oxygen use, radiation dose and solar power come from NASA references. Game simplifications are clearly labelled.',
  },
];

export function LandingPage() {
  const [params] = useSearchParams();
  const [saved, setSaved] = useState(false);
  const preview = useMemo(() => {
    const s = createMission(defaultConfig({ seed: 'LANDING' }));
    s.modules.solar.level = 3;
    s.modules.battery.level = 2;
    s.modules.greenhouse.level = 2;
    s.modules.shielding.level = 1;
    s.modules.stormShelter.level = 1;
    return s;
  }, []);

  useEffect(() => setSaved(hasSave()), []);

  // Teacher links of the form /?seed=…&loc=…&diff=… open the mission setup.
  if (params.get('seed') || params.get('loc') || params.get('diff')) {
    return <Navigate to={`/setup?${params.toString()}`} replace />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="panel-title mb-3">NASA Space Apps Challenge 2026 · Junior Mission Commander</p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Keep 5 astronauts alive for 30 days on Mars or the Moon.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            Share power between air, heat, water, food and science. Survive dust storms, long shadows and
            solar storms, and find out exactly why things went right or wrong.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink to="/setup" variant="primary" size="lg">
              Start mission
            </ButtonLink>
            {saved && (
              <ButtonLink to="/play" size="lg">
                Continue mission
              </ButtonLink>
            )}
            <ButtonLink to="/play?demo=1" size="lg">
              Try the 2-minute demo
            </ButtonLink>
            <ButtonLink to="/teacher" variant="ghost" size="lg">
              For teachers
            </ButtonLink>
          </div>
        </div>
        <div className="panel overflow-hidden p-2" aria-hidden="true">
          <BaseView game={preview} />
        </div>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3" aria-label="Features">
        {FEATURES.map((f) => (
          <div key={f.title} className="panel p-5">
            <h2 className="text-lg font-semibold">{f.title}</h2>
            <p className="mt-2 text-muted">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-16 panel p-6">
        <h2 className="text-xl font-semibold">How a day works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Read', 'Check gauges, alerts and crew health.'],
            ['Decide', 'Set power priorities, build upgrades and give the crew jobs.'],
            ['Commit', 'Press End Sol when you are ready.'],
            ['Simulate', 'The base runs for one day with your choices.'],
            ['Learn', 'The report explains what happened and why.'],
          ].map(([title, text], i) => (
            <li key={title} className="rounded-lg bg-panel-2/60 p-4">
              <div className="num text-sm text-accent">0{i + 1}</div>
              <div className="mt-1 font-semibold">{title}</div>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
