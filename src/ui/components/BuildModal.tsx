/** AstroBase Component: BuildModal — Habitat module construction and upgrade interface. */
import { useEffect, useRef } from 'react';
import { canBuild, canRepair, k, MODULE_DEFS, MODULE_IDS, type ModuleId } from '../../engine';
import { useGameStore } from '../../store/gameStore';
import type { MissionView } from '../../store/selectors';
import { cx, fmtPct } from '../format';
import { Button } from './Button';
import { Modal } from './Modal';
import { StatusTag } from './StatusTag';

interface BuildModalProps {
  open: boolean;
  onClose: () => void;
  view: MissionView;
  focusModule?: ModuleId | null;
}

export function BuildModal({ open, onClose, view, focusModule }: BuildModalProps) {
  const toggleBuild = useGameStore((s) => s.toggleBuild);
  const toggleRepair = useGameStore((s) => s.toggleRepair);
  const { game, pending, dayLabel } = view;
  const available = game.resources.buildPoints - view.pendingCostBP;
  const focusRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (open && focusModule) focusRef.current?.scrollIntoView({ block: 'center' });
  }, [open, focusModule]);

  const buildable = MODULE_IDS.filter(
    (id) => MODULE_DEFS[id].buildable && MODULE_DEFS[id].locations.includes(game.config.location),
  );
  const damaged = MODULE_IDS.filter((id) => MODULE_DEFS[id].repairable && game.modules[id].condition < 1);

  const engineer = game.crew.find((c) => c.role === 'engineer');
  const engineerFast =
    engineer &&
    engineer.status !== 'evacuated' &&
    engineer.status !== 'sick' &&
    (pending.assignments?.[engineer.id] ?? engineer.assignment) === 'maintenance';
  const repairDays = engineerFast ? k('REPAIR_DAYS_ENGINEER') : k('REPAIR_DAYS');

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      eyebrow={`${dayLabel} ${game.day}`}
      title="Build and repair"
      footer={
        <>
          <span className="mr-auto self-center text-sm text-muted">
            <span className="num text-text">{Math.floor(available)} BP</span> available after today's orders
          </span>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      {damaged.length > 0 && (
        <section aria-labelledby="repairs-title" className="mb-5">
          <h3 id="repairs-title" className="panel-title mb-2">
            Repairs
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {damaged.map((id) => {
              const mod = game.modules[id];
              const ordered = pending.repair?.includes(id) ?? false;
              const check = canRepair(game, id);
              const short = !ordered && available < k('REPAIR_COST_BP');
              return (
                <li
                  key={id}
                  ref={focusModule === id ? focusRef : undefined}
                  className="rounded-lg border border-warn/50 bg-panel-2/60 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{MODULE_DEFS[id].name}</span>
                    <StatusTag
                      level={mod.condition < k('MODULE_DOWN_CONDITION') ? 'amber' : 'info'}
                      label={`${fmtPct(mod.condition)} condition`}
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {mod.repairCompleteDay !== undefined
                      ? `Repair in progress. Ready at the start of ${dayLabel.toLowerCase()} ${mod.repairCompleteDay}.`
                      : `Costs ${k('REPAIR_COST_BP')} BP and takes ${repairDays} ${repairDays === 1 ? 'day' : 'days'}${engineerFast ? ' with the Engineer on Maintenance' : ' (1 day if the Engineer is on Maintenance)'}.`}
                  </p>
                  {mod.repairCompleteDay === undefined && (
                    <Button
                      className="mt-2"
                      size="sm"
                      variant={ordered ? 'secondary' : 'primary'}
                      onClick={() => toggleRepair(id)}
                      disabled={!ordered && (!check.ok || short)}
                      title={short ? `Need ${Math.ceil(k('REPAIR_COST_BP') - available)} more BP` : undefined}
                    >
                      {ordered
                        ? 'Cancel repair'
                        : short
                          ? `Need ${Math.ceil(k('REPAIR_COST_BP') - available)} more BP`
                          : 'Order repair'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="modules-title">
        <h3 id="modules-title" className="panel-title mb-2">
          Upgrades
        </h3>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {buildable.map((id) => {
            const def = MODULE_DEFS[id];
            const mod = game.modules[id];
            const ordered = pending.builds?.some((b) => b.module === id) ?? false;
            const queued = game.buildQueue.find((o) => o.module === id);
            const check = canBuild(game, id);
            const short = !ordered && check.ok && available < def.costBP;
            const maxed = mod.level >= def.maxLevel;
            return (
              <li
                key={id}
                ref={focusModule === id ? focusRef : undefined}
                className={cx(
                  'flex flex-col rounded-lg border bg-panel-2/60 p-3',
                  ordered ? 'border-accent' : focusModule === id ? 'border-info' : 'border-transparent',
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="font-semibold">{def.name}</h4>
                  <span className="num text-xs text-muted">
                    Level {mod.level}
                    {!maxed && ` → ${mod.level + 1}`} of {def.maxLevel}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{def.description}</p>
                <p className="mt-2 text-sm">{def.effect[game.config.location]}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-2 text-xs text-muted">
                  <dt>Cost</dt>
                  <dd className="num text-right text-text">{def.costBP} BP</dd>
                  <dt>Build time</dt>
                  <dd className="num text-right text-text">
                    {def.buildDays} {def.buildDays === 1 ? 'day' : 'days'}
                  </dd>
                </dl>
                <div className="mt-auto pt-3">
                  {queued ? (
                    <p className="text-sm text-info">
                      Under construction. Ready at the start of {dayLabel.toLowerCase()}{' '}
                      {queued.completeOnDay}.
                    </p>
                  ) : maxed ? (
                    <p className="text-sm text-muted">Fully upgraded.</p>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      variant={ordered ? 'secondary' : 'primary'}
                      onClick={() => toggleBuild(id)}
                      disabled={!ordered && (!check.ok || short)}
                    >
                      {ordered
                        ? 'Cancel order'
                        : short
                          ? `Need ${Math.ceil(def.costBP - available)} more BP`
                          : `Order upgrade · ready ${dayLabel.toLowerCase()} ${game.day + def.buildDays}`}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </Modal>
  );
}
