// Typed access to content/constants.json (ADR-06, NFR-09).
// The engine never hard-codes a game number: every value is read from here.
import constants from '../content/constants.json';
import modulesJson from '../content/modules.json';
import eventsJson from '../content/events.json';
import marsScenario from '../content/scenarios/mars.json';
import moonScenario from '../content/scenarios/moon.json';
import crewJson from '../content/crew.json';
import type { CrewRole, CrewTask, Difficulty, EventDefinition, Location, ModuleId } from './types';

type ConstantKey = keyof typeof constants;

/** Read a scalar constant. */
export function k(key: ConstantKey): number {
  const value = constants[key].value;
  if (typeof value !== 'number') throw new Error(`Constant ${key} is not a scalar`);
  return value;
}

/** Read one element of an array constant, clamping the index to the array bounds. */
export function kAt(key: ConstantKey, index: number): number {
  const value = constants[key].value;
  if (!Array.isArray(value)) throw new Error(`Constant ${key} is not an array`);
  const i = Math.max(0, Math.min(value.length - 1, index));
  return value[i];
}

/** Pick the Mars or Moon variant of a location-specific constant. */
export function kLoc(location: Location, marsKey: ConstantKey, moonKey: ConstantKey): number {
  return k(location === 'mars' ? marsKey : moonKey);
}

const DIFFICULTY_INDEX: Record<Difficulty, number> = { training: 0, standard: 1, commander: 2 };

export function difficultyFactor(
  key: 'DIFFICULTY_RESERVE_MULTIPLIER' | 'EVENT_FREQUENCY_MULTIPLIER',
  d: Difficulty,
) {
  return kAt(key, DIFFICULTY_INDEX[d]);
}

export interface ModuleDefinition {
  name: string;
  description: string;
  maxLevel: number;
  costBP: number;
  buildDays: number;
  buildable: boolean;
  repairable: boolean;
  locations: Location[];
  effect: Record<Location, string>;
}

export const MODULE_DEFS = modulesJson as Record<ModuleId, ModuleDefinition>;

export const EVENT_DEFS = eventsJson as EventDefinition[];

export function eventDef(id: string): EventDefinition {
  const def = EVENT_DEFS.find((e) => e.id === id);
  if (!def) throw new Error(`Unknown event definition: ${id}`);
  return def;
}

export interface ScenarioDefinition {
  location: Location;
  name: string;
  site: string;
  pitch: string;
  facts: { label: string; value: string }[];
  modules: Record<ModuleId, number>;
}

export const SCENARIOS: Record<Location, ScenarioDefinition> = {
  mars: marsScenario as ScenarioDefinition,
  moon: moonScenario as ScenarioDefinition,
};

export interface CrewDefinition {
  id: string;
  name: string;
  role: CrewRole;
  defaultTask: CrewTask;
}

export const CREW_DEFS = crewJson as CrewDefinition[];
