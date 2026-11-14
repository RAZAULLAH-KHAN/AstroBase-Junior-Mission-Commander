/** AstroBase Component: ActionBar — Sol advance, pause, simulation speed & emergency controls. */
import { k, plannedEvaCrew } from '../../engine';
import { useGameStore } from '../../store/gameStore';
import type { MissionView } from '../../store/selectors';
import { cx } from '../format';
import { Button } from './Button';

interface ActionBarProps {
  view: MissionView;
  onBuild: () => void;
  onEndDay: () => void;
  canUndo: boolean;
}

export function ActionBar({ view, onBuild, onEndDay, canUndo }: ActionBarProps) {
  const { game, pending, validation, outdoorBlock, dayLabel } = view;
  const planEva = useGameStore((s) => s.planEva);
  const cancelEva = useGameStore((s) => s.cancelEva);
  const setEvaMode = useGameStore((s) => s.setEvaMode);
  const setShelter = useGameStore((s) => s.setShelter);
  const setCleanPanels = useGameStore((s) => s.setCleanPanels);
  const undo = useGameStore((s) => s.undo);

  const evaCrew = plannedEvaCrew(game, pending);
  const evaPlanned = evaCrew.length > 0;
  const eligible = game.crew.filter(
    (c) => c.status === 'active' && c.role !== 'engineer' && c.health >= k('EVA_MIN_HEALTH'),
  );
  const evaBlockedReason =
    outdoorBlock === 'dust'
      ? 'Too dusty for an EVA'
      : outdoorBlock === 'spe'
        ? 'Solar storm active or forecast'
        : pending.shelter
          ? 'Crew is sheltering'
          : eligible.length < 2
            ? 'Not enough healthy crew'
            : null;

  const hasShelter = game.modules.stormShelter.level >= 1;
  const mars = game.config.location === 'mars';
  const maintenanceCrew = game.crew.some(
    (c) => c.status === 'active' && (pending.assignments?.[c.id] ?? c.assignment) === 'maintenance',
  );
  const cleanReason = outdoorBlock
    ? 'Not safe outside today'
    : !maintenanceCrew
      ? 'Put someone on Maintenance'
      : pending.shelter
        ? 'Crew is sheltering'
        : null;
  const orders = (pending.builds?.length ?? 0) + (pending.repair?.length ?? 0);
  const endLabel = `End ${dayLabel}`;

  return (
    <div
      className="no-print border-t border-border bg-bg/95 backdrop-blur"
      role="region"
      aria-label="Actions"
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-3 py-2.5">
        <Button onClick={onBuild}>Build & repair{orders > 0 ? ` (${orders})` : ''}</Button>

        {evaPlanned ? (
          <div className="flex items-center gap-1 rounded-lg border border-accent p-1">
            <span className="px-2 text-sm">EVA: {evaCrew.map((c) => c.name.split(' ')[0]).join(' + ')}</span>
            <label className="sr-only" htmlFor="eva-mode">
              EVA type
            </label>
            <select
              id="eva-mode"
              className="input py-1"
              value={pending.evaMode ?? 'survey'}
              onChange={(e) => setEvaMode(e.target.value as 'survey' | 'drill')}
            >
              <option value="survey">Survey (+{k('EVA_SP')} SP)</option>
              <option value="drill">Drill (+{k('DRILL_ENERGY')} kWh)</option>
            </select>
            <Button size="sm" variant="ghost" onClick={cancelEva}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            onClick={planEva}
            disabled={Boolean(evaBlockedReason)}
            title={evaBlockedReason ?? 'Send 2 crew outside for samples'}
          >
            Plan EVA{evaBlockedReason ? ` · ${evaBlockedReason}` : ''}
          </Button>
        )}

        <Button
          pressed={Boolean(pending.shelter)}
          onClick={() => setShelter(!pending.shelter)}
          disabled={!hasShelter}
          title={
            hasShelter ? 'Move the crew into the storm shelter for the day' : 'Build a Storm Shelter first'
          }
        >
          {pending.shelter ? 'Sheltering today' : hasShelter ? 'Shelter crew' : 'Shelter · not built'}
        </Button>

        {mars && (
          <Button
            pressed={Boolean(pending.cleanPanels)}
            onClick={() => setCleanPanels(!pending.cleanPanels)}
            disabled={!pending.cleanPanels && Boolean(cleanReason)}
            title={cleanReason ?? 'One crew member on Maintenance cleans the panels outside'}
          >
            {pending.cleanPanels
              ? 'Cleaning panels'
              : `Clean panels${cleanReason ? ` · ${cleanReason}` : ''}`}
          </Button>
        )}

        {canUndo && (
          <Button variant="ghost" onClick={undo} title="Training only: go back one day, once per mission">
            Undo last {dayLabel.toLowerCase()}
          </Button>
        )}

        <div className="ml-auto flex items-center gap-3">
          {!validation.ok && (
            <p className="max-w-md text-sm text-danger" role="status">
              {validation.errors[0].message}
            </p>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={onEndDay}
            disabled={!validation.ok}
            data-tutorial="end-sol"
            className={cx('min-w-[150px]')}
          >
            {endLabel} {game.day}
          </Button>
        </div>
      </div>
    </div>
  );
}
