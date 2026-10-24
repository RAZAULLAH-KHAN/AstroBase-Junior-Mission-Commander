// Derived values computed from state. Pure functions shared by systems, alerts and previews.
import { k, kAt, kLoc, MODULE_DEFS } from './constants';
import type { CrewMember, CrewRole, CrewTask, GameState, ModuleId } from './types';

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function solarAreaM2(s: GameState): number {
  const level = s.modules.solar.level;
  const base = kLoc(s.config.location, 'SOLAR_AREA_BASE_MARS', 'SOLAR_AREA_BASE_MOON');
  const perLevel = kLoc(s.config.location, 'SOLAR_AREA_PER_LEVEL_MARS', 'SOLAR_AREA_PER_LEVEL_MOON');
  return base + perLevel * (level - 1);
}

export function batteryNominalKWh(s: GameState): number {
  return k('BATTERY_BASE') + k('BATTERY_PER_LEVEL') * (s.modules.battery.level - 1);
}

export function batteryCapacityKWh(s: GameState): number {
  return batteryNominalKWh(s) * s.modules.battery.condition;
}

export function greenhouseAreaM2(s: GameState): number {
  return s.greenhouseBeds.reduce((sum, bed) => sum + bed.areaM2, 0);
}

export function recyclerRate(s: GameState): number {
  return kAt('RECYCLER_RATE_BY_LEVEL', s.modules.recycler.level - 1);
}

export function doseBudgetMSv(s: GameState): number {
  return kLoc(s.config.location, 'MISSION_DOSE_BUDGET_MARS', 'MISSION_DOSE_BUDGET_MOON');
}

export function baseDoseMSv(s: GameState): number {
  return kLoc(s.config.location, 'MARS_SURFACE_GCR_DOSE', 'MOON_SURFACE_DOSE');
}

export function speDoseMSv(s: GameState): number {
  return kLoc(s.config.location, 'SPE_DOSE_UNSHIELDED_MARS', 'SPE_DOSE_UNSHIELDED_MOON');
}

export function thermalDemandKWh(s: GameState): number {
  return kLoc(s.config.location, 'THERMAL_DEMAND_MARS', 'THERMAL_DEMAND_MOON');
}

/** Crew who are still on the base (they breathe, drink and eat). */
export function presentCrew(s: GameState): CrewMember[] {
  return s.crew.filter((c) => c.status !== 'evacuated');
}

/** Crew who can work today (not sick, not evacuated). */
export function availableCrew(s: GameState): CrewMember[] {
  return s.crew.filter((c) => c.status !== 'evacuated' && c.status !== 'sick');
}

export function isWorking(c: CrewMember): boolean {
  return c.status === 'active' || c.status === 'onEVA';
}

export function roleWorkingOn(s: GameState, role: CrewRole, task: CrewTask): boolean {
  return s.crew.some((c) => c.role === role && c.status === 'active' && c.assignment === task);
}

export function roleAvailable(s: GameState, role: CrewRole): boolean {
  return s.crew.some((c) => c.role === role && c.status !== 'evacuated' && c.status !== 'sick');
}

export function averageDoseMSv(s: GameState): number {
  return s.crew.reduce((sum, c) => sum + c.doseMSv, 0) / s.crew.length;
}

export function averageHealth(s: GameState): number {
  return s.crew.reduce((sum, c) => sum + (c.status === 'evacuated' ? 0 : c.health), 0) / s.crew.length;
}

export function bedMaturity(plantedDay: number, day: number): number {
  return clamp((day - plantedDay) / k('GH_MATURITY_DAYS'), 0, 1);
}

export function moduleName(id: ModuleId): string {
  return MODULE_DEFS[id].name;
}
