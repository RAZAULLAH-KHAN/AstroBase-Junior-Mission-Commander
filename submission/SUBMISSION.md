# AstroBase: Junior Mission Commander — Submission Pack

**NASA Space Apps Challenge 2026 · Challenge: Build a Junior Astronaut Mission Trainer**
**Team:** WAYBACK · Multan, Pakistan · **Member:** Raza Ullah Khan (team owner, developer)

| What           | Link                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| Play the game  | https://razaullah-khan.github.io/AstroBase-Junior-Mission-Commander/                     |
| 2-minute demo  | https://razaullah-khan.github.io/AstroBase-Junior-Mission-Commander/play?demo=1          |
| Source code    | https://github.com/RAZAULLAH-KHAN/AstroBase-Junior-Mission-Commander                     |
| Presentation   | [`AstroBase-WAYBACK.pptx`](AstroBase-WAYBACK.pptx) (also in the repository)              |
| Screenshots    | [`screenshots/`](screenshots/)                                                           |

---

## 1. Team About text (for the WAYBACK team page)

> WAYBACK is a team from Multan, Pakistan. We built AstroBase: Junior Mission Commander, a browser game where children
> aged 7 to 12 keep five astronauts alive for 30 days on Mars or the Moon. Every choice costs something: power for air,
> heat, water, food or science, and shielding against solar storms that follow real NASA space weather data.

## 2. High-level project summary (short)

AstroBase is a free browser game where kids run a base on Mars or the Moon for 30 days. One shared power supply feeds life
support, heating, water recycling, a greenhouse and a science lab, so every choice costs something. Before each mission the
game reads real space weather from NASA's DONKI database: a busy Sun means more solar storms, so the player must decide how
much to invest in radiation shielding. After every day, the game explains what changed, why, and what to try next time.
It needs no download and no account, and it works offline once loaded.

## 3. Project details

### What it does

- The player chooses **Mars or the Moon**, a **difficulty**, and the **Sun conditions** (live NASA DONKI data, or a recorded
  period such as the May 2024 solar storms).
- Each turn is one day (a **sol** on Mars). The player sets **power priorities**, dims the greenhouse or lab, builds
  modules (solar, battery, recycler, greenhouse, regolith shielding, storm shelter), gives the five crew members jobs, and
  plans spacewalks (EVAs).
- Events vary between runs: dust storms, lunar shadow periods, **solar particle events**, equipment failures, crop disease,
  crew illness and a resupply lander.
- After each day, a **report** shows a chain of causes, for example
  _Dust storm → solar power −58% → power short by 31 kWh → greenhouse lights cut → food grown −1,320 kcal_.
- At the end, a **debrief** gives a score, the turning point, three lessons that start with what actually ended the mission,
  and a timeline chart.

### The trade-offs (core rules from the brief)

| Resource       | What it costs                                                                       |
| -------------- | ----------------------------------------------------------------------------------- |
| Power          | Everything runs on it. Air, heat, water, food and science compete for every kWh.     |
| Life support   | Oxygen by electrolysis costs 7 kWh per kg. Cutting power saves energy but risks air. |
| Radiation      | Shielding and the storm shelter cost build points and crew time that could grow food. |

There is no free "safe" option: shielding early slows food and science, skipping it risks the radiation budget.

### How real NASA data changes the game

| Dataset                                              | How the game uses it                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **DONKI** (Space Weather Database), SEP + CME        | Live call for the last 30 days. Proton events seen by GOES (above 10 MeV and 100 MeV) and the number of coronal mass ejections set the sun level: Quiet, Active or Stormy. That multiplies the daily chance of a solar particle event by 0.5, 1 or 2.                              |
| **DONKI** recorded periods (downloaded 14 Nov 2026)  | Fallback when NASA cannot be reached, and fixed periods for classrooms: May 2024 and October 2024 (Stormy), 15 Sep to 13 Nov 2026 (Active: 0 particle events, 174 CMEs, 3 geomagnetic storms), June to July 2019 (Quiet). Always labelled with dates and never shown as live. |
| NASA BVAD (2018)                                     | Oxygen, water and food needed per astronaut per day.                                                                                                                                                                                                                                 |
| Curiosity RAD (Hassler et al. 2014)                  | Daily cosmic-ray dose on the surface of Mars.                                                                                                                                                                                                                                        |
| NASA-STD-3001 (2022)                                 | Career radiation limit (600 mSv) shown next to the mission budget.                                                                                                                                                                                                                   |
| NASA ISS ECLSS water recovery (2023)                 | Water recycler efficiency levels (85 / 93 / 98%).                                                                                                                                                                                                                                    |
| NASA/JPL 2018 global dust storm reports              | Dust optical depth (τ) and its effect on solar panels.                                                                                                                                                                                                                               |
| LOLA lunar polar illumination (Mazarico et al. 2011) | Sunlit share of the day at the lunar south pole and shadow periods.                                                                                                                                                                                                                  |
| NASA Mars Facts                                      | Sol length, gravity, sunlight.                                                                                                                                                                                                                                                       |
| Partner data: Chang'e-4 LND (Zhang et al. 2020)      | Daily radiation dose on the lunar surface.                                                                                                                                                                                                                                           |

Every number lives in `src/content/constants.json`, labelled **REF** (sourced) or **GAME** (our simplification, with the
reason). The in-game **Science Library** page lists all of them with sources, so judges can check the science. Values still
being checked against their source are marked "check in progress".

**Not used:** the brief also suggests OSDR (astronaut dosimetry) and Artemis surface data. We did not integrate these
datasets in this version. Radiation doses come from Curiosity RAD and Chang'e-4 measurements instead.

### Benefits and intended impact

- Kids leave knowing a real constraint: **solar storms are dangerous, shielding and shelters work, and forecasts matter.**
- Teachers can create a class link (`/teacher`) so every student plays the same mission and the same recorded Sun, then
  compare choices. A 30-minute lesson plan and discussion questions are included.
- Failure teaches without punishing: the debrief always explains the cause and the fix.

### Tools, languages and hardware

TypeScript, React 18, Vite, Tailwind CSS, Zustand, dnd-kit, Recharts, Vitest, ESLint, Prettier, GitHub Actions and GitHub
Pages. No special hardware. Runs in any modern browser on desktop, tablet or phone.

### Quality

- 46 automated tests (determinism, load shedding, battery, oxygen, water, food, radiation with shelter and shielding,
  alerts, causal chains, win/lose, event scheduling, sun activity from DONKI, demo script).
- A balance simulator plays thousands of missions with three bots. On Standard, a sensible player survives 85 to 93% with a
  normal Sun, 69 to 81% with a stormy Sun, and 92 to 97% with a quiet Sun. A player who never acts fails on the Moon every time.
- Accessible: keyboard play, status shown with text as well as colour, large-text mode, reduced motion, light and dark themes.

## 4. Use of Super Intelligence (AI) tools

> Draft. Check it matches how you worked and edit before submitting. The rules ask for an honest description.

We used **Claude (Anthropic), through Claude Code**, as a coding assistant. It helped write and refactor TypeScript and React
code, write automated tests, run the balance simulator, connect the NASA DONKI API, apply our colour palette (cream, ink
black and burnt orange), find and fix bugs found during play-testing, and draft this write-up and the presentation.
The team chose the game design, the trade-offs and the data sources, reviewed the changes, and play-tested the game.
All science values are cited in the Science Library so they can be checked independently. No AI-generated images are used:
all artwork is drawn in code. No NASA logos or insignia are used.

## 5. Checklist before the deadline (Sun 15 Nov 2026, 11:59 PM PKT)

- [ ] Repository **Settings → Pages → Source: GitHub Actions**, then confirm the "Play the game" link above opens.
- [ ] Replace the team About text ("LOOKING FOR INTERESTED ONE.") with section 1 above.
- [ ] Project tab: title, summary (section 2), details (section 3), AI use (section 4), links, presentation.
- [ ] Re-read the Project Submission Guide and Judging & Awards Guide (published 13 Nov) for any extra fields, such as a
      short demo video.
- [ ] Submit, then fill in the participant survey by 1 Dec.
