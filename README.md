# AstroBase: Junior Mission Commander

**NASA Space Apps Challenge 2026 — Build a Junior Astronaut Mission Trainer**

Keep five astronauts alive for 30 days on Mars or the Moon. Students share one power supply between life support, heating,
water recycling, a greenhouse and a science lab, then survive dust storms, lunar shadow periods, solar particle events and
equipment failures. After every day, the game explains **what changed, why it changed, and what to try next time**.

Team: **Raza Ullah Khan** (Technical Lead) · **Sahrish** (Product, Design & Science Lead)

## Why it is different

|                                    |                                                                                                                                                                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **"Why did this happen?"**         | Every system logs cause → effect links. The daily report turns them into chains such as _Dust storm (τ 3.0) → Solar power −58% → Power short by 31 kWh → Greenhouse lights cut to 0% → Food grown −1,320 kcal_.                                 |
| **Every number has a source**      | All constants live in [`src/content/constants.json`](src/content/constants.json), each labelled **REF** (NASA or peer-reviewed source) or **GAME** (our simplification, with the reason). The Science Library page is generated from that file. |
| **Moon and Mars play differently** | Mars: dust storms, dusty panels, half of every sol is night. Moon: strong sunlight but shadow periods, double the radiation, and polar ice to drill.                                                                                            |
| **Deterministic**                  | Same mission code + same choices ⇒ identical mission. Teachers can give a whole class the same events.                                                                                                                                          |
| **Runs anywhere**                  | Static site, no login, no tracking, works offline once loaded. Initial JavaScript ≈ 145 KB gzipped.                                                                                                                                             |
| **Dark and light mode** | A toggle in every header switches themes. It follows the device setting until the player chooses, and remembers the choice. |

## Run it

```bash
npm install
npm run dev        # development server on http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

| Script                         | Purpose                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `npm test`                     | Engine unit and scenario tests (Vitest)                            |
| `npm run coverage`             | Tests with engine coverage report                                  |
| `npm run lint`                 | ESLint, including the layering rules below                         |
| `npm run typecheck`            | TypeScript in strict mode                                          |
| `npm run balance -- 300 --csv` | Runs 300 bot missions per difficulty/location; optional CSV output |

Deploy: any static host. `vercel.json` rewrites all routes to `index.html` for client-side routing.

## Pages

| Route      | Page                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------- |
| `/`        | Landing (Start, Continue, 2-minute demo, For teachers)                                             |
| `/setup`   | Destination, difficulty, mission code. Accepts `?seed=&loc=&diff=` from teacher links              |
| `/play`    | Mission Control. `/play?demo=1` starts the scripted 7-sol judge demo                               |
| `/debrief` | Result, score, star rating, turning point, three lessons, timeline chart, downloadable summary     |
| `/library` | Science Library: every constant with value, unit, REF/GAME label and source                        |
| `/teacher` | Shareable class link, learning objectives, 30-minute lesson plan, discussion questions, print view |
| `/about`   | Team, method, data sources, licences                                                               |

## Architecture

```
src/
  engine/    Pure TypeScript simulation. No React, no browser APIs (enforced by ESLint).
  content/   JSON data: constants + sources, scenarios, events, modules, objectives, tips, copy.
  store/     Zustand store: validation → simulateDay → auto-save; undo; event notices.
  ui/        React pages and components (Tailwind, dnd-kit, Recharts).
```

The engine's public API ([`src/engine/index.ts`](src/engine/index.ts)):

```ts
createMission(config): GameState
simulateDay(state, decisions): { next: GameState; report: DayReport }   // never mutates input
validateDecisions(state, decisions): ValidationResult
getForecast(state) / getAlerts(state) / previewPower(state, decisions)
```

One call to `simulateDay` runs the ordered tick pipeline: decisions → events → environment → construction →
power generation, demand and load shedding → oxygen → water → food → radiation → crew health → science → build points →
outcome, alerts and explanations. The RNG (mulberry32) state is part of `GameState`, so every run is reproducible.

## Simulation model (summary)

- **Power couples everything.** Each system asks for energy. If solar plus battery cannot cover demand, systems are served in
  the player's priority order. A system that gets 60% of its power produces 60% of its output.
- **Day/night battery model.** On Mars half of each sol's load must come from the battery, so a small battery causes night
  shortages even when total solar energy is enough. Surplus beyond battery capacity is wasted and reported.
- **Oxygen** by electrolysis at 7 kWh/kg (the 5.0 kWh/kg thermodynamic minimum at ~70% efficiency).
- **Water** recycled at 85/93/98% by recycler level. Without power, used water waits in a 120 kg holding tank instead of
  being destroyed; overflow is lost.
- **Food** from greenhouse beds that take 10 days to mature, scaled by light and the Botanist.
- **Radiation** from cosmic rays (Curiosity RAD on Mars, Chang'e-4 on the Moon) plus solar particle events, reduced by regolith
  shielding and the storm shelter.

The simulation equations are implemented in [`src/engine/systems/`](src/engine/systems/) and use the sourced values in
[`src/content/constants.json`](src/content/constants.json).

## Balancing

`npm run balance` plays every location and difficulty with the three included bots. Results at 300 missions per cell:

| Survival rate                                               | Mars Training | Mars Standard | Mars Commander | Moon Training | Moon Standard | Moon Commander |
| ----------------------------------------------------------- | ------------- | ------------- | -------------- | ------------- | ------------- | -------------- |
| passive (never acts)                                        | 39%           | 19%           | 0%             | 0%            | 0%            | 0%             |
| greedy-science (lab + EVAs only)                            | 37%           | 11%           | 0%             | 0%            | 0%            | 0%             |
| sensible (storage first, shelters, dims in storms, repairs) | 97%           | 93%           | 65%            | 96%           | 85%           | 66%            |

The Standard-difficulty tuning targets are passive 0–15%, greedy 20–40% and sensible 75–90%. Sensible is on target. Mars
passive is 4 points above its target. Greedy-science is below its target because it never builds anything, so it fails the way
the passive bot does. Only GAME values were changed during tuning.

## Tests

43 Vitest tests cover determinism, load shedding, battery invariants, dust attenuation, oxygen failure,
water recovery, harvest, radiation with shelter and shielding, alerts, causal chains, win/lose conditions) plus event
scheduling guarantees, demo script, construction timing, validation rules and a 500-seed random-decision invariant test.

## Data sources

NASA BVAD (2018) · Hassler et al. 2014 (Curiosity RAD) · Zhang et al. 2020 (Chang'e-4 LND) · NASA-STD-3001 (2022) ·
NASA ISS ECLSS water recovery (2023) · NASA/JPL 2018 global dust storm reports · Kopp & Lean 2011 · Mazarico et al. 2011 ·
NASA Mars Facts. Values marked "check in progress" in the Science Library are still being verified against the source.

## Licence

MIT — see [LICENSE](LICENSE). Fonts are under the SIL Open Font License. All artwork is drawn in code.
