// Build orders, repairs and build-point income.
import { k, MODULE_DEFS } from './constants';
import { addLink, type TickContext } from './context';
import { copy, fill } from './copy';
import { moduleName, roleAvailable, roleWorkingOn } from './helpers';
import type { DayDecisions, GameState, ModuleId } from './types';

export function canBuild(s: GameState, module: ModuleId): { ok: boolean; reason?: string } {
  const def = MODULE_DEFS[module];
  if (!def || !def.buildable) return { ok: false, reason: 'This module cannot be built.' };
  if (!def.locations.includes(s.config.location))
    return {
      ok: false,
      reason: `Not available on the ${s.config.location === 'mars' ? 'Mars' : 'Moon'} base.`,
    };
  if (s.modules[module].level >= def.maxLevel) return { ok: false, reason: 'Already at the highest level.' };
  if (s.buildQueue.some((o) => o.module === module))
    return { ok: false, reason: 'Already under construction.' };
  return { ok: true };
}

export function canRepair(s: GameState, module: ModuleId): { ok: boolean; reason?: string } {
  const def = MODULE_DEFS[module];
  const state = s.modules[module];
  if (!def?.repairable) return { ok: false, reason: 'This module cannot be repaired.' };
  if (state.condition >= 1) return { ok: false, reason: 'Nothing to repair.' };
  if (state.repairCompleteDay !== undefined) return { ok: false, reason: 'Repair already in progress.' };
  return { ok: true };
}

/** Days a repair started today will take, before the success roll. */
export function repairDays(s: GameState): number {
  return roleWorkingOn(s, 'engineer', 'maintenance') ? k('REPAIR_DAYS_ENGINEER') : k('REPAIR_DAYS');
}

export function placeOrders(ctx: TickContext, decisions: DayDecisions): void {
  const { s, day } = ctx;
  for (const build of decisions.builds ?? []) {
    const def = MODULE_DEFS[build.module];
    if (!canBuild(s, build.module).ok) continue;
    if (build.targetLevel !== s.modules[build.module].level + 1) continue;
    if (s.resources.buildPoints < def.costBP) continue;
    s.resources.buildPoints -= def.costBP;
    s.buildQueue.push({
      module: build.module,
      targetLevel: build.targetLevel,
      completeOnDay: day + def.buildDays,
    });
  }

  for (const module of decisions.repair ?? []) {
    if (!canRepair(s, module).ok || s.resources.buildPoints < k('REPAIR_COST_BP')) continue;
    s.resources.buildPoints -= k('REPAIR_COST_BP');
    const successChance =
      k('REPAIR_SUCCESS_BASE') + (roleAvailable(s, 'commander') ? k('COMMANDER_REPAIR_BONUS') : 0);
    const delay = ctx.rng.next() < successChance ? 0 : 1;
    s.modules[module].repairCompleteDay = day + repairDays(s) + delay;
  }
}

/** Step 4: upgrades and repairs take effect at the start of their completion day. */
export function completeConstruction(ctx: TickContext): void {
  const { s, day } = ctx;
  const done = s.buildQueue.filter((o) => o.completeOnDay <= day);
  s.buildQueue = s.buildQueue.filter((o) => o.completeOnDay > day);
  for (const order of done) {
    s.modules[order.module].level = order.targetLevel;
    if (order.module === 'greenhouse') {
      s.greenhouseBeds.push({ areaM2: k('GH_AREA_PER_LEVEL'), plantedDay: day, harvestedFull: false });
    }
    ctx.buildsCompleted.push({ module: order.module, level: order.targetLevel });
    addLink(ctx, {
      id: `build:${order.module}`,
      cause: `decision:build.${order.module}`,
      effect: `moduleLevel:${order.module}`,
      magnitude: order.targetLevel,
      unit: 'level',
      label: fill(copy.chain.build, { module: moduleName(order.module), level: order.targetLevel }),
    });
  }

  for (const id of Object.keys(s.modules) as ModuleId[]) {
    const mod = s.modules[id];
    if (mod.repairCompleteDay === undefined || mod.repairCompleteDay > day) continue;
    mod.condition = 1;
    delete mod.repairCompleteDay;
    ctx.repairsCompleted.push(id);
    addLink(ctx, {
      id: `repair:${id}`,
      cause: `decision:repair.${id}`,
      effect: `moduleCondition:${id}`,
      magnitude: 1,
      unit: 'fraction',
      label: fill(copy.chain.repairDone, { module: moduleName(id) }),
    });
  }
}

/** Step 14. */
export function buildPointIncome(ctx: TickContext): void {
  const { s } = ctx;
  const workers = s.crew.filter((c) => c.status === 'active' && c.assignment === 'regolith').length;
  const income = k('BP_INCOME_BASE') + k('BP_PER_REGOLITH_CREW') * workers;
  s.resources.buildPoints += income;
  ctx.metrics.bpIncome = income;
}
