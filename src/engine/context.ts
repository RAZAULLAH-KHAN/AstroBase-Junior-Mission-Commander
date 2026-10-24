// Shared state for one tick of the pipeline (Doc 03 §6).
import type { Rng } from './rng';
import type {
  ActiveEvent,
  CausalLink,
  DayDecisions,
  DayMetrics,
  EvaMode,
  GameState,
  ModuleId,
  ObjectiveId,
  Resources,
  SystemId,
} from './types';

export interface TickContext {
  /** Draft state: a deep copy that the steps are allowed to mutate. */
  s: GameState;
  /** The state as it was before the tick (read-only). */
  before: GameState;
  decisions: DayDecisions;
  rng: Rng;
  day: number;
  log: CausalLink[];
  metrics: DayMetrics;
  todayEvents: ActiveEvent[];
  startedEvents: string[];
  objectivesCompleted: ObjectiveId[];
  eva: { happened: boolean; mode: EvaMode; crewIds: string[] };
  shelter: boolean;
  cleanerId: string | null; // crew member doing manual panel cleaning
  cleanedBy: 'manual' | 'robot' | null;
  shortages: { o2: boolean; water: boolean };
  foodRation: number;
  doseToday: Record<string, number>;
  evacuatedToday: string[];
  buildsCompleted: { module: ModuleId; level: number }[];
  repairsCompleted: ModuleId[];
  failuresToday: ModuleId[];
  /** Potential output if each system had been fully served; used to explain shedding. */
  potential: Partial<Record<SystemId, number>>;
  resourcesBefore: Resources;
}

export function emptyServed(): Record<SystemId, number> {
  return { lifeSupport: 1, thermal: 1, water: 1, greenhouse: 1, lab: 1 };
}

export function emptyDemand(): Record<SystemId, number> {
  return { lifeSupport: 0, thermal: 0, water: 0, greenhouse: 0, lab: 0 };
}

export function addLink(ctx: TickContext, link: CausalLink): string {
  ctx.log.push(link);
  return link.id;
}

export function findLink(ctx: TickContext, id: string): CausalLink | undefined {
  return ctx.log.find((l) => l.id === id);
}
