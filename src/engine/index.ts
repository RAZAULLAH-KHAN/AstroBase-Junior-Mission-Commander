// Public API of the simulation engine. The UI and store import only from here.
import type { GameState, Outcome } from './types';

export { createMission, defaultConfig, demoConfig, DEFAULT_PRIORITY, DEMO_DURATION_DAYS } from './mission';
export { simulateDay } from './pipeline';
export { getForecast, getAlerts, resourceAlertLevel } from './alerts';
export { validateDecisions, outdoorBlock, plannedEvaCrew } from './decisions';
export { previewPower, dustSky } from './systems/power';
export { getKnownEvents } from './events/scheduler';
export { canBuild, canRepair, repairDays } from './construction';
export { OBJECTIVES } from './systems/science';
export { generateSeed, normalizeSeed } from './rng';
export {
  batteryCapacityKWh,
  greenhouseAreaM2,
  solarAreaM2,
  doseBudgetMSv,
  averageDoseMSv,
  averageHealth,
  bedMaturity,
  recyclerRate,
} from './helpers';
export { MODULE_DEFS, EVENT_DEFS, SCENARIOS, CREW_DEFS, eventDef, k } from './constants';
export type { ModuleDefinition, ScenarioDefinition } from './constants';
export * from './types';

export function computeOutcome(state: GameState): Outcome | null {
  return state.outcome;
}
