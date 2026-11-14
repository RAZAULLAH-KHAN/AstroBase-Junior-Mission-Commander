// Days-remaining forecast and alert thresholds.
import { k, MODULE_DEFS } from './constants';
import { copy, fill, fmt, pct } from './copy';
import { getKnownEvents } from './events/scheduler';
import {
  averageDoseMSv,
  bedMaturity,
  doseBudgetMSv,
  greenhouseAreaM2,
  presentCrew,
  recyclerRate,
  roleWorkingOn,
} from './helpers';
import { computeDemand, previewPower } from './systems/power';
import type { Alert, AlertLevel, Forecast, GameState, ModuleId, ResourceForecast, Resources } from './types';

type TrackedResource = 'o2Kg' | 'waterKg' | 'foodKcal';

function toForecast(storage: number, netPerDay: number): ResourceForecast {
  return { netPerDay, daysRemaining: netPerDay < -1e-9 ? storage / -netPerDay : Infinity };
}

/** Day-1 estimate when there is no history yet: today's balance with the planned power. */
function projectedNet(s: GameState): Record<TrackedResource, number> {
  const preview = previewPower(s);
  const present = presentCrew(s).length;
  const { o2UseKg, o2TargetKg, crewWaterKg } = computeDemand(s, {
    presentCrew: present,
    evaCrew: 0,
    evaMode: null,
    outdoorWorkers: 0,
    dimmers: s.power.dimmers,
  });
  const o2 = o2TargetKg * preview.served.lifeSupport - o2UseKg;
  const water =
    -crewWaterKg +
    crewWaterKg * recyclerRate(s) * s.modules.recycler.condition * preview.served.water -
    k('GH_NET_WATER_PER_M2') * greenhouseAreaM2(s) * s.power.dimmers.greenhouse;
  const bonus = roleWorkingOn(s, 'botanist', 'greenhouse') ? 1 + k('BOTANIST_YIELD_BONUS') : 1;
  const harvest =
    s.greenhouseBeds.reduce(
      (sum, b) => sum + b.areaM2 * k('GH_YIELD_PER_M2') * bedMaturity(b.plantedDay, s.day),
      0,
    ) *
    s.power.dimmers.greenhouse *
    preview.served.greenhouse *
    bonus;
  const food = harvest - k('KCAL_PER_CREW_DAY') * present;
  return { o2Kg: o2, waterKg: water, foodKcal: food };
}

export function getForecast(s: GameState): Forecast {
  const h = s.history;
  const keys: TrackedResource[] = ['o2Kg', 'waterKg', 'foodKcal'];
  let net: Record<TrackedResource, number>;
  if (h.length >= 3) {
    const n = h.length;
    net = Object.fromEntries(keys.map((key) => [key, (h[n - 1][key] - h[n - 3][key]) / 2])) as Record<
      TrackedResource,
      number
    >;
  } else if (h.length === 2) {
    net = Object.fromEntries(keys.map((key) => [key, h[1][key] - h[0][key]])) as Record<
      TrackedResource,
      number
    >;
  } else {
    net = projectedNet(s);
  }
  return {
    o2Kg: toForecast(s.resources.o2Kg, net.o2Kg),
    waterKg: toForecast(s.resources.waterKg, net.waterKg),
    foodKcal: toForecast(s.resources.foodKcal, net.foodKcal),
  };
}

const LEVEL_ORDER: Record<AlertLevel, number> = { red: 0, amber: 1, info: 2 };

const RESOURCE_ALERTS: { key: TrackedResource; code: string; template: string; target: string }[] = [
  { key: 'o2Kg', code: 'O2_LOW', template: copy.alerts.O2_LOW, target: 'gauge-o2' },
  { key: 'waterKg', code: 'WATER_LOW', template: copy.alerts.WATER_LOW, target: 'gauge-water' },
  { key: 'foodKcal', code: 'FOOD_LOW', template: copy.alerts.FOOD_LOW, target: 'gauge-food' },
];

export function getAlerts(s: GameState): Alert[] {
  const alerts: Alert[] = [];
  const forecast = getForecast(s);

  for (const r of RESOURCE_ALERTS) {
    const days = forecast[r.key].daysRemaining;
    if (days >= k('ALERT_AMBER_DAYS')) continue;
    alerts.push({
      level: days < k('ALERT_RED_DAYS') ? 'red' : 'amber',
      code: r.code,
      resource: r.key as keyof Resources,
      daysRemaining: days,
      message: fill(r.template, { days: fmt(days) }),
      target: r.target,
    });
  }

  const last = s.lastDay;
  if (last) {
    const shed = s.power.priority.filter((sys) => last.served[sys] < 0.999);
    if (shed.length > 0) {
      const critical = shed.includes('lifeSupport') || shed.includes('thermal');
      alerts.push({
        level: critical ? 'red' : 'amber',
        code: 'POWER_SHED',
        message: fill(copy.alerts.POWER_SHED, { systems: shed.map((x) => copy.systems[x]).join(', ') }),
        target: 'power-flow',
      });
    }
    if (
      last.batteryCapacityKWh > 0 &&
      last.batteryEndKWh < k('BATTERY_LOW_FRACTION') * last.batteryCapacityKWh
    ) {
      alerts.push({
        level: 'amber',
        code: 'BATTERY_LOW',
        message: fill(copy.alerts.BATTERY_LOW, { pct: pct(last.batteryEndKWh / last.batteryCapacityKWh) }),
        target: 'gauge-battery',
      });
    }
    if (last.wastedKWh > k('BATTERY_WASTE_KWH')) {
      alerts.push({
        level: 'info',
        code: 'BATTERY_WASTE',
        message: fill(copy.alerts.BATTERY_WASTE, { kwh: fmt(last.wastedKWh) }),
        target: 'gauge-battery',
      });
    }
  }

  const present = presentCrew(s);
  const weakest = [...present].sort((a, b) => a.health - b.health)[0];
  if (weakest && weakest.health < k('HEALTH_AMBER')) {
    alerts.push({
      level: weakest.health < k('HEALTH_RED') ? 'red' : 'amber',
      code: 'HEALTH_LOW',
      message: fill(copy.alerts.HEALTH_LOW, { name: weakest.name, health: Math.round(weakest.health) }),
      target: 'crew',
    });
  }

  const doseShare = averageDoseMSv(s) / doseBudgetMSv(s);
  if (doseShare > k('DOSE_AMBER_FRACTION')) {
    alerts.push({
      level: doseShare > k('DOSE_RED_FRACTION') ? 'red' : 'amber',
      code: 'DOSE_HIGH',
      message: fill(copy.alerts.DOSE_HIGH, { pct: pct(doseShare) }),
      target: 'gauge-dose',
    });
  }

  for (const known of getKnownEvents(s)) {
    if (known.def.kind === 'moduleFailure' || known.def.kind === 'moduleDamage') continue;
    if (known.status === 'forecast' || (known.startsInDays === 0 && known.event.startDay === s.day)) {
      const when =
        known.startsInDays === 0
          ? 'today'
          : known.startsInDays === 1
            ? 'tomorrow'
            : `in ${known.startsInDays} days`;
      alerts.push({
        level: 'info',
        code: `FORECAST_${known.event.defId}`,
        message: fill(copy.alerts.FORECAST, { event: known.def.name, when }),
        target: 'weather',
      });
    } else {
      alerts.push({
        level: 'info',
        code: `ACTIVE_${known.event.defId}`,
        message: fill(copy.alerts.EVENT_ACTIVE, {
          event: known.def.name,
          until: known.event.startDay + known.event.durationDays - 1,
        }),
        target: 'weather',
      });
    }
  }

  for (const id of Object.keys(s.modules) as ModuleId[]) {
    const mod = s.modules[id];
    if (mod.condition >= 1 || mod.repairCompleteDay !== undefined) continue;
    alerts.push({
      level: mod.condition < k('MODULE_DOWN_CONDITION') ? 'amber' : 'info',
      code: `MODULE_DOWN_${id}`,
      message: fill(copy.alerts.MODULE_DOWN, { module: MODULE_DEFS[id].name, pct: pct(mod.condition) }),
      target: 'modules',
    });
  }

  // De-duplicate by code, then sort red → amber → info.
  const unique = new Map<string, Alert>();
  for (const a of alerts) if (!unique.has(a.code)) unique.set(a.code, a);
  return [...unique.values()].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

/** Worst alert level for a resource gauge. */
export function resourceAlertLevel(alerts: Alert[], target: string): AlertLevel | null {
  const hit = alerts
    .filter((a) => a.target === target)
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])[0];
  return hit && hit.level !== 'info' ? hit.level : null;
}
