// Crew statuses, health and evacuation (Doc 04 §6.5; pipeline steps 1 and 12).
import { k, CREW_DEFS } from '../constants';
import { addLink, findLink, type TickContext } from '../context';
import { copy, fill } from '../copy';
import { clamp, presentCrew, roleAvailable } from '../helpers';
import type { GameState } from '../types';

/** Statuses for the simulated day, before EVA and events are resolved. */
export function assignStatuses(ctx: TickContext): void {
  for (const c of ctx.s.crew) {
    if (c.status === 'evacuated') continue;
    if (c.sickUntilDay !== undefined && c.sickUntilDay >= ctx.day) c.status = 'sick';
    else if (ctx.shelter) c.status = 'sheltering';
    else c.status = 'active';
  }
}

export function crewHealthStep(ctx: TickContext): void {
  const { s } = ctx;
  const thermalServed = ctx.metrics.served.thermal;
  const medicActive = roleAvailable(s, 'medic');
  const foodShort = ctx.foodRation < 0.999;

  for (const c of presentCrew(s)) {
    let delta = 0;
    let needsMet = true;
    if (ctx.shortages.o2) {
      delta -= k('HEALTH_O2_PENALTY');
      needsMet = false;
    }
    if (ctx.shortages.water) {
      delta -= k('HEALTH_WATER_PENALTY');
      needsMet = false;
    }
    if (ctx.foodRation < k('FOOD_SEVERE_RATION')) {
      delta -= k('HEALTH_FOOD_SEVERE_PENALTY');
      needsMet = false;
    } else if (foodShort) {
      delta -= k('HEALTH_FOOD_MILD_PENALTY');
      needsMet = false;
    }
    if (thermalServed < 0.999) {
      delta -= k('HEALTH_THERMAL_PENALTY') * (1 - thermalServed);
      needsMet = false;
    }
    if ((ctx.doseToday[c.id] ?? 0) > k('SPE_HEALTH_DOSE_THRESHOLD')) {
      delta -= k('HEALTH_SPE_PENALTY');
      needsMet = false;
    }
    if (needsMet) delta += k('HEALTH_RECOVERY') + (medicActive ? k('MEDIC_RECOVERY_BONUS') : 0);
    if (c.status === 'active' && c.assignment === 'rest') delta += k('REST_RECOVERY_BONUS');

    c.health = clamp(c.health + delta, 0, 100);
    if (c.health <= 0) {
      c.status = 'evacuated';
      s.flags.evacuations += 1;
      ctx.evacuatedToday.push(c.id);
    }
  }

  if (thermalServed < 0.999 && findLink(ctx, 'shed:thermal')) {
    const lost = Math.round(k('HEALTH_THERMAL_PENALTY') * (1 - thermalServed) * 10) / 10;
    addLink(ctx, {
      id: 'heatLost',
      parentId: 'shed:thermal',
      cause: 'system:crew',
      effect: 'health',
      magnitude: -lost,
      unit: 'health',
      label: fill(copy.chain.heatLost, { health: lost }),
    });
  }
}

/** Prepare crew for the next decision day: EVA crew return to their jobs, illnesses end. */
export function prepareCrewForNextDay(s: GameState, nextDay: number): void {
  for (const c of s.crew) {
    if (c.status === 'evacuated') continue;
    if (c.assignment === 'eva') {
      c.assignment =
        c.previousAssignment ?? CREW_DEFS.find((d) => d.id === c.id)?.defaultTask ?? 'maintenance';
    }
    delete c.previousAssignment;
    if (c.sickUntilDay !== undefined && c.sickUntilDay < nextDay) delete c.sickUntilDay;
    c.status = c.sickUntilDay !== undefined ? 'sick' : 'active';
  }
}
