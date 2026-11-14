// Bot strategies for balancing.
import {
  getForecast,
  getKnownEvents,
  MODULE_DEFS,
  validateDecisions,
  type DayDecisions,
  type GameState,
  type ModuleId,
} from '../src/engine/index';

export type Bot = (s: GameState) => DayDecisions;

export const passive: Bot = () => ({});

export const greedyScience: Bot = (s) => {
  const decisions: DayDecisions = { dimmers: { lab: 1 }, evaMode: 'drill' };
  const evaCrew = s.crew
    .filter((c) => c.status === 'active' && c.health >= 50 && c.role !== 'engineer')
    .slice(0, 2);
  if (evaCrew.length === 2) {
    const withEva = {
      ...decisions,
      assignments: Object.fromEntries(evaCrew.map((c) => [c.id, 'eva' as const])),
    };
    if (validateDecisions(s, withEva).ok) return withEva;
  }
  return decisions;
};

/** Upgrades storage and power first, shelters on forecast, dims during storms, repairs what breaks. */
export const sensible: Bot = (s) => {
  const known = getKnownEvents(s);
  const powerEvent = known.some((e) => e.def.kind === 'dustStorm' || e.def.kind === 'shadow');
  const spe = known.some((e) => e.def.kind === 'spe' && e.status === 'active');
  const forecast = getForecast(s);

  // In a storm with full O₂ tanks, oxygen production can wait: keep heat and water recycling running first.
  const o2Buffered = s.resources.o2Kg > 25 && s.config.difficulty !== 'training';
  const decisions: DayDecisions = {
    priority:
      powerEvent && o2Buffered
        ? ['thermal', 'water', 'lifeSupport', 'greenhouse', 'lab']
        : ['lifeSupport', 'thermal', 'water', 'greenhouse', 'lab'],
    dimmers: powerEvent ? { greenhouse: 0.3, lab: 0 } : { greenhouse: 1, lab: 1 },
    shelter: spe && s.modules.stormShelter.level >= 1,
    repair: (Object.keys(s.modules) as ModuleId[]).filter(
      (m) =>
        MODULE_DEFS[m].repairable &&
        s.modules[m].condition < 1 &&
        s.modules[m].repairCompleteDay === undefined,
    ),
  };

  // Commander starts with fewer supplies: grow food early and recycle water before optional upgrades.
  const commanderOpening: ModuleId[] =
    s.config.difficulty === 'commander'
      ? ['battery', 'greenhouse', 'stormShelter', 'greenhouse', 'recycler']
      : [];
  const standardPlan: ModuleId[] =
    s.config.location === 'mars'
      ? [
          'battery',
          'stormShelter',
          'battery',
          'solar',
          'greenhouse',
          'shielding',
          'recycler',
          'cleaningBot',
          'solar',
        ]
      : ['battery', 'stormShelter', 'shielding', 'battery', 'shielding', 'solar', 'greenhouse', 'recycler'];
  const wishlist: ModuleId[] = [...commanderOpening, ...standardPlan];
  if (forecast.foodKcal.daysRemaining < 12) wishlist.unshift('greenhouse');
  if (forecast.waterKg.daysRemaining < 10) wishlist.unshift('recycler');

  let budget = s.resources.buildPoints - (decisions.repair?.length ?? 0) * 5;
  const builds: DayDecisions['builds'] = [];
  for (const module of wishlist) {
    const def = MODULE_DEFS[module];
    if (builds.some((b) => b.module === module) || budget < def.costBP) continue;
    const candidate = { module, targetLevel: s.modules[module].level + 1 };
    if (!validateDecisions(s, { builds: [candidate] }).ok) continue;
    builds.push(candidate);
    budget -= def.costBP;
    break; // one build per day keeps BP for repairs
  }
  decisions.builds = builds;

  if (
    s.config.location === 'mars' &&
    s.environment.panelDustFactor < 0.93 &&
    validateDecisions(s, { cleanPanels: true }).ok
  ) {
    decisions.cleanPanels = true;
  }
  if (!validateDecisions(s, decisions).ok) {
    decisions.shelter = false;
    decisions.cleanPanels = false;
  }
  return decisions;
};
