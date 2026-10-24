// Greenhouse harvest and eating (Doc 04 §6.3; pipeline step 10).
import { k } from '../constants';
import { addLink, findLink, type TickContext } from '../context';
import { copy, fill, fmtInt } from '../copy';
import { activeOfKind, eventLinkId } from '../events/effects';
import { bedMaturity, presentCrew, roleWorkingOn } from '../helpers';

export function foodStep(ctx: TickContext): void {
  const { s, day } = ctx;
  const served = ctx.metrics.served.greenhouse;
  const dimmer = s.power.dimmers.greenhouse;
  const botanistBonus = roleWorkingOn(s, 'botanist', 'greenhouse') ? 1 + k('BOTANIST_YIELD_BONUS') : 1;
  const disease = activeOfKind(ctx, 'cropDisease');
  const diseaseFactor = disease ? disease.params.yieldMultiplier : 1;
  const hasWater = s.resources.waterKg > 0 ? 1 : 0;

  let healthyKcal = 0;
  for (const bed of s.greenhouseBeds) {
    const maturity = bedMaturity(bed.plantedDay, day);
    healthyKcal += bed.areaM2 * k('GH_YIELD_PER_M2') * maturity;
    if (maturity >= 1) bed.harvestedFull = true;
  }
  healthyKcal *= dimmer * botanistBonus * hasWater;
  const potentialKcal = healthyKcal * diseaseFactor;
  const harvestKcal = potentialKcal * served;

  const needKcal = k('KCAL_PER_CREW_DAY') * presentCrew(s).length;
  const eatenKcal = Math.min(needKcal, s.resources.foodKcal + harvestKcal);
  s.resources.foodKcal = s.resources.foodKcal + harvestKcal - eatenKcal;
  ctx.foodRation = needKcal > 0 ? eatenKcal / needKcal : 1;
  s.flags.foodZeroStreak = ctx.foodRation < k('FOOD_SEVERE_RATION') ? s.flags.foodZeroStreak + 1 : 0;

  const m = ctx.metrics;
  m.foodHarvestKcal = harvestKcal;
  m.foodEatenKcal = eatenKcal;
  m.foodNeedKcal = needKcal;
  ctx.potential.greenhouse = potentialKcal;

  const lostKcal = potentialKcal - harvestKcal;
  if (lostKcal >= 1 && findLink(ctx, 'shed:greenhouse')) {
    addLink(ctx, {
      id: 'foodLost',
      parentId: 'shed:greenhouse',
      cause: 'system:food',
      effect: 'foodHarvest',
      magnitude: -lostKcal,
      unit: 'kcal',
      label: fill(copy.chain.foodLost, { kcal: fmtInt(lostKcal) }),
    });
  }
  if (disease) {
    const diseaseLossKcal = (healthyKcal - potentialKcal) * served;
    addLink(ctx, {
      id: 'diseaseLoss',
      parentId: eventLinkId(disease),
      cause: 'system:food',
      effect: 'foodHarvest',
      magnitude: -diseaseLossKcal,
      unit: 'kcal',
      label: fill(copy.chain.yieldHalved, { kcal: fmtInt(diseaseLossKcal) }),
    });
  }
}
