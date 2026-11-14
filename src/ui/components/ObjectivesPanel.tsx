/** AstroBase Component: ObjectivesPanel — Mission milestones, science targets, and completion rewards. */
import { bedMaturity, OBJECTIVES, type GameState, type ObjectiveId } from '../../engine';
import { cx } from '../format';
import { objectiveName } from '../objectives';

function progress(game: GameState, id: ObjectiveId): string {
  const s = game.science;
  const target = OBJECTIVES.find((o) => o.id === id)!.target;
  switch (id) {
    case 'samples':
      return `${Math.min(s.evaCount, target)}/${target} EVAs`;
    case 'lab':
      return `${Math.min(s.labDays, target)}/${target} days`;
    case 'drill':
      return `${Math.min(s.drillEvaCount, target)}/${target} drills`;
    case 'harvest': {
      const best = Math.max(...game.greenhouseBeds.map((b) => bedMaturity(b.plantedDay, game.day)), 0);
      return `${Math.round(best * 100)}% grown`;
    }
    case 'storm':
      return 'Event-based';
  }
}

export function ObjectivesPanel({ game }: { game: GameState }) {
  return (
    <section aria-labelledby="objectives-title" className="panel p-3">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 id="objectives-title" className="panel-title">
          Science objectives
        </h2>
        <span className="num text-sm text-science">{Math.round(game.science.points)} SP</span>
      </div>
      <ul className="space-y-1.5">
        {OBJECTIVES.map((o) => {
          const done = game.science.objectivesDone.includes(o.id);
          const text = objectiveName(game, o.id);
          return (
            <li
              key={o.id}
              className={cx('rounded-lg bg-panel-2/60 p-2 text-sm', done && 'border border-ok/40')}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">
                  <span className="sr-only">{done ? 'Completed: ' : 'Not completed: '}</span>
                  {text.name}
                </span>
                <span className={cx('num shrink-0 text-xs', done ? 'text-ok' : 'text-muted')}>
                  {done ? `Done · +${o.rewardSP} SP` : `+${o.rewardSP} SP`}
                </span>
              </div>
              <div className="mt-0.5 flex justify-between gap-2 text-xs text-muted">
                <span>{text.requirement}</span>
                {!done && <span className="num shrink-0">{progress(game, o.id)}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
