/** AstroBase UI: Objectives display helpers and localized labels. */
import copy from '../content/i18n/en.json';
import type { GameState, ObjectiveId } from '../engine';

/** Objective name and requirement; the drilling objective differs between Mars and the Moon. */
export function objectiveName(game: GameState, id: ObjectiveId) {
  const key = id === 'drill' ? (`drill.${game.config.location}` as const) : id;
  return copy.objectives[key];
}
