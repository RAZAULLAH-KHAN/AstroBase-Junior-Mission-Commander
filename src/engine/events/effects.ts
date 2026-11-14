// AstroBase: Junior Mission Commander
// Activates and expires events for the simulated day and applies their instant effects (pipeline step 2).
import { eventDef } from '../constants';
import { addLink, findLink, type TickContext } from '../context';
import { copy, fill, fmtInt, pct } from '../copy';
import { moduleName } from '../helpers';
import type { ActiveEvent, EventKind, ModuleId } from '../types';
import { eventLastDay } from './scheduler';

export function eventLinkId(e: ActiveEvent): string {
  return `ev:${e.key}`;
}

export function activeOfKind(ctx: TickContext, kind: EventKind): ActiveEvent | undefined {
  return ctx.todayEvents.find((e) => eventDef(e.defId).kind === kind);
}

/**
 * Root link for a damaged module: the failure event if it struck today,
 * otherwise a "module at N%" node so ongoing damage keeps being explained.
 */
export function damagedModuleRoot(ctx: TickContext, module: ModuleId): string {
  const struckToday = ctx.todayEvents.find(
    (e) => e.startDay === ctx.day && eventDef(e.defId).module === module,
  );
  if (struckToday) return eventLinkId(struckToday);
  const id = `mod:${module}`;
  if (!findLink(ctx, id)) {
    const condition = ctx.s.modules[module].condition;
    addLink(ctx, {
      id,
      cause: `system:module.${module}`,
      effect: `moduleCondition:${module}`,
      magnitude: condition - 1,
      unit: 'fraction',
      label: fill(copy.chain.condition, { module: moduleName(module), pct: pct(condition) }),
    });
  }
  return id;
}

export function activateEvents(ctx: TickContext): void {
  const { s, day } = ctx;
  ctx.todayEvents = s.scheduledEvents
    .filter((e) => e.startDay <= day && day <= eventLastDay(e))
    .map((e) => ({ ...e, endsOnDay: eventLastDay(e) }));
  s.activeEvents = ctx.todayEvents;

  for (const e of ctx.todayEvents) {
    const def = eventDef(e.defId);
    const started = e.startDay === day;
    if (started) ctx.startedEvents.push(e.key);
    const id = eventLinkId(e);
    const cause = `event:${def.id}`;

    switch (def.kind) {
      case 'dustStorm': {
        const template = def.id === 'mars.dust.global' ? copy.chain.globalStorm : copy.chain.dustStorm;
        addLink(ctx, {
          id,
          cause,
          effect: 'dustOpticalDepth',
          magnitude: e.params.tau,
          unit: 'τ',
          label: fill(template, { tau: e.params.tau.toFixed(1) }),
          detail: copy.chainDetail.dustStorm,
        });
        break;
      }
      case 'shadow':
        addLink(ctx, {
          id,
          cause,
          effect: 'illumination',
          magnitude: e.params.illumination,
          unit: 'fraction',
          label: fill(copy.chain.shadow, { pct: pct(e.params.illumination) }),
          detail: copy.chainDetail.shadow,
        });
        break;
      case 'spe':
        addLink(ctx, {
          id,
          cause,
          effect: 'doseRate',
          magnitude: 1,
          unit: '',
          label: copy.chain.spe,
          detail: copy.chainDetail.spe,
        });
        break;
      case 'moduleFailure': {
        if (!started || !def.module) break;
        const mod = s.modules[def.module];
        mod.condition = Math.min(mod.condition, e.params.condition);
        delete mod.repairCompleteDay; // a new fault needs a new repair
        ctx.failuresToday.push(def.module);
        const name = moduleName(def.module);
        addLink(ctx, {
          id,
          cause,
          effect: `moduleCondition:${def.module}`,
          magnitude: mod.condition - 1,
          unit: 'fraction',
          label: fill(copy.chain.failure, { module: name }),
          detail: copy.chainDetail.failure,
        });
        break;
      }
      case 'moduleDamage': {
        if (!started || !def.module) break;
        const mod = s.modules[def.module];
        mod.condition = Math.max(0, mod.condition - e.params.damage);
        delete mod.repairCompleteDay;
        ctx.failuresToday.push(def.module);
        addLink(ctx, {
          id,
          cause,
          effect: `moduleCondition:${def.module}`,
          magnitude: -e.params.damage,
          unit: 'fraction',
          label: fill(copy.chain.failure, { module: moduleName(def.module) }),
          detail: copy.chainDetail.failure,
        });
        break;
      }
      case 'cropDisease':
        addLink(ctx, {
          id,
          cause,
          effect: 'greenhouseYield',
          magnitude: e.params.yieldMultiplier - 1,
          unit: 'fraction',
          label: copy.chain.cropDisease,
          detail: copy.chainDetail.cropDisease,
        });
        break;
      case 'crewIllness': {
        if (started) {
          const candidates = s.crew.filter((c) => c.status !== 'evacuated' && c.status !== 'sick');
          if (candidates.length === 0) break;
          const patient = ctx.rng.pick(candidates);
          e.params.crewIndex = s.crew.indexOf(patient);
          const scheduled = s.scheduledEvents.find((x) => x.key === e.key);
          if (scheduled) scheduled.params.crewIndex = e.params.crewIndex;
          patient.status = 'sick';
          patient.sickUntilDay = e.endsOnDay;
        }
        const patient = s.crew[e.params.crewIndex];
        if (!patient) break;
        addLink(ctx, {
          id,
          cause,
          effect: 'crewSick',
          magnitude: -1,
          unit: 'crew',
          label: fill(copy.chain.illness, { name: patient.name }),
        });
        addLink(ctx, {
          id: `${id}:work`,
          parentId: id,
          cause: 'system:crew',
          effect: 'work',
          magnitude: -1,
          unit: 'crew',
          label: fill(copy.chain.noWork, { role: copy.roles[patient.role] }),
        });
        break;
      }
      case 'resupply': {
        if (!started) break;
        s.resources.foodKcal += e.params.foodKcal;
        s.resources.buildPoints += e.params.buildPoints;
        addLink(ctx, {
          id,
          cause,
          effect: 'resupply',
          magnitude: e.params.foodKcal,
          unit: 'kcal',
          label: copy.chain.resupply,
          detail: copy.chainDetail.resupply,
        });
        addLink(ctx, {
          id: `${id}:supplies`,
          parentId: id,
          cause: 'system:logistics',
          effect: 'resources',
          magnitude: e.params.foodKcal,
          unit: 'kcal',
          label: fill(copy.chain.supplies, { food: fmtInt(e.params.foodKcal), bp: e.params.buildPoints }),
        });
        break;
      }
    }
  }

  const speToday = ctx.todayEvents.some((e) => e.defId === 'spe');
  const speSoon = s.scheduledEvents.some(
    (e) =>
      e.defId === 'spe' && e.warned && e.startDay > day && e.startDay - day <= eventDef('spe').warningDays,
  );
  s.environment.solarActivity = speToday ? 'spe' : speSoon ? 'elevated' : 'quiet';
}
