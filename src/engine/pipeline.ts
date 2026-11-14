// The ordered tick pipeline. Pure: (state, decisions) → (next state, report).
import { getAlerts, getForecast } from './alerts';
import { completeConstruction, buildPointIncome } from './construction';
import { emptyDemand, emptyServed, type TickContext } from './context';
import { applyDecisions, cancelEva } from './decisions';
import { activateEvents } from './events/effects';
import { buildChains, headline, selectQuote, selectTips } from './explain';
import { k } from './constants';
import { copy } from './copy';
import { snapshot } from './mission';
import { evaluateOutcome } from './outcome';
import { Rng } from './rng';
import { crewHealthStep, prepareCrewForNextDay } from './systems/crew';
import { foodStep } from './systems/food';
import { lifeSupportStep } from './systems/lifeSupport';
import { powerStep, updateEnvironment } from './systems/power';
import { radiationStep } from './systems/radiation';
import { scienceStep } from './systems/science';
import { waterStep } from './systems/water';
import { averageDoseMSv, averageHealth } from './helpers';
import type { DayDecisions, DayMetrics, DayReport, GameState, ReportDelta } from './types';

function emptyMetrics(day: number): DayMetrics {
  return {
    day,
    generationKWh: 0,
    clearSkyGenerationKWh: 0,
    demand: emptyDemand(),
    served: emptyServed(),
    directKWh: 0,
    wastedKWh: 0,
    batteryStartKWh: 0,
    batteryEndKWh: 0,
    batteryCapacityKWh: 0,
    o2ProducedKg: 0,
    o2UsedKg: 0,
    waterRecoveredKg: 0,
    waterUsedKg: 0,
    foodHarvestKcal: 0,
    foodEatenKcal: 0,
    foodNeedKcal: 0,
    doseTodayAvgMSv: 0,
    sciencePoints: 0,
    evaHappened: false,
    sheltered: false,
    bpIncome: 0,
  };
}

function createContext(state: GameState, decisions: DayDecisions): TickContext {
  const s = structuredClone(state);
  return {
    s,
    before: state,
    decisions,
    rng: new Rng(s.rngState),
    day: s.day,
    log: [],
    metrics: emptyMetrics(s.day),
    todayEvents: [],
    startedEvents: [],
    objectivesCompleted: [],
    eva: { happened: false, mode: decisions.evaMode ?? 'survey', crewIds: [] },
    shelter: false,
    cleanerId: null,
    cleanedBy: null,
    shortages: { o2: false, water: false },
    foodRation: 1,
    doseToday: {},
    evacuatedToday: [],
    buildsCompleted: [],
    repairsCompleted: [],
    failuresToday: [],
    potential: {},
    resourcesBefore: { ...s.resources },
  };
}

function reportDeltas(before: GameState, after: GameState): ReportDelta[] {
  const genBefore = before.lastDay?.generationKWh ?? after.lastDay?.generationKWh ?? 0;
  return [
    {
      key: 'o2Kg',
      label: copy.resources.o2Kg,
      before: before.resources.o2Kg,
      after: after.resources.o2Kg,
      unit: 'kg',
    },
    {
      key: 'waterKg',
      label: copy.resources.waterKg,
      before: before.resources.waterKg,
      after: after.resources.waterKg,
      unit: 'kg',
    },
    {
      key: 'foodKcal',
      label: copy.resources.foodKcal,
      before: before.resources.foodKcal,
      after: after.resources.foodKcal,
      unit: 'kcal',
    },
    {
      key: 'batteryKWh',
      label: copy.resources.batteryKWh,
      before: before.resources.batteryKWh,
      after: after.resources.batteryKWh,
      unit: 'kWh',
    },
    {
      key: 'generationKWh',
      label: 'Solar power generated',
      before: genBefore,
      after: after.lastDay?.generationKWh ?? 0,
      unit: 'kWh',
    },
    {
      key: 'buildPoints',
      label: copy.resources.buildPoints,
      before: before.resources.buildPoints,
      after: after.resources.buildPoints,
      unit: 'BP',
    },
    {
      key: 'avgHealth',
      label: 'Average crew health',
      before: averageHealth(before),
      after: averageHealth(after),
      unit: '',
    },
    {
      key: 'avgDose',
      label: 'Average radiation dose',
      before: averageDoseMSv(before),
      after: averageDoseMSv(after),
      unit: 'mSv',
    },
    {
      key: 'sciencePoints',
      label: 'Science points',
      before: before.science.points,
      after: after.science.points,
      unit: 'SP',
    },
  ];
}

export function simulateDay(
  state: GameState,
  decisions: DayDecisions,
): { next: GameState; report: DayReport } {
  if (state.outcome) throw new Error('simulateDay called on a finished mission');
  const ctx = createContext(state, decisions);
  const { s, day } = ctx;

  // 1. Decisions → settings, assignments, build and repair orders
  applyDecisions(ctx);
  // 2. Events (an illness can take an EVA crew member off the spacewalk)
  activateEvents(ctx);
  if (ctx.eva.happened && s.crew.filter((c) => c.status === 'onEVA').length !== ctx.eva.crewIds.length)
    cancelEva(ctx);
  // 3. Environment, 4. construction and repairs
  updateEnvironment(ctx);
  completeConstruction(ctx);
  // 5–7. Power generation, demand and allocation
  const { o2UseKg, o2TargetKg, crewWaterKg } = powerStep(ctx);
  // 8–13. Resource systems, crew and science
  lifeSupportStep(ctx, o2UseKg, o2TargetKg);
  waterStep(ctx, crewWaterKg);
  foodStep(ctx);
  radiationStep(ctx);
  crewHealthStep(ctx);
  scienceStep(ctx);
  // 14. Build-point income
  buildPointIncome(ctx);

  // Bookkeeping for scoring, tips and history
  const m = ctx.metrics;
  m.evaHappened = ctx.eva.happened;
  m.sheltered = ctx.shelter;
  if (m.served.lifeSupport < 0.999) s.flags.lifeSupportShedDays += 1;
  s.flags.batteryWasteStreak = m.wastedKWh > k('BATTERY_WASTE_KWH') ? s.flags.batteryWasteStreak + 1 : 0;
  s.lastDay = m;
  s.history.push(
    snapshot(
      s,
      day,
      ctx.todayEvents.map((e) => e.defId),
      m.generationKWh,
    ),
  );
  s.rngState = ctx.rng.state;

  // 17. Outcome; then advance to the next decision day
  const outcome = evaluateOutcome(s, day, ctx.shortages);
  s.outcome = outcome;
  if (!outcome) s.day = day + 1;
  prepareCrewForNextDay(s, s.day);

  // 15–16. Alerts, forecast and explanations
  const forecast = getForecast(s);
  const report: DayReport = {
    day,
    headline: headline(ctx, outcome),
    deltas: reportDeltas(state, s),
    causal: ctx.log,
    chains: buildChains(ctx.log),
    shed: s.power.priority
      .filter((sys) => m.served[sys] < 0.999)
      .map((sys) => ({ system: sys, fractionServed: m.served[sys] })),
    alerts: outcome ? [] : getAlerts(s),
    tips: selectTips(ctx, forecast),
    crewQuote: selectQuote(ctx),
    eventsStarted: ctx.startedEvents,
    objectivesCompleted: ctx.objectivesCompleted,
    outcome,
  };
  return { next: s, report };
}
