import { createMission, defaultConfig, simulateDay } from '../index';
import type { DayDecisions, DayReport, GameState, MissionConfig, ScheduledEvent } from '../types';

export function mission(partial: Partial<MissionConfig> = {}, events?: ScheduledEvent[]): GameState {
  const state = createMission(defaultConfig({ seed: 'TEST-SEED01', ...partial }));
  if (events) state.scheduledEvents = events;
  return state;
}

export function event(
  defId: string,
  startDay: number,
  durationDays: number,
  params: Record<string, number> = {},
  warned = true,
): ScheduledEvent {
  return { key: `${defId}@${startDay}`, defId, startDay, durationDays, warned, params };
}

export function run(
  state: GameState,
  days: number,
  decide: (s: GameState) => DayDecisions = () => ({}),
): { state: GameState; reports: DayReport[] } {
  const reports: DayReport[] = [];
  let s = state;
  for (let i = 0; i < days && !s.outcome; i++) {
    const { next, report } = simulateDay(s, decide(s));
    reports.push(report);
    s = next;
  }
  return { state: s, reports };
}
