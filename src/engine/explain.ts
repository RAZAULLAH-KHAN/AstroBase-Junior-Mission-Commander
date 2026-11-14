// Turns the causal log into ranked "Why?" chains, a headline, tips and a crew quote.
import { eventDef, k } from './constants';
import { findLink, type TickContext } from './context';
import { copy, fill, fmt, fmtInt, pct, tip } from './copy';
import { activeOfKind } from './events/effects';
import { averageDoseMSv, doseBudgetMSv, moduleName } from './helpers';
import { objective } from './systems/science';
import type {
  CausalLink,
  CrewRole,
  DayReport,
  Forecast,
  GameState,
  ModuleId,
  ObjectiveId,
  Outcome,
  SystemId,
} from './types';

const MAX_CHAINS = 3;
const MAX_TIPS = 2;

/** How much a link matters to the crew's survival. Higher = shown first. */
function linkWeight(link: CausalLink): number {
  const byId: Record<string, number> = {
    'shed:lifeSupport': 100,
    o2Lost: 100,
    'shed:thermal': 90,
    heatLost: 90,
    'spe:health': 85,
    o2Output: 75,
    'shed:water': 70,
    waterLost: 70,
    waterOutput: 65,
    batteryCapacity: 55,
    'shed:greenhouse': 50,
    foodLost: 50,
    diseaseLoss: 45,
    'shed:lab': 30,
    scienceLost: 30,
    'clean:gain': 25,
    wasted: 22,
    solar: 20,
  };
  if (link.id in byId) return byId[link.id];
  if (link.id === 'spe:dose') return 60 + Math.min(30, link.magnitude);
  if (link.cause === 'event:crew.illness') return 40;
  if (link.cause === 'event:resupply') return 35;
  if (link.id.startsWith('build:') || link.id.startsWith('repair:')) return 20;
  if (link.id.startsWith('dimmer:')) return 15;
  return 10;
}

export function buildChains(log: CausalLink[]): CausalLink[][] {
  const ids = new Set(log.map((l) => l.id));
  const children = new Map<string, CausalLink[]>();
  for (const link of log) {
    if (!link.parentId || !ids.has(link.parentId)) continue;
    const list = children.get(link.parentId) ?? [];
    list.push(link);
    children.set(link.parentId, list);
  }
  const roots = log.filter((l) => !l.parentId || !ids.has(l.parentId));

  const chains: CausalLink[][] = [];
  const walk = (link: CausalLink, path: CausalLink[]) => {
    const next = [...path, link];
    const kids = children.get(link.id);
    if (!kids || kids.length === 0) chains.push(next);
    else for (const kid of kids) walk(kid, next);
  };
  for (const root of roots) walk(root, []);

  const scored = chains.map((chain) => ({
    chain,
    weight: Math.max(...chain.map(linkWeight)) + chain.length * 0.5,
  }));
  scored.sort((a, b) => b.weight - a.weight);

  const seenLeaves = new Set<string>();
  const result: CausalLink[][] = [];
  for (const { chain } of scored) {
    const leaf = chain[chain.length - 1].id;
    if (seenLeaves.has(leaf)) continue;
    seenLeaves.add(leaf);
    result.push(chain);
    if (result.length === MAX_CHAINS) break;
  }
  return result;
}

function shedSystems(ctx: TickContext): SystemId[] {
  return ctx.s.power.priority.filter((sys) => ctx.metrics.served[sys] < 0.999);
}

function listSystems(systems: SystemId[]): string {
  const names = systems.map((s) => copy.systems[s].toLowerCase());
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function objectiveName(s: GameState, id: ObjectiveId): string {
  const key = id === 'drill' ? (`drill.${s.config.location}` as const) : id;
  return copy.objectives[key].name;
}

export function headline(ctx: TickContext, outcome: Outcome | null): string {
  const { s, metrics } = ctx;
  if (outcome?.result === 'success') {
    return fill(copy.headlines.missionComplete, {
      label: s.config.location === 'mars' ? 'Sol' : 'Day',
      day: ctx.day,
    });
  }
  if (outcome?.result === 'failure' && outcome.reason) {
    return fill(copy.headlines.missionFailed, { reason: copy.outcome[outcome.reason].toLowerCase() });
  }
  if (ctx.evacuatedToday.length > 0) {
    const name = s.crew.find((c) => c.id === ctx.evacuatedToday[0])?.name ?? '';
    return fill(copy.headlines.evacuation, { name });
  }

  const shed = shedSystems(ctx);
  const powerEvent = activeOfKind(ctx, 'dustStorm') ?? activeOfKind(ctx, 'shadow');
  const solar = findLink(ctx, 'solar');
  if (shed.length > 0) {
    const systems = listSystems(shed);
    if (powerEvent && solar) {
      return fill(copy.headlines.shedEvent, {
        event: eventDef(powerEvent.defId).name,
        pct: -solar.magnitude,
        systems,
      });
    }
    if (findLink(ctx, 'smallBattery')) return fill(copy.headlines.shedNight, { systems });
    const deficit = findLink(ctx, 'deficit');
    return fill(copy.headlines.shedGeneric, { kwh: fmt(-(deficit?.magnitude ?? 0)), systems });
  }

  if (activeOfKind(ctx, 'spe')) {
    const template = ctx.shelter ? copy.headlines.speSheltered : copy.headlines.spe;
    return fill(template, { dose: fmt(metrics.doseTodayAvgMSv) });
  }
  if (ctx.failuresToday.length > 0)
    return fill(copy.headlines.failure, { module: moduleName(ctx.failuresToday[0]) });

  const resupply = ctx.todayEvents.find((e) => e.defId === 'resupply' && e.startDay === ctx.day);
  if (resupply) {
    return fill(copy.headlines.resupply, {
      food: fmtInt(resupply.params.foodKcal),
      bp: resupply.params.buildPoints,
    });
  }
  const started = ctx.todayEvents.find((e) => e.startDay === ctx.day);
  if (started) {
    const def = eventDef(started.defId);
    return fill(copy.headlines.event, { event: def.name, text: def.text.start });
  }
  if (powerEvent) return fill(copy.headlines.eventHandled, { event: eventDef(powerEvent.defId).name });
  if (ctx.objectivesCompleted.length > 0) {
    const id = ctx.objectivesCompleted[0];
    return fill(copy.headlines.objective, { name: objectiveName(s, id), sp: objective(id).rewardSP });
  }
  if (metrics.wastedKWh > k('BATTERY_WASTE_KWH'))
    return fill(copy.headlines.allServedWaste, { kwh: fmt(metrics.wastedKWh) });
  return copy.headlines.normal;
}

export function selectTips(ctx: TickContext, forecast: Forecast): string[] {
  const { s, metrics } = ctx;
  const shed = shedSystems(ctx);
  const dust = activeOfKind(ctx, 'dustStorm');
  const shadow = activeOfKind(ctx, 'shadow');
  const spe = activeOfKind(ctx, 'spe');
  const researchers = s.crew.some((c) => c.status === 'active' && c.assignment === 'research');

  const rules: [boolean, () => string][] = [
    [shed.includes('lifeSupport'), () => tip('lifeSupportShed')],
    [Boolean(dust) && shed.includes('greenhouse'), () => tip('dustShedGreenhouse')],
    [Boolean(shadow) && shed.length > 0, () => tip('shadowPrepare')],
    [Boolean(spe) && !ctx.shelter && s.modules.stormShelter.level >= 1, () => tip('speNoShelter')],
    [Boolean(spe) && s.modules.stormShelter.level < 1, () => tip('speNoShelterModule')],
    [
      shed.length > 0 && !dust && !shadow && Boolean(findLink(ctx, 'smallBattery')),
      () => tip('nightBattery'),
    ],
    [s.flags.batteryWasteStreak >= 2, () => tip('batteryWaste')],
    [
      s.modules.recycler.level === 1 && forecast.waterKg.daysRemaining < k('ALERT_AMBER_DAYS'),
      () => tip('recyclerUpgrade'),
    ],
    [forecast.foodKcal.daysRemaining < k('ALERT_AMBER_DAYS'), () => tip('foodLow')],
    [
      s.config.location === 'mars' && s.environment.panelDustFactor < 0.9,
      () => tip('dustyPanels', { pct: pct(1 / s.environment.panelDustFactor - 1) }),
    ],
    [
      averageDoseMSv(s) > k('DOSE_AMBER_FRACTION') * doseBudgetMSv(s) && s.modules.shielding.level < 3,
      () => tip('doseHigh'),
    ],
    [
      (Object.keys(s.modules) as ModuleId[]).some(
        (m) => s.modules[m].condition < 1 && s.modules[m].repairCompleteDay === undefined,
      ),
      () => tip('moduleDown'),
    ],
    [!researchers && s.power.dimmers.lab > 0 && metrics.served.lab > 0, () => tip('labNoResearcher')],
  ];
  return rules
    .filter(([when]) => when)
    .slice(0, MAX_TIPS)
    .map(([, text]) => text());
}

export function selectQuote(ctx: TickContext): DayReport['crewQuote'] {
  const { s } = ctx;
  const shed = shedSystems(ctx);
  const q = copy.quotes;
  const candidates: [boolean, CrewRole, string][] = [
    [Boolean(activeOfKind(ctx, 'spe')), 'commander', q.commander.spe],
    [ctx.objectivesCompleted.includes('harvest'), 'botanist', q.botanist.harvest],
    [shed.includes('greenhouse'), 'botanist', q.botanist.shed],
    [shed.length > 0, 'engineer', q.engineer.deficit],
    [ctx.failuresToday.length > 0, 'engineer', q.engineer.failure],
    [Boolean(activeOfKind(ctx, 'cropDisease')), 'botanist', q.botanist.disease],
    [s.crew.some((c) => c.status === 'sick'), 'medic', q.medic.sick],
    [ctx.eva.happened, 'scientist', q.scientist.eva],
    [averageDoseMSv(s) > k('DOSE_AMBER_FRACTION') * doseBudgetMSv(s), 'medic', q.medic.dose],
    [s.crew.some((c) => c.status !== 'evacuated' && c.health < k('HEALTH_AMBER')), 'medic', q.medic.health],
    [s.config.location === 'mars' && s.environment.panelDustFactor < 0.92, 'engineer', q.engineer.dust],
    [Boolean(activeOfKind(ctx, 'dustStorm') ?? activeOfKind(ctx, 'shadow')), 'commander', q.commander.storm],
    [ctx.metrics.sciencePoints > 0 && ctx.day % 3 === 0, 'scientist', q.scientist.lab],
  ];
  const normal: [CrewRole, string][] = [
    ['commander', q.commander.normal],
    ['botanist', q.botanist.normal],
    ['engineer', q.engineer.normal],
    ['medic', q.medic.normal],
    ['scientist', q.scientist.normal],
  ];

  const speaker = (role: CrewRole) => s.crew.find((c) => c.role === role && c.status !== 'evacuated');
  for (const [when, role, text] of candidates) {
    const member = when ? speaker(role) : undefined;
    if (member) return { crewId: member.id, name: member.name, role, text };
  }
  for (let i = 0; i < normal.length; i++) {
    const [role, text] = normal[(ctx.day + i) % normal.length];
    const member = speaker(role);
    if (member) return { crewId: member.id, name: member.name, role, text };
  }
  return undefined;
}
