// Engine test cases from Doc 04 §12, plus coverage of scheduling, validation, construction and scoring.
import { describe, expect, it } from 'vitest';
import {
  createMission,
  defaultConfig,
  demoConfig,
  dustSky,
  getAlerts,
  getKnownEvents,
  k,
  simulateDay,
  validateDecisions,
  type DayDecisions,
  type GameState,
  type SystemId,
} from '../index';
import { allocatePower } from '../systems/power';
import { Rng } from '../rng';
import { turningPoint } from '../outcome';
import { event, mission, run } from './helpers';

const DEMAND: Record<SystemId, number> = { lifeSupport: 41, thermal: 12, water: 10, greenhouse: 20, lab: 8 };
const DEFAULT_PRIORITY: SystemId[] = ['lifeSupport', 'thermal', 'water', 'greenhouse', 'lab'];

describe('determinism', () => {
  it('T-DET-01: same seed and decisions give identical states and reports', () => {
    const decide = (s: GameState): DayDecisions =>
      s.day === 1
        ? { builds: [{ module: 'battery', targetLevel: 2 }] }
        : s.day % 4 === 0
          ? { dimmers: { lab: 0.5 } }
          : {};
    const a = run(mission(), 30, decide);
    const b = run(mission(), 30, decide);
    expect(a.state).toEqual(b.state);
    expect(a.reports).toEqual(b.reports);
  });

  it('different seeds schedule different events', () => {
    const a = mission({ seed: 'MARS-AAAAAA' }).scheduledEvents;
    const b = mission({ seed: 'MARS-BBBBBB' }).scheduledEvents;
    expect(a).not.toEqual(b);
  });

  it('simulateDay never mutates its input', () => {
    const s = mission();
    const copy = structuredClone(s);
    simulateDay(s, { builds: [{ module: 'solar', targetLevel: 2 }], dimmers: { greenhouse: 0.3 } });
    expect(s).toEqual(copy);
  });
});

describe('power allocation', () => {
  it('T-PWR-01: enough generation with a full battery serves everything and logs waste', () => {
    const r = allocatePower(200, DEMAND, DEFAULT_PRIORITY, 60, 60, 0.5);
    for (const sys of DEFAULT_PRIORITY) expect(r.served[sys]).toBe(1);
    expect(r.wastedKWh).toBeGreaterThan(0);
  });

  it('T-PWR-02: with half the energy, life support and heating are served first', () => {
    const r = allocatePower(45.5, DEMAND, DEFAULT_PRIORITY, 0, 60, 0);
    expect(r.served.lifeSupport).toBe(1);
    expect(r.served.thermal).toBeCloseTo(4.5 / 12);
    expect(r.served.greenhouse).toBe(0);
    expect(r.served.lab).toBe(0);
  });

  it('T-PWR-03: a custom priority puts the lab before the greenhouse', () => {
    const priority: SystemId[] = ['lab', 'lifeSupport', 'thermal', 'water', 'greenhouse'];
    const r = allocatePower(70, DEMAND, priority, 0, 60, 0);
    expect(r.served.lab).toBe(1);
    expect(r.served.greenhouse).toBeLessThan(1);
  });

  it('T-PWR-04: the battery never goes below 0 or above capacity', () => {
    const rng = new Rng(42);
    for (let i = 0; i < 1000; i++) {
      const capacity = rng.range(20, 200);
      const demand = Object.fromEntries(DEFAULT_PRIORITY.map((s) => [s, rng.range(0, 60)])) as Record<
        SystemId,
        number
      >;
      const r = allocatePower(
        rng.range(0, 250),
        demand,
        DEFAULT_PRIORITY,
        rng.range(0, capacity),
        capacity,
        rng.next(),
      );
      expect(r.storedEndKWh).toBeGreaterThanOrEqual(0);
      expect(r.storedEndKWh).toBeLessThanOrEqual(capacity + 1e-9);
    }
  });

  it('reproduces the Doc 04 §11 worked example for Mars day 1', () => {
    const { state, reports } = run(mission({}, []), 1, () => ({ assignments: { bot: 'regolith' } }));
    const m = state.lastDay!;
    expect(m.generationKWh).toBeGreaterThan(80);
    expect(m.generationKWh).toBeLessThan(86);
    expect(m.demand.lifeSupport).toBeCloseTo(41);
    expect(m.wastedKWh).toBeGreaterThan(20);
    expect(reports[0].shed).toHaveLength(0);
    expect(state.resources.o2Kg).toBeCloseTo(40.9);
  });

  it('a small battery causes night-time shedding by day 3 if the player does nothing', () => {
    const { reports } = run(mission({}, []), 3);
    expect(reports[2].shed.length).toBeGreaterThan(0);
    expect(reports[2].chains.some((c) => c.some((l) => l.id === 'smallBattery'))).toBe(true);
  });
});

describe('environment', () => {
  it('T-DUST-01: τ = 3.0 lets about 37% of sunlight through', () => {
    expect(dustSky(3.0)).toBeCloseTo(0.37, 2);
    expect(dustSky(0.5)).toBe(1);
    expect(dustSky(10.8)).toBe(0.1);
  });

  it('panel dust builds up on Mars and manual cleaning removes it', () => {
    const dusty = run(mission({}, []), 5).state;
    expect(dusty.environment.panelDustFactor).toBeLessThan(1);
    const cleaned = simulateDay(dusty, { cleanPanels: true }).next;
    expect(cleaned.environment.panelDustFactor).toBe(1);
  });

  it('a lunar shadow period cuts solar power', () => {
    const s = mission({ location: 'moon', seed: 'MOON-TEST01' }, [
      event('moon.shadow', 1, 2, { illumination: 0.1 }),
    ]);
    const { state } = run(s, 1);
    expect(state.lastDay!.generationKWh).toBeLessThan(15);
  });
});

describe('resources', () => {
  it('T-O2-01: no life-support power with 3 kg of O₂ ends the mission', () => {
    const s = mission({}, []);
    s.resources.o2Kg = 3;
    s.resources.batteryKWh = 0;
    s.modules.solar.condition = 0;
    const { next, report } = simulateDay(s, {});
    expect(next.resources.o2Kg).toBe(0);
    expect(report.outcome?.result).toBe('failure');
    expect(report.outcome?.reason).toBe('o2');
  });

  it('T-H2O-01: a level 3 recycler loses only 2% of crew water', () => {
    const s = mission({}, []);
    s.modules.recycler.level = 3;
    const { next } = simulateDay(s, { dimmers: { greenhouse: 0, lab: 0 } });
    expect(next.lastDay!.served.water).toBe(1);
    expect(s.resources.waterKg - next.resources.waterKg).toBeCloseTo(20 * 0.02);
  });

  it('T-FOOD-01: maturity 0.5 under full light gives area × 120 × 0.5', () => {
    const s = mission({}, []);
    const { next } = simulateDay(s, { assignments: { bot: 'regolith' } });
    expect(next.lastDay!.served.greenhouse).toBeCloseTo(1);
    expect(next.lastDay!.foodHarvestKcal).toBeCloseTo(10 * 120 * 0.5);
  });

  it('the botanist in the greenhouse adds 10% yield', () => {
    const { next } = simulateDay(mission({}, []), {});
    expect(next.lastDay!.foodHarvestKcal).toBeCloseTo(10 * 120 * 0.5 * 1.1);
  });
});

describe('radiation', () => {
  it('T-RAD-01: an SPE on the Moon with the crew in the shelter gives 10% of the unshielded dose', () => {
    const s = mission({ location: 'moon', seed: 'MOON-TEST01' }, [event('spe', 1, 1)]);
    s.modules.stormShelter.level = 1;
    const { next } = simulateDay(s, { shelter: true });
    const speDose = next.crew[0].doseMSv - k('MOON_SURFACE_DOSE');
    expect(speDose).toBeCloseTo(k('SPE_DOSE_UNSHIELDED_MOON') * (1 - k('SHELTER_SPE_REDUCTION')));
  });

  it('T-RAD-02: level 3 shielding on Mars without an SPE gives 0.384 mSv/day', () => {
    const s = mission({}, []);
    s.modules.shielding.level = 3;
    const { next } = simulateDay(s, {});
    expect(next.crew[0].doseMSv).toBeCloseTo(0.384);
  });

  it('EVA crew receive the unshielded dose', () => {
    const s = mission({}, []);
    s.modules.shielding.level = 3;
    const { next, report } = simulateDay(s, { assignments: { sci: 'eva', med: 'eva' } });
    expect(next.lastDay!.evaHappened).toBe(true);
    expect(next.crew.find((c) => c.id === 'sci')!.doseMSv).toBeCloseTo(0.64);
    expect(next.crew.find((c) => c.id === 'sci')!.assignment).toBe('research');
    expect(report.deltas.find((d) => d.key === 'sciencePoints')!.after).toBeGreaterThan(0);
  });
});

describe('alerts', () => {
  it('T-ALR-01: 2.5 days of O₂ left raises a red O2_LOW alert', () => {
    const s = mission({}, []);
    s.resources.o2Kg = 5;
    s.history = [0, 1, 2].map((day) => ({ ...s.history[0], day, o2Kg: 9 - day * 2 }));
    const alert = getAlerts(s).find((a) => a.code === 'O2_LOW');
    expect(alert?.level).toBe('red');
    expect(alert?.daysRemaining).toBeCloseTo(2.5);
  });

  it('alerts are sorted red → amber → info', () => {
    const { state } = run(mission({}, []), 3);
    const order = { red: 0, amber: 1, info: 2 };
    const levels = getAlerts(state).map((a) => order[a.level]);
    expect([...levels].sort()).toEqual(levels);
  });
});

describe('explanations', () => {
  it('T-EXP-01: a dust storm that sheds the greenhouse produces a chain of 3+ links', () => {
    const s = mission({}, [event('mars.dust.regional', 1, 3, { tau: 3.0 })]);
    s.resources.batteryKWh = 30;
    const { report } = simulateDay(s, {});
    const chain = report.chains.find((c) => c.some((l) => l.id === 'shed:greenhouse'));
    expect(chain).toBeDefined();
    expect(chain!.length).toBeGreaterThanOrEqual(3);
    expect(chain![0].cause).toBe('event:mars.dust.regional');
    expect(report.headline).toMatch(/dust storm/i);
    expect(report.tips.length).toBeGreaterThan(0);
  });

  it('a calm first day on Mars still explains the wasted solar energy', () => {
    const { report } = simulateDay(mission({}, []), {});
    expect(report.chains.some((c) => c.some((l) => l.id === 'wasted'))).toBe(true);
  });

  it('every report has a headline and a crew quote', () => {
    const { reports } = run(mission(), 10);
    for (const r of reports) {
      expect(r.headline.length).toBeGreaterThan(0);
      expect(r.crewQuote?.text.length).toBeGreaterThan(0);
      expect(r.headline).not.toMatch(/\{\w+\}/);
    }
  });
});

describe('outcome', () => {
  it('T-OUT-01: day 30 complete with 2 evacuated is a success', () => {
    const s = mission({}, []);
    s.day = 30;
    s.crew[3].status = 'evacuated';
    s.crew[4].status = 'evacuated';
    s.flags.evacuations = 2;
    const { report } = simulateDay(s, {});
    expect(report.outcome?.result).toBe('success');
    expect(report.outcome?.stars).toBeGreaterThanOrEqual(1);
  });

  it('T-OUT-02: food ration below 0.5 for 3 days is a failure', () => {
    const s = mission({}, []);
    s.resources.foodKcal = 0;
    const { state, reports } = run(s, 5, () => ({ dimmers: { greenhouse: 0 } }));
    expect(reports).toHaveLength(3);
    expect(state.outcome?.reason).toBe('food');
  });

  it('three evacuations end the mission', () => {
    const s = mission({}, []);
    for (const c of s.crew.slice(0, 3)) c.health = 1;
    s.resources.foodKcal = 0;
    const { state } = run(s, 1, () => ({ dimmers: { greenhouse: 0 } }));
    expect(state.outcome?.reason).toBe('evacuated');
  });

  it('exceeding the dose budget ends the mission', () => {
    const s = mission({ location: 'moon', seed: 'MOON-TEST01' }, [event('spe', 1, 1)]);
    for (const c of s.crew) c.doseMSv = 60;
    const { state } = run(s, 1);
    expect(state.outcome?.reason).toBe('radiation');
  });

  it('finds the turning point where a resource trend stayed negative', () => {
    const history = [10, 12, 14, 13, 11, 9, 7].map((o2Kg, day) => ({
      day,
      o2Kg,
      waterKg: 0,
      foodKcal: 0,
      batteryKWh: 0,
      generationKWh: 0,
      avgHealth: 100,
      avgDose: 0,
      sciencePoints: 0,
      eventIds: [],
    }));
    expect(turningPoint(history, 'o2')).toBe(4);
  });
});

describe('events', () => {
  it('guarantees a power event in days 4–12, an SPE in days 10–25 and a resupply', () => {
    for (const seed of ['MARS-A1', 'MARS-B2', 'MARS-C3', 'MARS-D4', 'MARS-E5']) {
      for (const location of ['mars', 'moon'] as const) {
        const events = createMission(defaultConfig({ seed, location })).scheduledEvents;
        const power = location === 'mars' ? 'mars.dust.regional' : 'moon.shadow';
        expect(events.some((e) => e.defId === power && e.startDay >= 4 && e.startDay <= 12)).toBe(true);
        expect(events.some((e) => e.defId === 'spe' && e.startDay >= 10 && e.startDay <= 25)).toBe(true);
        expect(events.some((e) => e.defId === 'resupply')).toBe(true);
      }
    }
  });

  it('the global dust storm only appears in Commander missions', () => {
    for (let i = 0; i < 40; i++) {
      const events = createMission(
        defaultConfig({ seed: `MARS-${i}`, difficulty: 'standard' }),
      ).scheduledEvents;
      expect(events.some((e) => e.defId === 'mars.dust.global')).toBe(false);
    }
  });

  it('unwarned events stay hidden until they hit; warned events are forecast', () => {
    const s = mission({}, [
      event('spe', 3, 1, {}, false),
      event('mars.dust.regional', 2, 3, { tau: 2.5 }, true),
    ]);
    const known = getKnownEvents(s);
    expect(known.map((k) => k.event.defId)).toEqual(['mars.dust.regional']);
    expect(known[0].status).toBe('forecast');
  });

  it('the demo mission is 7 days with a scripted storm on day 3', () => {
    const s = createMission(demoConfig());
    expect(s.config.durationDays).toBe(7);
    expect(s.scheduledEvents.find((e) => e.defId === 'mars.dust.regional')?.startDay).toBe(3);
    const { state } = run(s, 7);
    expect(state.outcome).not.toBeNull();
  });

  it('a resupply adds food and build points', () => {
    const s = mission({}, [event('resupply', 1, 1, { foodKcal: 70000, buildPoints: 20 })]);
    const { next, report } = simulateDay(s, {});
    expect(next.resources.foodKcal).toBeGreaterThan(s.resources.foodKcal + 50000);
    expect(report.headline).toMatch(/resupply/i);
  });

  it('a recycler fault lowers recovery until repaired', () => {
    const s = mission({}, [event('fail.recycler', 1, 1, { condition: 0.2 })]);
    const day1 = simulateDay(s, {}).next;
    expect(day1.modules.recycler.condition).toBe(0.2);
    const day2 = simulateDay(day1, { repair: ['recycler'] }).next;
    expect(day2.modules.recycler.repairCompleteDay).toBeDefined();
    const { state } = run(day2, 3);
    expect(state.modules.recycler.condition).toBe(1);
  });
});

describe('construction and validation', () => {
  it('a battery upgrade costs BP and takes effect the next day', () => {
    const s = mission({}, []);
    const day1 = simulateDay(s, { builds: [{ module: 'battery', targetLevel: 2 }] }).next;
    expect(day1.resources.buildPoints).toBe(40 - 12 + 4 + 3 * 2);
    expect(day1.modules.battery.level).toBe(1);
    expect(day1.buildQueue).toEqual([{ module: 'battery', targetLevel: 2, completeOnDay: 2 }]);
    const day2 = simulateDay(day1, {}).next;
    expect(day2.modules.battery.level).toBe(2);
    expect(day2.lastDay!.batteryCapacityKWh).toBe(100);
  });

  it('a greenhouse upgrade adds a new bed that starts from seed', () => {
    const { state } = run(mission({}, []), 3, (s) =>
      s.day === 1 ? { builds: [{ module: 'greenhouse', targetLevel: 2 }] } : {},
    );
    expect(state.greenhouseBeds).toHaveLength(2);
    expect(state.greenhouseBeds[1].plantedDay).toBe(3);
  });

  it('rejects builds that cost more BP than available', () => {
    const s = mission({}, []);
    s.resources.buildPoints = 5;
    const result = validateDecisions(s, { builds: [{ module: 'solar', targetLevel: 2 }] });
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe('BP_SHORT');
  });

  it('requires exactly two crew for an EVA and blocks EVAs in dust storms', () => {
    const s = mission({}, [event('mars.dust.regional', 1, 3, { tau: 3.0 })]);
    expect(validateDecisions(s, { assignments: { sci: 'eva' } }).errors.map((e) => e.code)).toContain(
      'EVA_CREW_COUNT',
    );
    expect(
      validateDecisions(s, { assignments: { sci: 'eva', med: 'eva' } }).errors.map((e) => e.code),
    ).toContain('EVA_DUST');
  });

  it('locks life support at priority 1 in Training', () => {
    const s = mission({ difficulty: 'training' }, []);
    const result = validateDecisions(s, {
      priority: ['thermal', 'lifeSupport', 'water', 'greenhouse', 'lab'],
    });
    expect(result.errors.map((e) => e.code)).toContain('PRIORITY_LOCKED');
  });

  it('needs a storm shelter before sheltering', () => {
    const s = mission({}, []);
    expect(validateDecisions(s, { shelter: true }).errors.map((e) => e.code)).toContain('NO_SHELTER');
  });

  it('applies difficulty multipliers to starting supplies', () => {
    expect(mission({ difficulty: 'training' }).resources.foodKcal).toBe(336000 * 1.5);
    expect(mission({ difficulty: 'commander' }).resources.waterKg).toBe(300 * 0.85);
  });
});

describe('invariants', () => {
  it('T-INV-01: random decisions over 30 days and 500 seeds never produce NaN or negative storage', () => {
    const tasks = ['maintenance', 'greenhouse', 'research', 'regolith', 'eva', 'rest'] as const;
    const modules = [
      'solar',
      'battery',
      'greenhouse',
      'recycler',
      'shielding',
      'stormShelter',
      'cleaningBot',
    ] as const;
    for (let i = 0; i < 500; i++) {
      const rng = new Rng(i);
      const location = i % 2 === 0 ? 'mars' : 'moon';
      const difficulty = (['training', 'standard', 'commander'] as const)[i % 3];
      let s = createMission(defaultConfig({ seed: `INV-${i}`, location, difficulty }));
      for (let d = 0; d < 30 && !s.outcome; d++) {
        const decisions: DayDecisions = {
          dimmers: { greenhouse: rng.next(), lab: rng.next() },
          assignments: Object.fromEntries(s.crew.map((c) => [c.id, rng.pick(tasks)])),
          builds: rng.next() < 0.3 ? [{ module: rng.pick(modules), targetLevel: 2 }] : [],
          shelter: rng.next() < 0.1,
          cleanPanels: rng.next() < 0.1,
          evaMode: rng.next() < 0.5 ? 'drill' : 'survey',
          repair: rng.next() < 0.2 ? ['recycler', 'o2Generator'] : [],
        };
        s = simulateDay(s, decisions).next;
        const r = s.resources;
        for (const value of [r.o2Kg, r.waterKg, r.foodKcal, r.batteryKWh, r.buildPoints]) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
        }
        for (const c of s.crew) {
          expect(c.health).toBeGreaterThanOrEqual(0);
          expect(c.health).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});
