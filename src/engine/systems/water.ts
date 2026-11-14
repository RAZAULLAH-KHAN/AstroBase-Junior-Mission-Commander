// Water use and recycling.
// Used water goes to a holding tank; the recycler processes it when it has power, so a power cut
// delays recycling instead of destroying the water. Only tank overflow and recycler losses are lost.
import { k } from '../constants';
import { addLink, findLink, type TickContext } from '../context';
import { copy, fill, fmt } from '../copy';
import { damagedModuleRoot } from '../events/effects';
import { greenhouseAreaM2, recyclerRate } from '../helpers';
import { wastewaterToProcess } from './power';

export function waterStep(ctx: TickContext, crewWaterKg: number): void {
  const { s } = ctx;
  const served = ctx.metrics.served.water;
  const condition = s.modules.recycler.condition;
  const rate = recyclerRate(s);

  const plannedKg = wastewaterToProcess(s, crewWaterKg);
  const processedKg = plannedKg * served;
  const recoveredKg = processedKg * rate * condition;
  const backlogKg = s.resources.wastewaterKg + crewWaterKg - processedKg;
  const overflowKg = Math.max(0, backlogKg - k('WASTEWATER_TANK_MAX'));
  const greenhouseKg = k('GH_NET_WATER_PER_M2') * greenhouseAreaM2(s) * s.power.dimmers.greenhouse;
  const nextKg = s.resources.waterKg - crewWaterKg + recoveredKg - greenhouseKg;

  ctx.shortages.water = nextKg < 0;
  s.resources.waterKg = Math.max(0, nextKg);
  s.resources.wastewaterKg = backlogKg - overflowKg;
  ctx.metrics.waterRecoveredKg = recoveredKg;
  ctx.metrics.waterUsedKg = crewWaterKg + greenhouseKg;
  ctx.potential.water = plannedKg * rate * condition;

  const delayedKg = plannedKg - processedKg;
  if (delayedKg > 0.05 && findLink(ctx, 'shed:water')) {
    const id = addLink(ctx, {
      id: 'waterLost',
      parentId: 'shed:water',
      cause: 'system:water',
      effect: 'wastewater',
      magnitude: delayedKg,
      unit: 'kg',
      label: fill(copy.chain.waterDelayed, { kg: fmt(delayedKg) }),
      detail: copy.chainDetail.waterDelayed,
    });
    if (overflowKg > 0.05) {
      addLink(ctx, {
        id: 'waterOverflow',
        parentId: id,
        cause: 'system:water',
        effect: 'waterLost',
        magnitude: -overflowKg,
        unit: 'kg',
        label: fill(copy.chain.waterLost, { kg: fmt(overflowKg) }),
      });
    }
  }

  if (condition < 1) {
    const missingKg = processedKg * rate * (1 - condition);
    addLink(ctx, {
      id: 'waterOutput',
      parentId: damagedModuleRoot(ctx, 'recycler'),
      cause: 'system:module.recycler',
      effect: 'waterRecovered',
      magnitude: -missingKg,
      unit: 'kg',
      label: fill(copy.chain.waterOutput, { kg: fmt(missingKg) }),
    });
  }
}
