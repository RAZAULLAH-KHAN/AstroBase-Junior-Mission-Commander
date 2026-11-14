// Mission creation.
import { CREW_DEFS, difficultyFactor, k, kLoc, SCENARIOS } from './constants';
import { scheduleEvents } from './events/scheduler';
import { averageDoseMSv, averageHealth, batteryNominalKWh } from './helpers';
import { Rng, seedFromString } from './rng';
import {
  MODULE_IDS,
  type DaySnapshot,
  type GameState,
  type MissionConfig,
  type ModuleId,
  type ModuleState,
} from './types';

export const DEFAULT_PRIORITY = ['lifeSupport', 'thermal', 'water', 'greenhouse', 'lab'] as const;
export const DEMO_DURATION_DAYS = 7;

export function defaultConfig(partial: Partial<MissionConfig> = {}): MissionConfig {
  return {
    location: 'mars',
    difficulty: 'standard',
    seed: 'MARS-AAAAAA',
    durationDays: k('MISSION_DAYS'),
    crewSize: k('CREW_SIZE'),
    ...partial,
  };
}

export function demoConfig(): MissionConfig {
  return defaultConfig({
    location: 'mars',
    difficulty: 'training',
    seed: 'DEMO-MARS',
    durationDays: DEMO_DURATION_DAYS,
    demo: true,
  });
}

export function snapshot(s: GameState, day: number, eventIds: string[], generationKWh: number): DaySnapshot {
  return {
    day,
    o2Kg: s.resources.o2Kg,
    waterKg: s.resources.waterKg,
    foodKcal: s.resources.foodKcal,
    batteryKWh: s.resources.batteryKWh,
    generationKWh,
    avgHealth: averageHealth(s),
    avgDose: averageDoseMSv(s),
    sciencePoints: s.science.points,
    eventIds,
  };
}

export function createMission(config: MissionConfig): GameState {
  const rng = new Rng(seedFromString(`${config.seed}|${config.location}|${config.difficulty}`));
  const scenario = SCENARIOS[config.location];
  const reserve = difficultyFactor('DIFFICULTY_RESERVE_MULTIPLIER', config.difficulty);

  const modules = Object.fromEntries(
    MODULE_IDS.map((id) => [id, { level: scenario.modules[id], condition: 1 } satisfies ModuleState]),
  ) as Record<ModuleId, ModuleState>;

  const plantedDay = 1 - k('START_GH_MATURITY') * k('GH_MATURITY_DAYS');
  const greenhouseBeds = Array.from({ length: modules.greenhouse.level }, () => ({
    areaM2: k('GH_AREA_PER_LEVEL'),
    plantedDay,
    harvestedFull: false,
  }));

  const state: GameState = {
    schemaVersion: 1,
    config,
    day: 1,
    rngState: 0,
    resources: {
      o2Kg: Math.min(k('O2_TANK_MAX'), k('START_O2_KG') * reserve),
      waterKg: kLoc(config.location, 'START_WATER_MARS', 'START_WATER_MOON') * reserve,
      wastewaterKg: 0,
      foodKcal: k('START_FOOD_KCAL') * reserve,
      batteryKWh: 0,
      buildPoints: k('START_BP'),
    },
    modules,
    buildQueue: [],
    greenhouseBeds,
    power: { priority: [...DEFAULT_PRIORITY], dimmers: { greenhouse: 1, lab: 1 } },
    environment: {
      dustOpticalDepth: config.location === 'mars' ? k('MARS_CLEAR_TAU') : 0,
      panelDustFactor: 1,
      illuminationFraction:
        config.location === 'mars' ? 1 - k('MARS_NIGHT_FRACTION') : k('MOON_BASE_ILLUMINATION'),
      solarActivity: 'quiet',
    },
    crew: CREW_DEFS.slice(0, config.crewSize).map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      health: 100,
      doseMSv: 0,
      status: 'active',
      assignment: c.defaultTask,
    })),
    science: { points: 0, objectivesDone: [], evaCount: 0, drillEvaCount: 0, labDays: 0 },
    scheduledEvents: [],
    activeEvents: [],
    history: [],
    lastDay: null,
    flags: {
      undoUsed: false,
      lifeSupportShedDays: 0,
      foodZeroStreak: 0,
      batteryWasteStreak: 0,
      stormLifeSupportShed: [],
      evacuations: 0,
    },
    outcome: null,
  };
  state.resources.batteryKWh = batteryNominalKWh(state);
  state.scheduledEvents = scheduleEvents(config, rng);
  state.rngState = rng.state;
  state.history.push(snapshot(state, 0, [], 0));
  return state;
}
