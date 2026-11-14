// Win/lose conditions, score, stars and the debrief "turning point".
import { k } from './constants';
import { averageDoseMSv, averageHealth, doseBudgetMSv } from './helpers';
import type { DaySnapshot, FailureReason, GameState, Outcome } from './types';

export interface DayShortages {
  o2: boolean;
  water: boolean;
}

/** Failure reason for the day just simulated, in order of severity, or null if the crew is fine. */
export function failureReason(s: GameState, shortages: DayShortages): FailureReason | null {
  if (shortages.o2) return 'o2';
  if (shortages.water) return 'water';
  if (s.flags.foodZeroStreak >= k('FOOD_FAIL_STREAK')) return 'food';
  if (s.flags.evacuations > k('MAX_EVACUATIONS')) return 'evacuated';
  if (averageDoseMSv(s) > doseBudgetMSv(s)) return 'radiation';
  return null;
}

export function scoreBreakdown(s: GameState, daysSurvived: number): { label: string; points: number }[] {
  return [
    {
      label: `Days survived (${daysSurvived} × ${k('SCORE_PER_DAY')})`,
      points: daysSurvived * k('SCORE_PER_DAY'),
    },
    { label: 'Average crew health', points: Math.round(averageHealth(s)) },
    { label: 'Science points', points: Math.round(s.science.points) },
    {
      label: `Evacuations (${s.flags.evacuations} × −${k('SCORE_EVAC_PENALTY')})`,
      points: -s.flags.evacuations * k('SCORE_EVAC_PENALTY'),
    },
    {
      label: `Days life support was cut (${s.flags.lifeSupportShedDays} × −${k('SCORE_LS_SHED_PENALTY')})`,
      points: -s.flags.lifeSupportShedDays * k('SCORE_LS_SHED_PENALTY'),
    },
  ];
}

export function starsFor(s: GameState, score: number, success: boolean): 0 | 1 | 2 | 3 {
  if (!success) return 0;
  // Thresholds are tuned for 30 days; shorter missions (the demo) scale them down.
  const scale = s.config.durationDays / k('MISSION_DAYS');
  if (score >= k('SCORE_STAR_3') * scale) return 3;
  if (score >= k('SCORE_STAR_2') * scale) return 2;
  return 1;
}

/**
 * The day after which the failing resource's 3-day moving average of net change stayed negative.
 * For radiation and evacuations: the day with the largest jump in dose or drop in health.
 */
export function turningPoint(history: DaySnapshot[], reason: FailureReason): number | undefined {
  if (history.length < 2) return undefined;
  const series = (pick: (h: DaySnapshot) => number) =>
    history.slice(1).map((h, i) => ({ day: h.day, net: pick(h) - pick(history[i]) }));

  if (reason === 'radiation' || reason === 'evacuated') {
    const nets = series(reason === 'radiation' ? (h) => h.avgDose : (h) => -h.avgHealth);
    return nets.reduce((best, x) => (x.net > best.net ? x : best)).day;
  }

  const key = reason === 'o2' ? 'o2Kg' : reason === 'water' ? 'waterKg' : 'foodKcal';
  const nets = series((h) => h[key]);
  const avg = nets.map((_, i) => {
    const window = nets.slice(Math.max(0, i - 2), i + 1);
    return window.reduce((sum, x) => sum + x.net, 0) / window.length;
  });
  let turning = nets[nets.length - 1].day;
  for (let i = avg.length - 1; i >= 0 && avg[i] < 0; i--) turning = nets[i].day;
  return turning;
}

export function evaluateOutcome(s: GameState, day: number, shortages: DayShortages): Outcome | null {
  const reason = failureReason(s, shortages);
  const success = !reason && day >= s.config.durationDays;
  if (!reason && !success) return null;

  const daysSurvived = success ? s.config.durationDays : day - 1;
  const breakdown = scoreBreakdown(s, daysSurvived);
  const score = Math.max(
    0,
    breakdown.reduce((sum, b) => sum + b.points, 0),
  );
  return {
    result: success ? 'success' : 'failure',
    reason: reason ?? undefined,
    score,
    stars: starsFor(s, score, success),
    turningPointDay: reason ? turningPoint(s.history, reason) : undefined,
    breakdown,
  };
}
