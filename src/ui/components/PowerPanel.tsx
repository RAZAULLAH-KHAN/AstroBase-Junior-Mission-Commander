import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import copy from '../../content/i18n/en.json';
import type { SystemId } from '../../engine';
import { useGameStore } from '../../store/gameStore';
import type { MissionView } from '../../store/selectors';
import { cx, fmt1, fmtPct } from '../format';
import { ProgressBar } from './ProgressBar';

const SYSTEM_COLORS: Record<SystemId, string> = {
  lifeSupport: 'bg-o2',
  thermal: 'bg-warn',
  water: 'bg-water',
  greenhouse: 'bg-food',
  lab: 'bg-science',
};

function FlowBox({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg bg-panel-2/60 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={cx('num text-lg font-semibold', tone)}>{value}</div>
      {sub && <div className="truncate text-xs text-muted">{sub}</div>}
    </div>
  );
}

function Arrow() {
  return (
    <div aria-hidden="true" className="hidden items-center sm:flex">
      <div className="h-px w-5 bg-border" />
      <div className="h-0 w-0 border-y-4 border-l-[6px] border-y-transparent border-l-border" />
    </div>
  );
}

export function PowerPanel({ view }: { view: MissionView }) {
  const { game, preview, pending, dayLabel } = view;
  const last = game.lastDay;
  const env = game.environment;
  const mars = game.config.location === 'mars';
  const deficit =
    preview.totalDemandKWh -
    Object.entries(preview.demand).reduce((sum, [sys, d]) => sum + d * preview.served[sys as SystemId], 0);

  return (
    <section aria-labelledby="power-title" className="panel p-4" data-tutorial="power-flow" id="power-flow">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="power-title" className="panel-title">
          Power flow — projected for {dayLabel.toLowerCase()} {game.day}
        </h2>
        <Link to="/library#MARS_CLEAR_INSOLATION" className="text-xs text-muted hover:text-info">
          How solar power is calculated
        </Link>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <FlowBox
          label="Solar generation"
          value={`${fmt1(preview.generationKWh)} kWh`}
          sub={
            mars
              ? `Sky τ ${env.dustOpticalDepth.toFixed(1)} · panels ${fmtPct(env.panelDustFactor)} clean`
              : `Sunlight ${fmtPct(env.illuminationFraction)} of the day`
          }
          tone="text-power"
        />
        <Arrow />
        <FlowBox
          label="Battery now → sunrise"
          value={`${fmt1(game.resources.batteryKWh)} → ${fmt1(preview.batteryEndKWh)}`}
          sub={`Capacity ${fmt1(preview.batteryCapacityKWh)} kWh`}
          tone="text-power"
        />
        <Arrow />
        <FlowBox
          label="Systems demand"
          value={`${fmt1(preview.totalDemandKWh)} kWh`}
          sub={deficit > 0.05 ? `Short by ${fmt1(deficit)} kWh` : 'All systems covered'}
          tone={deficit > 0.05 ? 'text-danger' : 'text-ok'}
        />
      </div>
      {last && (
        <p className="mt-2 text-xs text-muted">
          Last {dayLabel.toLowerCase()}: generated {fmt1(last.generationKWh)} kWh
          {last.wastedKWh > 0.5 ? `, ${fmt1(last.wastedKWh)} kWh wasted because the battery was full` : ''}.
        </p>
      )}
      <PriorityList view={view} priority={pending.priority ?? game.power.priority} />
    </section>
  );
}

function PriorityList({ view, priority }: { view: MissionView; priority: SystemId[] }) {
  const setPriority = useGameStore((s) => s.setPriority);
  const locked = view.game.config.difficulty === 'training';
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= priority.length) return;
    const next = arrayMove(priority, from, to);
    if (locked && next[0] !== 'lifeSupport') return;
    setPriority(next);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(priority.indexOf(active.id as SystemId), priority.indexOf(over.id as SystemId));
  };

  return (
    <div className="mt-4" data-tutorial="priority-list" id="priority-list">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Power priority</h3>
        <span className="text-xs text-muted">
          Drag, or focus a row and press Alt + ↑/↓. When power is short, the bottom of the list is cut first.
        </span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={priority} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {priority.map((sys, index) => (
              <PriorityRow
                key={sys}
                sys={sys}
                index={index}
                count={priority.length}
                view={view}
                locked={locked && sys === 'lifeSupport'}
                lockedAbove={locked && index === 1}
                onMove={(to) => move(index, to)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {locked && (
        <p className="mt-2 text-xs text-muted">
          Training: life support is locked at priority 1 to protect your crew.
        </p>
      )}
    </div>
  );
}

function PriorityRow({
  sys,
  index,
  count,
  view,
  locked,
  lockedAbove,
  onMove,
}: {
  sys: SystemId;
  index: number;
  count: number;
  view: MissionView;
  locked: boolean;
  lockedAbove: boolean;
  onMove: (to: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sys,
    disabled: locked,
  });
  const setDimmer = useGameStore((s) => s.setDimmer);
  const served = view.preview.served[sys];
  const demand = view.preview.demand[sys];
  const name = copy.systems[sys];
  const dimmable = sys === 'greenhouse' || sys === 'lab';
  const dimmer = dimmable ? (view.pending.dimmers?.[sys] ?? view.game.power.dimmers[sys]) : 1;
  const shed = served < 0.999 && demand > 0;

  const onKeyDown = (e: KeyboardEvent) => {
    if (!e.altKey) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onMove(index - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onMove(index + 1);
    }
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(
        'rounded-lg border bg-panel-2/60 p-2.5',
        isDragging ? 'z-10 border-info shadow-lg' : 'border-transparent',
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={cx(
            'num flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-sm',
            locked
              ? 'cursor-not-allowed text-muted'
              : 'cursor-grab touch-none hover:border-muted active:cursor-grabbing',
          )}
          {...attributes}
          {...listeners}
          aria-label={`${name}, priority ${index + 1} of ${count}${locked ? ', locked' : '. Drag or press space to move'}`}
          onKeyDown={(e) => {
            onKeyDown(e);
            if (!e.defaultPrevented) listeners?.onKeyDown?.(e);
          }}
        >
          {index + 1}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className={cx('num shrink-0 text-xs', shed ? 'text-danger' : 'text-muted')}>
              {fmt1(demand * served)} / {fmt1(demand)} kWh ·{' '}
              {shed ? `cut to ${fmtPct(served)}` : 'full power'}
            </span>
          </div>
          <ProgressBar
            value={demand > 0 ? served : 1}
            color={SYSTEM_COLORS[sys]}
            striped={shed}
            className="mt-1.5"
          />
        </div>
        <div className="flex shrink-0 flex-col">
          <button
            type="button"
            className="h-[22px] w-8 rounded text-xs text-muted hover:bg-panel hover:text-text disabled:opacity-30"
            onClick={() => onMove(index - 1)}
            disabled={index === 0 || locked || lockedAbove}
            aria-label={`Move ${name} up`}
          >
            ↑
          </button>
          <button
            type="button"
            className="h-[22px] w-8 rounded text-xs text-muted hover:bg-panel hover:text-text disabled:opacity-30"
            onClick={() => onMove(index + 1)}
            disabled={index === count - 1 || locked}
            aria-label={`Move ${name} down`}
          >
            ↓
          </button>
        </div>
      </div>
      {dimmable && (
        <label
          className="mt-2 flex items-center gap-3 pl-12 text-xs text-muted"
          data-tutorial={sys === 'greenhouse' ? 'greenhouse-slider' : undefined}
        >
          <span className="w-24 shrink-0">{sys === 'greenhouse' ? 'Light level' : 'Lab power'}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={Math.round(dimmer * 100)}
            onChange={(e) => setDimmer(sys, Number(e.target.value) / 100)}
            className="h-2 flex-1 cursor-pointer accent-[rgb(var(--accent))]"
            aria-label={`${name} power level`}
            aria-valuetext={`${Math.round(dimmer * 100)} percent`}
          />
          <span className="num w-10 text-right text-text">{Math.round(dimmer * 100)}%</span>
        </label>
      )}
    </li>
  );
}
