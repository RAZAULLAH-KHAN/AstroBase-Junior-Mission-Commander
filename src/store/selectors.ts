// Derived data for the UI. Memoised per game/pending pair so components stay cheap to render.
import { useMemo } from 'react';
import {
  getAlerts,
  getForecast,
  getKnownEvents,
  k,
  MODULE_DEFS,
  outdoorBlock,
  previewPower,
  validateDecisions,
  type DayDecisions,
  type GameState,
} from '../engine';
import { useGameStore } from './gameStore';

export function pendingCostBP(pending: DayDecisions): number {
  const builds = (pending.builds ?? []).reduce((sum, b) => sum + MODULE_DEFS[b.module].costBP, 0);
  return builds + (pending.repair?.length ?? 0) * k('REPAIR_COST_BP');
}

export function useMission() {
  const game = useGameStore((s) => s.game);
  const pending = useGameStore((s) => s.pending);
  return useMemo(() => {
    if (!game) return null;
    return derive(game, pending);
  }, [game, pending]);
}

export function derive(game: GameState, pending: DayDecisions) {
  return {
    game,
    pending,
    forecast: getForecast(game),
    alerts: getAlerts(game),
    preview: previewPower(game, pending),
    validation: validateDecisions(game, pending),
    known: getKnownEvents(game),
    outdoorBlock: outdoorBlock(game),
    pendingCostBP: pendingCostBP(pending),
    dayLabel: game.config.location === 'mars' ? 'Sol' : 'Day',
  };
}

export type MissionView = ReturnType<typeof derive>;
