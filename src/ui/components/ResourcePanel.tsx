/** AstroBase Component: ResourcePanel — O2, water, food, and energy reserve overview. */
import { Link } from 'react-router-dom';
import { averageDoseMSv, doseBudgetMSv, k, resourceAlertLevel, type AlertLevel } from '../../engine';
import type { MissionView } from '../../store/selectors';
import { cx, fmt1, fmtDays, fmtInt } from '../format';
import { ProgressBar } from './ProgressBar';
import { StatusTag } from './StatusTag';

interface GaugeProps {
  id: string;
  label: string;
  value: string;
  unit: string;
  fraction: number;
  color: string;
  sub: string;
  extra?: string;
  level: AlertLevel | null;
  libraryKey: string;
  ariaText: string;
  highlight?: boolean;
}

export function ResourceGauge({
  id,
  label,
  value,
  unit,
  fraction,
  color,
  sub,
  extra,
  level,
  libraryKey,
  ariaText,
  highlight,
}: GaugeProps) {
  return (
    <div
      id={id}
      data-tutorial={id}
      className={cx(
        'rounded-lg border bg-panel-2/60 p-3 transition-colors',
        level === 'red'
          ? 'pulse-red border-danger/70'
          : level === 'amber'
            ? 'border-warn/60'
            : 'border-transparent',
        highlight && 'ring-2 ring-info',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          {level && <StatusTag level={level} />}
          <Link
            to={`/library#${libraryKey}`}
            className="text-xs text-muted hover:text-info"
            aria-label={`Source for ${label}`}
          >
            Source
          </Link>
        </div>
      </div>
      <div
        className="mt-1 flex items-baseline gap-1"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.max(0, Math.min(1, fraction)) * 100)}
        aria-valuetext={ariaText}
        aria-label={label}
      >
        <span className="num text-xl font-semibold">{value}</span>
        <span className="text-xs text-muted">{unit}</span>
      </div>
      <ProgressBar value={fraction} color={color} className="mt-2" />
      <div className="mt-1.5 text-xs text-muted">{sub}</div>
      {extra && <div className="text-xs text-muted">{extra}</div>}
    </div>
  );
}

export function ResourcePanel({ view, highlight }: { view: MissionView; highlight?: string | null }) {
  const { game, forecast, alerts, preview } = view;
  const r = game.resources;
  const start = game.history[0];
  const present = game.crew.filter((c) => c.status !== 'evacuated').length;
  const foodDays = present > 0 ? r.foodKcal / (k('KCAL_PER_CREW_DAY') * present) : 0;
  const dose = averageDoseMSv(game);
  const budget = doseBudgetMSv(game);
  const bpIncome = game.lastDay?.bpIncome ?? k('BP_INCOME_BASE');

  const days = (d: number) => fmtDays(d);

  return (
    <section aria-labelledby="resources-title" className="panel p-3">
      <h2 id="resources-title" className="panel-title mb-2 px-1">
        Resources
      </h2>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <ResourceGauge
          id="gauge-o2"
          label="Oxygen"
          value={fmt1(r.o2Kg)}
          unit={`/ ${k('O2_TANK_MAX')} kg`}
          fraction={r.o2Kg / k('O2_TANK_MAX')}
          color="bg-o2"
          sub={days(forecast.o2Kg.daysRemaining)}
          level={resourceAlertLevel(alerts, 'gauge-o2')}
          libraryKey="O2_PER_CREW_DAY_KG"
          ariaText={`Oxygen ${fmt1(r.o2Kg)} kilograms, ${days(forecast.o2Kg.daysRemaining)}`}
          highlight={highlight === 'gauge-o2'}
        />
        <ResourceGauge
          id="gauge-water"
          label="Water"
          value={fmt1(r.waterKg)}
          unit="kg"
          fraction={r.waterKg / Math.max(start.waterKg, r.waterKg, 1)}
          color="bg-water"
          sub={days(forecast.waterKg.daysRemaining)}
          extra={r.wastewaterKg > 0.5 ? `${fmt1(r.wastewaterKg)} kg waiting to be recycled` : undefined}
          level={resourceAlertLevel(alerts, 'gauge-water')}
          libraryKey="WATER_TOTAL_PER_CREW_DAY"
          ariaText={`Water ${fmt1(r.waterKg)} kilograms, ${days(forecast.waterKg.daysRemaining)}`}
          highlight={highlight === 'gauge-water'}
        />
        <ResourceGauge
          id="gauge-food"
          label="Food"
          value={fmtInt(r.foodKcal)}
          unit="kcal"
          fraction={r.foodKcal / Math.max(start.foodKcal, r.foodKcal, 1)}
          color="bg-food"
          sub={`${Math.floor(foodDays)} days of meals · ${days(forecast.foodKcal.daysRemaining).toLowerCase()} at current rate`}
          level={resourceAlertLevel(alerts, 'gauge-food')}
          libraryKey="KCAL_PER_CREW_DAY"
          ariaText={`Food ${fmtInt(r.foodKcal)} kilocalories, ${Math.floor(foodDays)} days of meals`}
          highlight={highlight === 'gauge-food'}
        />
        <ResourceGauge
          id="gauge-battery"
          label="Battery"
          value={fmt1(r.batteryKWh)}
          unit={`/ ${fmt1(preview.batteryCapacityKWh)} kWh`}
          fraction={r.batteryKWh / Math.max(1, preview.batteryCapacityKWh)}
          color="bg-power"
          sub={`Projected at sunrise: ${fmt1(preview.batteryEndKWh)} kWh`}
          level={resourceAlertLevel(alerts, 'gauge-battery')}
          libraryKey="BATTERY_BASE"
          ariaText={`Battery ${fmt1(r.batteryKWh)} of ${fmt1(preview.batteryCapacityKWh)} kilowatt hours`}
          highlight={highlight === 'gauge-battery'}
        />
        <ResourceGauge
          id="gauge-dose"
          label="Radiation dose (crew average)"
          value={fmt1(dose)}
          unit={`/ ${budget} mSv`}
          fraction={dose / budget}
          color="bg-radiation"
          sub={`Mission budget ${budget} mSv · NASA career limit ${k('NASA_CAREER_LIMIT')} mSv`}
          level={resourceAlertLevel(alerts, 'gauge-dose')}
          libraryKey={game.config.location === 'mars' ? 'MARS_SURFACE_GCR_DOSE' : 'MOON_SURFACE_DOSE'}
          ariaText={`Average dose ${fmt1(dose)} of ${budget} millisieverts`}
          highlight={highlight === 'gauge-dose'}
        />
        <div className="rounded-lg bg-panel-2/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Build points</span>
            <Link to="/library#BP_INCOME_BASE" className="text-xs text-muted hover:text-info">
              Source
            </Link>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="num text-xl font-semibold">{fmtInt(r.buildPoints - view.pendingCostBP)}</span>
            <span className="text-xs text-muted">BP available</span>
          </div>
          <div className="mt-1 text-xs text-muted">
            +{bpIncome} BP per day{view.pendingCostBP > 0 ? ` · ${view.pendingCostBP} BP ordered today` : ''}
          </div>
        </div>
      </div>
    </section>
  );
}
