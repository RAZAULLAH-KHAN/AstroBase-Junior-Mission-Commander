import { Link } from 'react-router-dom';

export function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">About AstroBase</h1>
      <p className="mt-3 text-lg text-muted">
        AstroBase: Junior Mission Commander is our answer to the NASA Space Apps Challenge 2026 challenge
        “Build a Junior Astronaut Mission Trainer”. Students run a lunar or Martian outpost, make decisions
        about life support, radiation shielding, power and food production, and see the consequences of those
        decisions.
      </p>

      <section className="panel mt-8 p-5">
        <h2 className="text-xl font-semibold">Team</h2>
        <dl className="mt-3 space-y-3">
          <div>
            <dt className="font-semibold">Raza Ullah Khan</dt>
            <dd className="text-muted">
              Technical Lead — simulation engine, architecture, testing and deployment
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Sahrish</dt>
            <dd className="text-muted">
              Product, Design and Science Lead — user experience, research and content
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="text-xl font-semibold">How it works</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
          <li>
            A turn-based simulation: one turn is one day (a sol on Mars). Five connected systems share one
            power supply.
          </li>
          <li>
            The engine is deterministic. The same mission code and the same choices always give the same
            result, so a class can compare.
          </li>
          <li>
            After each day the engine records why every change happened and turns it into a short chain of
            causes.
          </li>
          <li>
            Every constant is listed in the <Link to="/library">Science Library</Link>, labelled as a NASA
            reference value or a game simplification.
          </li>
          <li>
            It runs entirely in the browser. There are no accounts, no tracking and no personal data. Progress
            is saved on your device.
          </li>
        </ul>
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="text-xl font-semibold">Data sources</h2>
        <p className="mt-2 text-muted">
          NASA Life Support Baseline Values and Assumptions Document (BVAD), Curiosity RAD measurements,
          Chang'e-4 lunar radiation measurements, NASA-STD-3001, ISS water recovery results, NASA/JPL reports
          on the 2018 global dust storm, and LOLA lunar polar illumination studies. Full references are in the{' '}
          <Link to="/library">Science Library</Link>.
        </p>
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="text-xl font-semibold">Credits and licences</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
          <li>Code released under the MIT licence.</li>
          <li>
            All artwork is original and drawn in code. No NASA logos or insignia are used, following NASA
            media guidelines.
          </li>
          <li>
            Built with React, TypeScript, Vite, Tailwind CSS, Zustand, dnd-kit and Recharts (all MIT
            licensed).
          </li>
          <li>Fonts: Inter, Space Grotesk and JetBrains Mono (SIL Open Font License).</li>
        </ul>
      </section>
    </div>
  );
}
