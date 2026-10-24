// Lab work, EVAs and science objectives (Doc 02 F-12, Doc 04 §6.6; pipeline step 13).
import objectivesJson from '../../content/objectives.json';
import { eventDef, k } from '../constants';
import { addLink, findLink, type TickContext } from '../context';
import { copy, fill, fmt } from '../copy';
import type { ObjectiveId } from '../types';

export interface ObjectiveDefinition {
  id: ObjectiveId;
  rewardSP: number;
  target: number;
}

export const OBJECTIVES = objectivesJson as ObjectiveDefinition[];

export function objective(id: ObjectiveId): ObjectiveDefinition {
  const def = OBJECTIVES.find((o) => o.id === id);
  if (!def) throw new Error(`Unknown objective ${id}`);
  return def;
}

export function scienceStep(ctx: TickContext): void {
  const { s, day } = ctx;
  const bonus = 1 + k('SCIENTIST_SP_BONUS');
  let sp = 0;

  // Lab
  const researchers = s.crew.filter((c) => c.status === 'active' && c.assignment === 'research');
  const dimmer = s.power.dimmers.lab;
  const served = ctx.metrics.served.lab;
  if (researchers.length > 0) {
    const roleBonus = researchers.some((c) => c.role === 'scientist') ? bonus : 1;
    const potential = k('LAB_SP_PER_DAY') * dimmer * roleBonus;
    sp += potential * served;
    ctx.potential.lab = potential;
    if (served * dimmer >= 0.99) s.science.labDays += 1;
    const lost = potential * (1 - served);
    if (lost > 0.05 && findLink(ctx, 'shed:lab')) {
      addLink(ctx, {
        id: 'scienceLost',
        parentId: 'shed:lab',
        cause: 'system:science',
        effect: 'sciencePoints',
        magnitude: -lost,
        unit: 'SP',
        label: fill(copy.chain.scienceLost, { sp: fmt(lost) }),
      });
    }
  }

  // EVA
  if (ctx.eva.happened) {
    const evaCrew = s.crew.filter((c) => ctx.eva.crewIds.includes(c.id));
    sp += k('EVA_SP') * (evaCrew.some((c) => c.role === 'scientist') ? bonus : 1);
    s.science.evaCount += 1;
    if (ctx.eva.mode === 'drill') s.science.drillEvaCount += 1;
  }

  // Storms survived without cutting life support
  for (const e of ctx.todayEvents) {
    const kind = eventDef(e.defId).kind;
    if (kind !== 'dustStorm' && kind !== 'shadow') continue;
    if (ctx.metrics.served.lifeSupport < 0.999 && !s.flags.stormLifeSupportShed.includes(e.key)) {
      s.flags.stormLifeSupportShed.push(e.key);
    }
  }

  s.science.points += sp;
  ctx.metrics.sciencePoints = sp;

  const reached: Record<ObjectiveId, boolean> = {
    samples: s.science.evaCount >= objective('samples').target,
    harvest: s.greenhouseBeds.some((b) => b.harvestedFull),
    storm: ctx.todayEvents.some((e) => {
      const kind = eventDef(e.defId).kind;
      return (
        (kind === 'dustStorm' || kind === 'shadow') &&
        e.endsOnDay === day &&
        !s.flags.stormLifeSupportShed.includes(e.key)
      );
    }),
    lab: s.science.labDays >= objective('lab').target,
    drill: s.science.drillEvaCount >= objective('drill').target,
  };

  for (const def of OBJECTIVES) {
    if (s.science.objectivesDone.includes(def.id) || !reached[def.id]) continue;
    s.science.objectivesDone.push(def.id);
    s.science.points += def.rewardSP;
    ctx.objectivesCompleted.push(def.id);
    if (def.id === 'drill' && s.config.location === 'moon') s.resources.waterKg += k('ICE_WATER_KG');
  }
}
