// Radiation dose from background cosmic rays and solar particle events.
import { k, kAt } from '../constants';
import { addLink, type TickContext } from '../context';
import { copy, fill, fmt } from '../copy';
import { activeOfKind, eventLinkId } from '../events/effects';
import { baseDoseMSv, presentCrew, speDoseMSv } from '../helpers';

export function radiationStep(ctx: TickContext): void {
  const { s } = ctx;
  const base = baseDoseMSv(s);
  const shield = s.modules.shielding.level;
  const spe = activeOfKind(ctx, 'spe');
  const crew = presentCrew(s);

  let total = 0;
  for (const c of crew) {
    const outside = c.status === 'onEVA' || c.id === ctx.cleanerId;
    const background = outside ? base : base * (1 - kAt('SHIELD_GCR_REDUCTION', shield));
    let speDose = 0;
    if (spe) {
      const reduction = outside
        ? 0
        : c.status === 'sheltering'
          ? k('SHELTER_SPE_REDUCTION')
          : kAt('SHIELD_SPE_REDUCTION', shield);
      speDose = speDoseMSv(s) * (1 - reduction);
    }
    const dose = background + speDose;
    c.doseMSv += dose;
    ctx.doseToday[c.id] = dose;
    total += dose;
  }
  const average = crew.length > 0 ? total / crew.length : 0;
  ctx.metrics.doseTodayAvgMSv = average;

  if (!spe) return;
  const sheltered = crew.some((c) => c.status === 'sheltering');
  const shelterId = addLink(ctx, {
    id: 'spe:shelter',
    parentId: eventLinkId(spe),
    cause: sheltered ? 'decision:shelter' : 'decision:noShelter',
    effect: 'speReduction',
    magnitude: sheltered ? k('SHELTER_SPE_REDUCTION') : kAt('SHIELD_SPE_REDUCTION', shield),
    unit: 'fraction',
    label: sheltered ? copy.chain.shelter : copy.chain.noShelter,
    detail: sheltered ? copy.chainDetail.shelter : undefined,
  });
  const doseId = addLink(ctx, {
    id: 'spe:dose',
    parentId: shelterId,
    cause: 'system:radiation',
    effect: 'dose',
    magnitude: average,
    unit: 'mSv',
    label: fill(copy.chain.dose, { dose: fmt(average) }),
    detail: copy.chainDetail.dose,
  });
  if (crew.some((c) => ctx.doseToday[c.id] > k('SPE_HEALTH_DOSE_THRESHOLD'))) {
    addLink(ctx, {
      id: 'spe:health',
      parentId: doseId,
      cause: 'system:crew',
      effect: 'health',
      magnitude: -k('HEALTH_SPE_PENALTY'),
      unit: 'health',
      label: fill(copy.chain.healthHit, { health: k('HEALTH_SPE_PENALTY') }),
    });
  }
}
