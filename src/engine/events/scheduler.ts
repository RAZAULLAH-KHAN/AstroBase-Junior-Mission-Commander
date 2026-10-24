// Pre-rolls every event of a mission from its seed (Doc 04 §7.1), so teachers can predict missions.
import { difficultyFactor, EVENT_DEFS, eventDef } from '../constants';
import type { Rng } from '../rng';
import type { EventDefinition, GameState, KnownEvent, MissionConfig, ScheduledEvent } from '../types';

const RESUPPLY_DAY = 15;
const POWER_WINDOW: [number, number] = [4, 12];
const SPE_WINDOW: [number, number] = [10, 25];
/** Guarantees only make sense for full-length missions. */
const GUARANTEE_MIN_DURATION = 25;

function lastDay(e: ScheduledEvent): number {
  return e.startDay + e.durationDays - 1;
}

function overlaps(a: ScheduledEvent, startDay: number, durationDays: number): boolean {
  return a.startDay <= startDay + durationDays - 1 && startDay <= lastDay(a);
}

function categoryFree(events: ScheduledEvent[], category: string, startDay: number, durationDays: number) {
  return !events.some((e) => eventDef(e.defId).category === category && overlaps(e, startDay, durationDays));
}

function rollEvent(def: EventDefinition, startDay: number, rng: Rng): ScheduledEvent {
  const durationDays = rng.int(def.durationDays[0], def.durationDays[1]);
  const params: Record<string, number> = {};
  for (const [name, [min, max]] of Object.entries(def.params)) {
    params[name] = Math.round(rng.range(min, max) * 100) / 100;
  }
  const warned = def.warningDays > 0 && rng.next() < def.warningChance;
  return { key: `${def.id}@${startDay}`, defId: def.id, startDay, durationDays, warned, params };
}

/** Place a guaranteed event on the first free day of a window, starting from a random day inside it. */
function guarantee(events: ScheduledEvent[], def: EventDefinition, window: [number, number], rng: Rng) {
  const [from, to] = window;
  const covered = events.some(
    (e) => eventDef(e.defId).category === def.category && e.startDay >= from && e.startDay <= to,
  );
  if (covered) return;
  const span = to - from + 1;
  const offset = rng.int(0, span - 1);
  for (let i = 0; i < span; i++) {
    const day = from + ((offset + i) % span);
    const candidate = rollEvent(def, day, rng);
    if (categoryFree(events, def.category, day, candidate.durationDays)) {
      events.push(candidate);
      return;
    }
  }
}

export function scheduleEvents(config: MissionConfig, rng: Rng): ScheduledEvent[] {
  if (config.demo) return demoScript();

  const events: ScheduledEvent[] = [];
  const frequency = difficultyFactor('EVENT_FREQUENCY_MULTIPLIER', config.difficulty);
  const candidates = EVENT_DEFS.filter(
    (d) =>
      d.locations.includes(config.location) &&
      d.difficulties.includes(config.difficulty) &&
      d.baseProbability > 0,
  );

  for (let day = 2; day <= config.durationDays - 1; day++) {
    for (const def of candidates) {
      const roll = rng.next();
      if (roll >= def.baseProbability * frequency) continue;
      const candidate = rollEvent(def, day, rng);
      if (categoryFree(events, def.category, day, candidate.durationDays)) events.push(candidate);
    }
  }

  if (config.durationDays >= GUARANTEE_MIN_DURATION) {
    const powerDef = eventDef(config.location === 'mars' ? 'mars.dust.regional' : 'moon.shadow');
    guarantee(events, powerDef, POWER_WINDOW, rng);
    guarantee(events, eventDef('spe'), SPE_WINDOW, rng);

    // The lander cannot touch down in a dust storm: it waits until the storm has passed.
    let resupplyDay = RESUPPLY_DAY;
    for (const e of events) {
      if (eventDef(e.defId).kind === 'dustStorm' && overlaps(e, resupplyDay, 1)) resupplyDay = lastDay(e) + 1;
    }
    if (resupplyDay < config.durationDays) {
      events.push({ ...rollEvent(eventDef('resupply'), resupplyDay, rng), warned: true });
    }
  }

  return events.sort((a, b) => a.startDay - b.startDay || a.defId.localeCompare(b.defId));
}

/** Fixed script for the 7-day judge demo (Doc 02 §1.1): dust storm on sol 3, solar flare on sol 6. */
export function demoScript(): ScheduledEvent[] {
  return [
    {
      key: 'mars.dust.regional@3',
      defId: 'mars.dust.regional',
      startDay: 3,
      durationDays: 2,
      warned: true,
      params: { tau: 3.0 },
    },
    { key: 'spe@6', defId: 'spe', startDay: 6, durationDays: 1, warned: true, params: {} },
  ];
}

/**
 * Events the player knows about while deciding the current day:
 * ongoing events, warned events starting today, and forecasts within their warning window.
 * Unwarned events stay hidden until they hit.
 */
export function getKnownEvents(s: GameState): KnownEvent[] {
  const day = s.day;
  const known: KnownEvent[] = [];
  for (const e of s.scheduledEvents) {
    const def = eventDef(e.defId);
    const end = lastDay(e);
    if (end < day) continue;
    if (e.startDay < day) {
      known.push({ event: e, def, status: 'active', startsInDays: 0 });
    } else if (e.warned && e.startDay - day <= def.warningDays) {
      const startsInDays = e.startDay - day;
      known.push({ event: e, def, status: startsInDays === 0 ? 'active' : 'forecast', startsInDays });
    }
  }
  return known;
}

export function eventLastDay(e: ScheduledEvent): number {
  return lastDay(e);
}
