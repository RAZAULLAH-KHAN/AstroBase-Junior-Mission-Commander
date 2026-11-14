// Environment, solar generation, demand and load shedding.
import { k } from '../constants';
import { addLink, emptyDemand, emptyServed, type TickContext } from '../context';
import { copy, fill, fmt, pct } from '../copy';
import { activeOfKind, damagedModuleRoot, eventLinkId } from '../events/effects';
import { getKnownEvents } from '../events/scheduler';
import {
  batteryCapacityKWh,
  batteryNominalKWh,
  clamp,
  greenhouseAreaM2,
  presentCrew,
  solarAreaM2,
  thermalDemandKWh,
} from '../helpers';
import type { DayDecisions, EnvironmentState, EvaMode, GameState, PowerPreview, SystemId } from '../types';

// ---------- Generation ----------

/** Fraction of sunlight that passes through Martian dust of optical depth τ. 1.0 on a clear day. */
export function dustSky(tau: number): number {
  return clamp(Math.exp(-k('DUST_SKY_COEFF') * (tau - k('MARS_CLEAR_TAU'))), k('DUST_SKY_FLOOR'), 1);
}

/** Electrical energy per m² of panel per day before dust and damage. */
export function solarPerM2(s: GameState, illumination: number): number {
  if (s.config.location === 'mars') {
    return k('MARS_CLEAR_INSOLATION') * k('PANEL_EFFICIENCY') * k('SYSTEM_LOSSES');
  }
  const kW = k('SOLAR_CONSTANT_1AU') / 1000;
  return (
    kW *
    k('HOURS_PER_DAY') *
    k('PANEL_EFFICIENCY') *
    k('SYSTEM_LOSSES') *
    k('MOON_GEOMETRY_FACTOR') *
    illumination
  );
}

export function computeGeneration(s: GameState, env: EnvironmentState): number {
  const area = solarAreaM2(s);
  const condition = s.modules.solar.condition;
  if (s.config.location === 'mars') {
    return area * solarPerM2(s, 1) * dustSky(env.dustOpticalDepth) * env.panelDustFactor * condition;
  }
  return area * solarPerM2(s, env.illuminationFraction) * condition;
}

/** Share of the daily load that must come from the battery. */
export function nightFraction(s: GameState, env: EnvironmentState): number {
  return s.config.location === 'mars' ? k('MARS_NIGHT_FRACTION') : 1 - env.illuminationFraction;
}

// ---------- Demand ----------

export interface DemandInputs {
  presentCrew: number;
  evaCrew: number;
  evaMode: EvaMode | null; // null = no EVA today
  outdoorWorkers: number; // crew cleaning panels outside
  dimmers: GameState['power']['dimmers'];
}

export interface DemandResult {
  demand: Record<SystemId, number>;
  o2UseKg: number;
  o2TargetKg: number;
  crewWaterKg: number;
}

/** Used water the recycler will try to process today: the backlog plus today's use, up to its capacity. */
export function wastewaterToProcess(s: GameState, crewWaterKg: number): number {
  return Math.min(k('RECYCLER_CAPACITY_KG_DAY'), s.resources.wastewaterKg + crewWaterKg);
}

export function computeDemand(s: GameState, input: DemandInputs): DemandResult {
  const o2UseKg =
    k('O2_PER_CREW_DAY_KG') * input.presentCrew +
    k('O2_EVA_EXTRA_KG') * (input.evaCrew + input.outdoorWorkers);
  const generatorKg = k('O2_GEN_CAPACITY') * s.modules.o2Generator.condition;
  const o2TargetKg = Math.max(0, Math.min(generatorKg, o2UseKg + (k('O2_TANK_MAX') - s.resources.o2Kg)));
  const evaEnergy = input.evaMode
    ? k('EVA_SUIT_ENERGY') + (input.evaMode === 'drill' ? k('DRILL_ENERGY') : 0)
    : 0;
  const crewWaterKg = k('WATER_TOTAL_PER_CREW_DAY') * input.presentCrew;

  const demand = emptyDemand();
  demand.lifeSupport = k('LIFE_SUPPORT_BASE') + k('O2_ENERGY_PER_KG') * o2TargetKg + evaEnergy;
  demand.thermal = thermalDemandKWh(s);
  demand.water = k('WATER_PROCESS_ENERGY') * wastewaterToProcess(s, crewWaterKg);
  demand.greenhouse = k('GH_LIGHT_ENERGY_PER_M2') * greenhouseAreaM2(s) * input.dimmers.greenhouse;
  demand.lab = k('LAB_DEMAND') * input.dimmers.lab;
  return { demand, o2UseKg, o2TargetKg, crewWaterKg };
}

// ---------- Allocation ----------

export interface AllocationResult {
  served: Record<SystemId, number>;
  servedKWh: number;
  directKWh: number;
  wastedKWh: number;
  availableKWh: number;
  storedEndKWh: number;
}

export function allocatePower(
  generationKWh: number,
  demand: Record<SystemId, number>,
  priority: SystemId[],
  storedKWh: number,
  capacityKWh: number,
  night: number,
): AllocationResult {
  const effIn = k('BATTERY_EFF_IN');
  const effOut = k('BATTERY_EFF_OUT');
  const total = priority.reduce((sum, sys) => sum + demand[sys], 0);
  const stored = Math.min(storedKWh, capacityKWh);

  const directKWh = Math.min(generationKWh, total * (1 - night));
  const surplus = generationKWh - directKWh;
  const storedPrime = Math.min(capacityKWh, stored + surplus * effIn);
  const wastedKWh = Math.max(0, surplus - (storedPrime - stored) / effIn);
  const batteryMax = storedPrime * effOut;
  const availableKWh = directKWh + Math.min(total - directKWh, batteryMax);

  const served = emptyServed();
  let remaining = availableKWh;
  let servedKWh = 0;
  for (const sys of priority) {
    const give = Math.max(0, Math.min(demand[sys], remaining));
    served[sys] = demand[sys] <= 0 ? 1 : give / demand[sys];
    remaining -= give;
    servedKWh += give;
  }

  const fromBattery = Math.max(0, servedKWh - directKWh);
  const storedEndKWh = clamp(storedPrime - fromBattery / effOut, 0, capacityKWh);
  return { served, servedKWh, directKWh, wastedKWh, availableKWh, storedEndKWh };
}

// ---------- Pipeline steps ----------

/** Step 3: sky dust, panel dust, cleaning and illumination for the simulated day. */
export function updateEnvironment(ctx: TickContext): void {
  const { s, day } = ctx;
  const env = s.environment;
  if (s.config.location === 'mars') {
    const storm = activeOfKind(ctx, 'dustStorm');
    env.dustOpticalDepth = storm
      ? storm.params.tau
      : k('MARS_CLEAR_TAU') + ctx.rng.next() * k('MARS_TAU_DAILY_VARIATION');
    const deposit = k('DUST_ACCUM_PER_SOL') + (storm ? k('DUST_STORM_DEPOSIT_PER_SOL') : 0);
    env.panelDustFactor = clamp(env.panelDustFactor * (1 - deposit), 0, 1);
    env.illuminationFraction = 1 - k('MARS_NIGHT_FRACTION');

    const robotDay = s.modules.cleaningBot.level >= 1 && day % k('CLEANING_BOT_INTERVAL') === 0;
    if (ctx.cleanerId || robotDay) {
      const dustBefore = env.panelDustFactor;
      env.panelDustFactor = 1;
      ctx.cleanedBy = ctx.cleanerId ? 'manual' : 'robot';
      const gainPct = pct(1 / dustBefore - 1);
      if (gainPct >= 1) {
        const id = addLink(ctx, {
          id: 'clean',
          cause: ctx.cleanerId ? 'decision:cleanPanels' : 'system:cleaningBot',
          effect: 'panelDust',
          magnitude: 1 - dustBefore,
          unit: 'fraction',
          label: copy.chain.cleaning,
        });
        addLink(ctx, {
          id: 'clean:gain',
          parentId: id,
          cause: 'system:power',
          effect: 'solarOutput',
          magnitude: gainPct,
          unit: '%',
          label: fill(copy.chain.powerBack, { pct: gainPct }),
        });
      }
    }
  } else {
    const shadow = activeOfKind(ctx, 'shadow');
    env.illuminationFraction = shadow ? shadow.params.illumination : k('MOON_BASE_ILLUMINATION');
    env.dustOpticalDepth = 0;
    env.panelDustFactor = 1;
  }
}

/** Steps 5–7: generation, demand, battery and load shedding, with causal links. */
export function powerStep(ctx: TickContext): { o2UseKg: number; o2TargetKg: number; crewWaterKg: number } {
  const { s } = ctx;
  const env = s.environment;
  const generationKWh = computeGeneration(s, env);

  // Reference output with today's normal sky but no storm, shadow, panel dust or damage.
  const storm = activeOfKind(ctx, 'dustStorm');
  const shadow = activeOfKind(ctx, 'shadow');
  const referenceEnv: EnvironmentState = {
    ...env,
    dustOpticalDepth: storm ? k('MARS_CLEAR_TAU') : env.dustOpticalDepth,
    panelDustFactor: 1,
    illuminationFraction: shadow ? k('MOON_BASE_ILLUMINATION') : env.illuminationFraction,
  };
  const referenceKWh = computeGeneration(
    { ...s, modules: { ...s.modules, solar: { ...s.modules.solar, condition: 1 } } },
    referenceEnv,
  );

  const evaCrew = ctx.eva.happened ? ctx.eva.crewIds.length : 0;
  const { demand, o2UseKg, o2TargetKg, crewWaterKg } = computeDemand(s, {
    presentCrew: presentCrew(s).length,
    evaCrew,
    evaMode: ctx.eva.happened ? ctx.eva.mode : null,
    outdoorWorkers: ctx.cleanerId ? 1 : 0,
    dimmers: s.power.dimmers,
  });

  const capacityKWh = batteryCapacityKWh(s);
  const batteryStartKWh = Math.min(s.resources.batteryKWh, capacityKWh);
  const night = nightFraction(s, env);
  const alloc = allocatePower(generationKWh, demand, s.power.priority, batteryStartKWh, capacityKWh, night);
  s.resources.batteryKWh = alloc.storedEndKWh;

  const m = ctx.metrics;
  m.generationKWh = generationKWh;
  m.clearSkyGenerationKWh = referenceKWh;
  m.demand = demand;
  m.served = alloc.served;
  m.directKWh = alloc.directKWh;
  m.wastedKWh = alloc.wastedKWh;
  m.batteryStartKWh = batteryStartKWh;
  m.batteryEndKWh = alloc.storedEndKWh;
  m.batteryCapacityKWh = capacityKWh;

  explainPower(ctx, generationKWh, referenceKWh, demand, alloc);
  return { o2UseKg, o2TargetKg, crewWaterKg };
}

function explainPower(
  ctx: TickContext,
  generationKWh: number,
  referenceKWh: number,
  demand: Record<SystemId, number>,
  alloc: AllocationResult,
): void {
  const { s } = ctx;
  const drop = referenceKWh > 0 ? 1 - generationKWh / referenceKWh : 0;
  let solarLinkId: string | undefined;

  if (drop >= 0.1) {
    const storm = activeOfKind(ctx, 'dustStorm') ?? activeOfKind(ctx, 'shadow');
    let parentId: string | undefined;
    if (storm) {
      parentId = eventLinkId(storm);
    } else {
      const dustLoss = 1 - s.environment.panelDustFactor;
      const damageLoss = 1 - s.modules.solar.condition;
      if (dustLoss >= damageLoss && dustLoss > 0.02) {
        parentId = addLink(ctx, {
          id: 'panelDust',
          cause: 'system:panelDust',
          effect: 'panelDust',
          magnitude: -dustLoss,
          unit: 'fraction',
          label: fill(copy.chain.panelDust, { pct: pct(s.environment.panelDustFactor) }),
          detail: copy.chainDetail.panelDust,
        });
      } else if (damageLoss > 0.02) {
        parentId = damagedModuleRoot(ctx, 'solar');
      }
    }
    solarLinkId = addLink(ctx, {
      id: 'solar',
      parentId,
      cause: 'system:power.generation',
      effect: 'solarOutput',
      magnitude: -pct(drop),
      unit: '%',
      label: fill(copy.chain.solarDrop, { pct: pct(drop) }),
      detail: copy.chainDetail.solarDrop,
    });
  }

  if (alloc.wastedKWh > k('BATTERY_WASTE_KWH')) {
    const id = addLink(ctx, {
      id: 'batteryFull',
      cause: 'system:battery.full',
      effect: 'storage',
      magnitude: alloc.wastedKWh,
      unit: 'kWh',
      label: copy.chain.batteryFull,
      detail: copy.chainDetail.batteryFull,
    });
    addLink(ctx, {
      id: 'wasted',
      parentId: id,
      cause: 'system:power',
      effect: 'energyWasted',
      magnitude: -alloc.wastedKWh,
      unit: 'kWh',
      label: fill(copy.chain.wasted, { kwh: fmt(alloc.wastedKWh) }),
    });
  }

  if (s.modules.battery.condition < 1) {
    const lostKWh = batteryNominalKWh(s) * (1 - s.modules.battery.condition);
    addLink(ctx, {
      id: 'batteryCapacity',
      parentId: damagedModuleRoot(ctx, 'battery'),
      cause: 'system:module.battery',
      effect: 'batteryCapacity',
      magnitude: -lostKWh,
      unit: 'kWh',
      label: fill(copy.chain.batteryCapacity, { kwh: fmt(lostKWh) }),
    });
  }

  for (const sys of ['greenhouse', 'lab'] as const) {
    const dimmer = s.power.dimmers[sys];
    if (dimmer >= 1) continue;
    const full = sys === 'greenhouse' ? k('GH_LIGHT_ENERGY_PER_M2') * greenhouseAreaM2(s) : k('LAB_DEMAND');
    const saved = full * (1 - dimmer);
    if (saved < 0.5) continue;
    const id = addLink(ctx, {
      id: `dimmer:${sys}`,
      cause: `decision:dimmer.${sys}`,
      effect: `demand:${sys}`,
      magnitude: -saved,
      unit: 'kWh',
      label: fill(copy.chain.dimmer, { system: copy.systems[sys], pct: pct(dimmer) }),
    });
    addLink(ctx, {
      id: `dimmer:${sys}:saved`,
      parentId: id,
      cause: 'system:power',
      effect: 'energySaved',
      magnitude: saved,
      unit: 'kWh',
      label: fill(copy.chain.powerSaved, { kwh: fmt(saved) }),
    });
  }

  const totalDemand = Object.values(demand).reduce((a, b) => a + b, 0);
  const deficit = totalDemand - alloc.servedKWh;
  if (deficit < 0.05) return;

  let parentId = solarLinkId;
  if (!parentId) {
    const batteryEmpty = alloc.storedEndKWh < 0.5;
    parentId = batteryEmpty
      ? addLink(ctx, {
          id: 'smallBattery',
          cause: 'system:battery.capacity',
          effect: 'nightEnergy',
          magnitude: -deficit,
          unit: 'kWh',
          label: copy.chain.smallBattery,
          detail: copy.chainDetail.smallBattery,
        })
      : addLink(ctx, {
          id: 'highDemand',
          cause: 'system:power.demand',
          effect: 'demand',
          magnitude: totalDemand,
          unit: 'kWh',
          label: copy.chain.highDemand,
        });
  }
  const deficitId = addLink(ctx, {
    id: 'deficit',
    parentId,
    cause: 'system:power.deficit',
    effect: 'energy',
    magnitude: -deficit,
    unit: 'kWh',
    label: fill(copy.chain.deficit, { kwh: fmt(deficit) }),
    detail: copy.chainDetail.deficit,
  });
  for (const sys of s.power.priority) {
    const served = alloc.served[sys];
    if (served >= 0.999) continue;
    addLink(ctx, {
      id: `shed:${sys}`,
      parentId: deficitId,
      cause: 'system:power.deficit',
      effect: `shed:${sys}`,
      magnitude: served - 1,
      unit: 'fraction',
      label: fill(copy.chain.shed, { system: copy.systems[sys], pct: pct(served) }),
      detail: copy.chainDetail.shed,
    });
  }
}

// ---------- Preview for the dashboard ----------

/** Expected environment for the day being decided, using only what the player can know. */
export function expectedEnvironment(s: GameState, decisions: DayDecisions = {}): EnvironmentState {
  const known = getKnownEvents(s).filter((e) => e.status === 'active');
  const storm = known.find((e) => e.def.kind === 'dustStorm');
  const shadow = known.find((e) => e.def.kind === 'shadow');
  if (s.config.location === 'mars') {
    const panelDust = decisions.cleanPanels
      ? 1
      : s.environment.panelDustFactor * (1 - k('DUST_ACCUM_PER_SOL'));
    return {
      ...s.environment,
      dustOpticalDepth: storm
        ? storm.event.params.tau
        : k('MARS_CLEAR_TAU') + k('MARS_TAU_DAILY_VARIATION') / 2,
      panelDustFactor: panelDust,
      illuminationFraction: 1 - k('MARS_NIGHT_FRACTION'),
    };
  }
  return {
    ...s.environment,
    illuminationFraction: shadow ? shadow.event.params.illumination : k('MOON_BASE_ILLUMINATION'),
  };
}

/** Projected power balance for today's decisions, shown before the player presses End Sol. */
export function previewPower(s: GameState, decisions: DayDecisions = {}): PowerPreview {
  const env = expectedEnvironment(s, decisions);
  const dimmers = { ...s.power.dimmers, ...decisions.dimmers };
  const priority = decisions.priority ?? s.power.priority;
  const assignments = decisions.assignments ?? {};
  const present = presentCrew(s);
  const evaCrew = present.filter(
    (c) => c.status !== 'sick' && (assignments[c.id] ?? c.assignment) === 'eva',
  ).length;
  const evaPlanned = evaCrew === 2;

  const generationKWh = computeGeneration(s, env);
  const { demand } = computeDemand(s, {
    presentCrew: present.length,
    evaCrew: evaPlanned ? evaCrew : 0,
    evaMode: evaPlanned ? (decisions.evaMode ?? 'survey') : null,
    outdoorWorkers: decisions.cleanPanels ? 1 : 0,
    dimmers,
  });
  const capacityKWh = batteryCapacityKWh(s);
  const alloc = allocatePower(
    generationKWh,
    demand,
    priority,
    s.resources.batteryKWh,
    capacityKWh,
    nightFraction(s, env),
  );
  return {
    generationKWh,
    demand,
    served: alloc.served,
    batteryCapacityKWh: capacityKWh,
    batteryEndKWh: alloc.storedEndKWh,
    wastedKWh: alloc.wastedKWh,
    totalDemandKWh: Object.values(demand).reduce((a, b) => a + b, 0),
  };
}
