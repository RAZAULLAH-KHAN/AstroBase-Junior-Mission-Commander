// Oxygen production and use (Doc 04 §6.1; pipeline step 8).
import { k } from '../constants';
import { addLink, findLink, type TickContext } from '../context';
import { copy, fill, fmt } from '../copy';
import { damagedModuleRoot } from '../events/effects';
import { clamp } from '../helpers';

export function lifeSupportStep(ctx: TickContext, o2UseKg: number, o2TargetKg: number): void {
  const { s } = ctx;
  const served = ctx.metrics.served.lifeSupport;
  const producedKg = o2TargetKg * served;
  const availableKg = s.resources.o2Kg + producedKg;

  ctx.shortages.o2 = availableKg < o2UseKg - 1e-9;
  s.resources.o2Kg = clamp(availableKg - o2UseKg, 0, k('O2_TANK_MAX'));
  ctx.metrics.o2ProducedKg = producedKg;
  ctx.metrics.o2UsedKg = o2UseKg;
  ctx.potential.lifeSupport = o2TargetKg;

  const lostKg = o2TargetKg * (1 - served);
  if (lostKg > 0.05 && findLink(ctx, 'shed:lifeSupport')) {
    addLink(ctx, {
      id: 'o2Lost',
      parentId: 'shed:lifeSupport',
      cause: 'system:lifeSupport',
      effect: 'o2Produced',
      magnitude: -lostKg,
      unit: 'kg',
      label: fill(copy.chain.o2Lost, { kg: fmt(lostKg) }),
    });
  }

  const condition = s.modules.o2Generator.condition;
  if (condition < 1) {
    const missingKg = k('O2_GEN_CAPACITY') * (1 - condition);
    addLink(ctx, {
      id: 'o2Output',
      parentId: damagedModuleRoot(ctx, 'o2Generator'),
      cause: 'system:module.o2Generator',
      effect: 'o2Capacity',
      magnitude: -missingKg,
      unit: 'kg',
      label: fill(copy.chain.o2Output, { kg: fmt(missingKg) }),
    });
  }
}
