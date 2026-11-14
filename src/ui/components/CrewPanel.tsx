/** AstroBase Component: CrewPanel — Crew roster, assignment picker, and health/morale status. */
import copy from '../../content/i18n/en.json';
import { CREW_TASKS, k, type CrewMember, type CrewTask } from '../../engine';
import { useGameStore } from '../../store/gameStore';
import type { MissionView } from '../../store/selectors';
import { cx, fmt1 } from '../format';
import { ProgressBar } from './ProgressBar';
import { StatusTag } from './StatusTag';

function healthLevel(health: number) {
  if (health < k('HEALTH_RED')) return 'red' as const;
  if (health < k('HEALTH_AMBER')) return 'amber' as const;
  return null;
}

export function CrewPanel({ view, highlight }: { view: MissionView; highlight?: boolean }) {
  return (
    <section
      aria-labelledby="crew-title"
      className={cx('panel p-3', highlight && 'ring-2 ring-info')}
      id="crew"
      data-tutorial="crew"
    >
      <h2 id="crew-title" className="panel-title mb-2 px-1">
        Crew
      </h2>
      <ul className="space-y-2">
        {view.game.crew.map((member) => (
          <CrewCard key={member.id} member={member} view={view} />
        ))}
      </ul>
    </section>
  );
}

function CrewCard({ member, view }: { member: CrewMember; view: MissionView }) {
  const assign = useGameStore((s) => s.assign);
  const evacuated = member.status === 'evacuated';
  const sick = member.status === 'sick';
  const task: CrewTask = view.pending.assignments?.[member.id] ?? member.assignment;
  const level = evacuated ? null : healthLevel(member.health);
  const selectId = `task-${member.id}`;

  return (
    <li className={cx('rounded-lg bg-panel-2/60 p-2.5', evacuated && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{member.name}</div>
          <div className="text-xs text-muted" title={copy.roleBonus[member.role]}>
            {copy.roles[member.role]} · {copy.roleBonus[member.role]}
          </div>
        </div>
        {evacuated ? (
          <StatusTag level="info" label="Evacuated" />
        ) : sick ? (
          <StatusTag level="amber" label="Sick" />
        ) : (
          level && <StatusTag level={level} label={level === 'red' ? 'Critical' : 'Weak'} />
        )}
      </div>
      {!evacuated && (
        <>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="w-12 text-muted">Health</span>
            <ProgressBar
              value={member.health / 100}
              color={level === 'red' ? 'bg-danger' : level === 'amber' ? 'bg-warn' : 'bg-ok'}
              className="flex-1"
            />
            <span className="num w-8 text-right">{Math.round(member.health)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-muted">
            <span>Dose {fmt1(member.doseMSv)} mSv</span>
          </div>
          <div className="mt-2">
            <label htmlFor={selectId} className="sr-only">
              Task for {member.name}
            </label>
            <select
              id={selectId}
              value={task}
              onChange={(e) => assign(member.id, e.target.value as CrewTask)}
              className="input w-full py-1.5"
              title={copy.taskHelp[task]}
            >
              {CREW_TASKS.map((t) => (
                <option key={t} value={t}>
                  {copy.tasks[t]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted">
              {sick ? 'Sick: cannot work until recovered.' : copy.taskHelp[task]}
            </p>
          </div>
        </>
      )}
    </li>
  );
}
