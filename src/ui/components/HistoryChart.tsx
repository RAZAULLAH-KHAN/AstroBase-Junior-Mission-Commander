import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { eventDef, type DaySnapshot, type GameState } from '../../engine';
import { cx, fmt1, fmtInt } from '../format';

type Metric = 'o2Kg' | 'waterKg' | 'foodKcal' | 'batteryKWh' | 'avgDose' | 'avgHealth' | 'generationKWh';

const METRICS: { key: Metric; label: string; unit: string; color: string }[] = [
  { key: 'o2Kg', label: 'Oxygen', unit: 'kg', color: 'rgb(var(--o2))' },
  { key: 'waterKg', label: 'Water', unit: 'kg', color: 'rgb(var(--water))' },
  { key: 'foodKcal', label: 'Food', unit: 'kcal', color: 'rgb(var(--food))' },
  { key: 'batteryKWh', label: 'Battery', unit: 'kWh', color: 'rgb(var(--power))' },
  { key: 'generationKWh', label: 'Solar', unit: 'kWh', color: 'rgb(var(--power))' },
  { key: 'avgDose', label: 'Dose', unit: 'mSv', color: 'rgb(var(--radiation))' },
  { key: 'avgHealth', label: 'Health', unit: '', color: 'rgb(var(--ok))' },
];

/** Days on which an event started, for x-axis markers. */
function eventStarts(history: DaySnapshot[]): { day: number; label: string }[] {
  const marks: { day: number; label: string }[] = [];
  history.forEach((h, i) => {
    const prev = new Set(history[i - 1]?.eventIds ?? []);
    for (const id of h.eventIds) {
      if (!prev.has(id) && !id.startsWith('fail.') && id !== 'crew.illness')
        marks.push({ day: h.day, label: eventDef(id).name });
    }
  });
  return marks;
}

export function HistoryChart({
  game,
  initial = 'o2Kg',
  turningPointDay,
}: {
  game: GameState;
  initial?: Metric;
  turningPointDay?: number;
}) {
  const [metric, setMetric] = useState<Metric>(initial);
  const m = METRICS.find((x) => x.key === metric)!;
  const data = game.history.filter((h) => metric !== 'generationKWh' || h.day > 0);
  const marks = eventStarts(game.history);
  const format = (v: number) => (m.unit === 'kcal' || m.unit === '' ? fmtInt(v) : fmt1(v));
  const dayLabel = game.config.location === 'mars' ? 'Sol' : 'Day';

  return (
    <div>
      <div role="tablist" aria-label="Chart metric" className="mb-3 flex flex-wrap gap-1">
        {METRICS.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={x.key === metric}
            onClick={() => setMetric(x.key)}
            className={cx(
              'min-h-[36px] rounded-lg px-3 text-sm',
              x.key === metric ? 'bg-panel-2 text-text ring-1 ring-border' : 'text-muted hover:text-text',
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      {data.length < 2 ? (
        <p className="text-sm text-muted">The chart fills in after the first {dayLabel.toLowerCase()}.</p>
      ) : (
        <div
          className="h-64 w-full"
          role="img"
          aria-label={`${m.label} over the mission. Latest value ${format(data[data.length - 1][metric])} ${m.unit}.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 16, right: 16, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="rgb(var(--panel-border))" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="rgb(var(--text-muted))" tick={{ fontSize: 12 }} />
              <YAxis
                stroke="rgb(var(--text-muted))"
                tick={{ fontSize: 12 }}
                width={64}
                tickFormatter={format}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgb(var(--panel))',
                  border: '1px solid rgb(var(--panel-border))',
                  borderRadius: 8,
                }}
                labelFormatter={(d) => `${dayLabel} ${d}`}
                formatter={(v: number) => [`${format(v)} ${m.unit}`, m.label]}
              />
              {marks.map((mark) => (
                <ReferenceLine
                  key={`${mark.day}-${mark.label}`}
                  x={mark.day}
                  stroke="rgb(var(--warn))"
                  strokeDasharray="4 3"
                  label={{
                    value: mark.label,
                    position: 'insideTopLeft',
                    fill: 'rgb(var(--warn))',
                    fontSize: 10,
                  }}
                />
              ))}
              {turningPointDay !== undefined && (
                <ReferenceLine
                  x={turningPointDay}
                  stroke="rgb(var(--danger))"
                  label={{
                    value: 'Turning point',
                    position: 'insideBottomRight',
                    fill: 'rgb(var(--danger))',
                    fontSize: 11,
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey={metric}
                stroke={m.color}
                strokeWidth={2}
                dot={{ r: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {marks.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Dashed lines mark events:{' '}
          {marks.map((x) => `${x.label} (${dayLabel.toLowerCase()} ${x.day})`).join(', ')}.
        </p>
      )}
    </div>
  );
}
