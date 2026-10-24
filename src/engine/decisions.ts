// Player decisions: validation for the UI, and sanitised application inside the engine (pipeline step 1).
import { k, MODULE_DEFS } from './constants';
import { canBuild, canRepair, placeOrders } from './construction';
import type { TickContext } from './context';
import { getKnownEvents } from './events/scheduler';
import { presentCrew } from './helpers';
import { assignStatuses } from './systems/crew';
import {
  CREW_TASKS,
  SYSTEM_IDS,
  type CrewMember,
  type CrewTask,
  type DayDecisions,
  type GameState,
  type SystemId,
  type ValidationIssue,
  type ValidationResult,
} from './types';

export type WeatherBlock = 'dust' | 'spe' | null;

/** Whether outdoor work is unsafe today, judged only from what the player knows. */
export function outdoorBlock(s: GameState): WeatherBlock {
  const known = getKnownEvents(s);
  if (known.some((e) => e.def.kind === 'spe')) return 'spe';
  const storm = known.find((e) => e.def.kind === 'dustStorm' && e.status === 'active');
  if (storm && storm.event.params.tau > k('EVA_MAX_TAU')) return 'dust';
  return null;
}

function isPermutation(priority: SystemId[]): boolean {
  return priority.length === SYSTEM_IDS.length && SYSTEM_IDS.every((id) => priority.includes(id));
}

function effectiveTask(c: CrewMember, d: DayDecisions): CrewTask {
  return d.assignments?.[c.id] ?? c.assignment;
}

function isSick(s: GameState, c: CrewMember): boolean {
  return c.sickUntilDay !== undefined && c.sickUntilDay >= s.day;
}

export function plannedEvaCrew(s: GameState, d: DayDecisions): CrewMember[] {
  return presentCrew(s).filter((c) => effectiveTask(c, d) === 'eva');
}

export function validateDecisions(s: GameState, d: DayDecisions): ValidationResult {
  const errors: ValidationIssue[] = [];
  const add = (code: string, message: string) => errors.push({ code, message });

  if (s.outcome) add('MISSION_OVER', 'The mission is over.');

  if (d.priority) {
    if (!isPermutation(d.priority))
      add('PRIORITY_INVALID', 'Every system must appear once in the priority list.');
    else if (s.config.difficulty === 'training' && d.priority[0] !== 'lifeSupport') {
      add('PRIORITY_LOCKED', 'In Training, life support always stays at priority 1.');
    }
  }

  for (const [sys, value] of Object.entries(d.dimmers ?? {})) {
    if (value < 0 || value > 1 || Number.isNaN(value))
      add('DIMMER_RANGE', `${sys} power must be between 0% and 100%.`);
  }

  for (const [crewId, task] of Object.entries(d.assignments ?? {})) {
    const member = s.crew.find((c) => c.id === crewId);
    if (!member) add('CREW_UNKNOWN', `Unknown crew member ${crewId}.`);
    else if (member.status === 'evacuated') add('CREW_EVACUATED', `${member.name} has been evacuated.`);
    if (!CREW_TASKS.includes(task)) add('TASK_UNKNOWN', `Unknown task ${task}.`);
  }

  // Construction and repairs share the build-point budget.
  let costBP = 0;
  const seen = new Set<string>();
  for (const build of d.builds ?? []) {
    const def = MODULE_DEFS[build.module];
    if (seen.has(build.module)) add('BUILD_DUPLICATE', `${def.name} is already ordered.`);
    seen.add(build.module);
    const check = canBuild(s, build.module);
    if (!check.ok) add('BUILD_INVALID', `${def.name}: ${check.reason}`);
    else if (build.targetLevel !== s.modules[build.module].level + 1)
      add('BUILD_LEVEL', `${def.name}: invalid level.`);
    costBP += def.costBP;
  }
  for (const module of d.repair ?? []) {
    const check = canRepair(s, module);
    if (!check.ok) add('REPAIR_INVALID', `${MODULE_DEFS[module].name}: ${check.reason}`);
    costBP += k('REPAIR_COST_BP');
  }
  if (costBP > s.resources.buildPoints) {
    add('BP_SHORT', `Not enough build points: need ${costBP}, have ${Math.floor(s.resources.buildPoints)}.`);
  }

  const block = outdoorBlock(s);
  const evaCrew = plannedEvaCrew(s, d);
  if (evaCrew.length > 0) {
    if (evaCrew.length !== 2)
      add('EVA_CREW_COUNT', `An EVA needs exactly 2 crew (${evaCrew.length} assigned).`);
    for (const c of evaCrew) {
      if (isSick(s, c)) add('EVA_SICK', `${c.name} is sick and cannot go outside.`);
      else if (c.health < k('EVA_MIN_HEALTH'))
        add('EVA_HEALTH', `${c.name} needs at least ${k('EVA_MIN_HEALTH')} health for an EVA.`);
    }
    if (block === 'dust') add('EVA_DUST', 'EVAs are not safe in a thick dust storm.');
    if (block === 'spe') add('EVA_SPE', 'EVAs are not allowed when a solar storm is active or forecast.');
    if (d.shelter) add('EVA_SHELTER', 'The crew cannot shelter and go on an EVA on the same day.');
  }

  if (d.shelter && s.modules.stormShelter.level < 1) add('NO_SHELTER', 'Build a Storm Shelter first.');

  if (d.cleanPanels) {
    if (s.config.location !== 'mars') add('CLEAN_LOCATION', 'Panels only need cleaning on Mars.');
    const cleaner = presentCrew(s).find((c) => !isSick(s, c) && effectiveTask(c, d) === 'maintenance');
    if (!cleaner) add('CLEAN_NO_CREW', 'Assign a healthy crew member to Maintenance to clean the panels.');
    if (block) add('CLEAN_WEATHER', 'It is not safe to clean the panels in this weather.');
    if (d.shelter) add('CLEAN_SHELTER', 'The crew cannot clean panels while sheltering.');
  }

  return { ok: errors.length === 0, errors };
}

/** Step 1: apply decisions defensively. Invalid parts are ignored so the engine never crashes. */
export function applyDecisions(ctx: TickContext): void {
  const { s, decisions: d } = ctx;

  if (d.priority && isPermutation(d.priority)) s.power.priority = [...d.priority];
  if (s.config.difficulty === 'training' && s.power.priority[0] !== 'lifeSupport') {
    s.power.priority = ['lifeSupport', ...s.power.priority.filter((x) => x !== 'lifeSupport')];
  }
  for (const sys of ['greenhouse', 'lab'] as const) {
    const value = d.dimmers?.[sys];
    if (value !== undefined && !Number.isNaN(value)) s.power.dimmers[sys] = Math.min(1, Math.max(0, value));
  }

  for (const c of s.crew) {
    const task = d.assignments?.[c.id];
    if (!task || c.status === 'evacuated' || !CREW_TASKS.includes(task)) continue;
    if (task === 'eva' && c.assignment !== 'eva') c.previousAssignment = c.assignment;
    c.assignment = task;
  }

  const block = outdoorBlock(ctx.before);
  ctx.shelter = Boolean(d.shelter) && s.modules.stormShelter.level >= 1;
  assignStatuses(ctx);

  const evaCrew = s.crew.filter((c) => c.status === 'active' && c.assignment === 'eva');
  const evaAllowed =
    evaCrew.length === 2 && !block && !ctx.shelter && evaCrew.every((c) => c.health >= k('EVA_MIN_HEALTH'));
  if (evaAllowed) {
    for (const c of evaCrew) c.status = 'onEVA';
    ctx.eva = { happened: true, mode: d.evaMode ?? 'survey', crewIds: evaCrew.map((c) => c.id) };
  } else {
    cancelEva(ctx);
  }

  if (d.cleanPanels && s.config.location === 'mars' && !block && !ctx.shelter) {
    const cleaner = s.crew.find((c) => c.status === 'active' && c.assignment === 'maintenance');
    ctx.cleanerId = cleaner?.id ?? null;
  }

  placeOrders(ctx, d);
}

/** Crew assigned to an EVA that cannot happen go back to their previous job for the day. */
export function cancelEva(ctx: TickContext): void {
  ctx.eva = { happened: false, mode: ctx.eva.mode, crewIds: [] };
  for (const c of ctx.s.crew) {
    if (c.assignment !== 'eva') continue;
    c.assignment = c.previousAssignment ?? 'maintenance';
    delete c.previousAssignment;
    if (c.status === 'onEVA') c.status = 'active';
  }
}
