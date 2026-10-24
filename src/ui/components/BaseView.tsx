import type { KeyboardEvent, ReactNode } from 'react';
import { batteryCapacityKWh, MODULE_DEFS, type GameState, type ModuleId, type SystemId } from '../../engine';
import { cx } from '../format';

interface BaseViewProps {
  game: GameState;
  served?: Record<SystemId, number>;
  onSelect?: (module: ModuleId) => void;
  className?: string;
}

const W = 640;
const H = 240;
const GROUND = 178;

/** Scene colour from tokens.css, so the drawing follows the light/dark theme. */
const c = (name: string) => `rgb(var(--scene-${name}))`;

/** Flat 2D schematic of the outpost. Every element reflects real state; clicking a module opens its card. */
export function BaseView({ game, served, onSelect, className }: BaseViewProps) {
  const { modules, environment: env, config } = game;
  const mars = config.location === 'mars';
  const loc = mars ? 'mars' : 'moon';
  const building = new Set(game.buildQueue.map((o) => o.module));
  const charge = Math.min(1, game.resources.batteryKWh / Math.max(1, batteryCapacityKWh(game)));
  const ghLight = (served?.greenhouse ?? 1) * game.power.dimmers.greenhouse;
  const haze = mars ? Math.min(0.72, Math.max(0, (env.dustOpticalDepth - 0.6) / 5)) : 0;
  const shadow = mars ? 0 : Math.max(0, (0.8 - env.illuminationFraction) / 0.8) * 0.6;
  const spe = env.solarActivity === 'spe';
  const outside = game.crew.filter((c) => c.status === 'onEVA');
  const inside = game.crew.filter((c) => c.status !== 'evacuated' && c.status !== 'onEVA');

  const describe = [
    `${mars ? 'Mars' : 'Moon'} base.`,
    `Solar array level ${modules.solar.level}, battery level ${modules.battery.level} at ${Math.round(charge * 100)}% charge.`,
    `Greenhouse level ${modules.greenhouse.level}, shielding level ${modules.shielding.level}.`,
    modules.stormShelter.level ? 'Storm shelter built.' : '',
    haze > 0.1 ? 'Dusty sky.' : '',
    shadow > 0.2 ? 'Base in shadow.' : '',
    spe ? 'Solar particle event in progress.' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cx('h-auto w-full select-none', className)}
      role="group"
      aria-label={describe}
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c(`sky-top-${loc}`)} />
          <stop offset="1" stopColor={c(`sky-bottom-${loc}`)} />
        </linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c(`ground-top-${loc}`)} />
          <stop offset="1" stopColor={c(`ground-bottom-${loc}`)} />
        </linearGradient>
        <radialGradient id="ghGlow" cx="0.5" cy="0.6" r="0.6">
          <stop offset="0" stopColor="rgb(var(--food))" stopOpacity={0.9 * ghLight} />
          <stop offset="1" stopColor="rgb(var(--food))" stopOpacity={0.15 * ghLight} />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill="url(#sky)" />
      {/* Sun or distant Earth */}
      <circle
        cx={560}
        cy={44}
        r={mars ? 10 : 14}
        fill={c(`sun-${loc}`)}
        opacity={1 - Math.max(haze, shadow)}
      />
      {!mars && <circle cx={90} cy={40} r={9} fill={c('earth')} opacity={0.85} />}
      <path
        d={`M0 ${GROUND} Q 120 ${GROUND - 14} 240 ${GROUND - 4} T 480 ${GROUND - 8} T ${W} ${GROUND} V ${H} H 0 Z`}
        fill="url(#ground)"
      />

      {/* Solar arrays */}
      <Module
        id="solar"
        label={`Solar L${modules.solar.level}`}
        onSelect={onSelect}
        building={building.has('solar')}
      >
        {Array.from(
          { length: Math.max(modules.solar.level, building.has('solar') ? modules.solar.level + 1 : 0) },
          (_, i) => {
            const planned = i >= modules.solar.level;
            const x = 26 + (i % 2) * 62;
            const y = 112 + Math.floor(i / 2) * 34;
            return (
              <g key={i} opacity={planned ? 0.45 : 1}>
                <line x1={x + 26} y1={y + 18} x2={x + 26} y2={y + 34} stroke={c('strut')} strokeWidth={2} />
                <rect
                  x={x}
                  y={y}
                  width={54}
                  height={20}
                  rx={2}
                  fill={c('panel')}
                  stroke={planned ? c('planned') : c('panel-edge')}
                  strokeDasharray={planned ? '4 3' : undefined}
                  transform={`skewX(-14)`}
                  style={{ transformOrigin: `${x}px ${y}px` }}
                />
                {!planned && mars && env.panelDustFactor < 1 && (
                  <rect
                    x={x}
                    y={y}
                    width={54}
                    height={20}
                    rx={2}
                    fill={c('dust')}
                    opacity={(1 - env.panelDustFactor) * 4}
                    transform="skewX(-14)"
                    style={{ transformOrigin: `${x}px ${y}px` }}
                  />
                )}
                {!planned && modules.solar.condition < 1 && i === 0 && (
                  <path
                    d={`M${x + 12} ${y + 3} l8 7 l-4 4 l9 5`}
                    stroke="rgb(var(--danger))"
                    strokeWidth={1.5}
                    fill="none"
                  />
                )}
              </g>
            );
          },
        )}
      </Module>

      {/* Battery bank */}
      <Module
        id="battery"
        label={`Battery L${modules.battery.level}`}
        onSelect={onSelect}
        building={building.has('battery')}
      >
        {Array.from({ length: modules.battery.level }, (_, i) => (
          <g key={i}>
            <rect
              x={160 + i * 15}
              y={GROUND - 30}
              width={12}
              height={26}
              rx={2}
              fill={c('casing')}
              stroke={modules.battery.condition < 1 ? 'rgb(var(--danger))' : c('charge')}
            />
            <rect
              x={162 + i * 15}
              y={GROUND - 6 - 22 * charge}
              width={8}
              height={22 * charge}
              fill={c('charge')}
              opacity={0.85}
            />
          </g>
        ))}
      </Module>

      {/* Main habitat with regolith shielding */}
      <Module
        id="shielding"
        label={`Habitat · Shield L${modules.shielding.level}`}
        onSelect={onSelect}
        building={building.has('shielding')}
      >
        {modules.shielding.level > 0 && (
          <path
            d={`M ${250 - modules.shielding.level * 6} ${GROUND} Q 300 ${GROUND - 62 - modules.shielding.level * 8} ${350 + modules.shielding.level * 6} ${GROUND} Z`}
            fill={c(`shield-${loc}`)}
            opacity={0.9}
          />
        )}
        <path
          d={`M 258 ${GROUND} A 42 42 0 0 1 342 ${GROUND} Z`}
          fill={c('habitat')}
          stroke={c('habitat-edge')}
        />
        <rect x={290} y={GROUND - 18} width={20} height={18} rx={3} fill={c('door')} />
        {inside.map((m, i) => (
          <circle
            key={m.id}
            cx={274 + i * 13}
            cy={GROUND - 26}
            r={3.5}
            fill={m.status === 'sick' ? 'rgb(var(--warn))' : c('crew')}
          />
        ))}
      </Module>

      {/* Greenhouse domes */}
      <Module
        id="greenhouse"
        label={`Greenhouse L${modules.greenhouse.level}`}
        onSelect={onSelect}
        building={building.has('greenhouse')}
      >
        {Array.from({ length: Math.max(1, modules.greenhouse.level) }, (_, i) => (
          <g key={i} opacity={modules.greenhouse.level === 0 ? 0.35 : 1}>
            <path
              d={`M ${370 + i * 44} ${GROUND} A 20 20 0 0 1 ${410 + i * 44} ${GROUND} Z`}
              fill="url(#ghGlow)"
              stroke="rgb(var(--food))"
            />
          </g>
        ))}
      </Module>

      {/* Water recycler */}
      <Module
        id="recycler"
        label={`Recycler L${modules.recycler.level}`}
        onSelect={onSelect}
        building={building.has('recycler')}
      >
        <rect
          x={510}
          y={GROUND - 34}
          width={22}
          height={32}
          rx={8}
          fill={c('tank')}
          stroke={modules.recycler.condition < 1 ? 'rgb(var(--danger))' : 'rgb(var(--water))'}
          strokeWidth={1.5}
        />
        <rect
          x={536}
          y={GROUND - 22}
          width={14}
          height={20}
          rx={5}
          fill={c('tank')}
          stroke="rgb(var(--water))"
        />
      </Module>

      {/* Storm shelter */}
      <Module
        id="stormShelter"
        label={modules.stormShelter.level ? 'Shelter' : 'No shelter'}
        onSelect={onSelect}
        building={building.has('stormShelter')}
      >
        <rect
          x={566}
          y={GROUND - 22}
          width={44}
          height={20}
          rx={4}
          fill={modules.stormShelter.level ? c('shelter') : 'none'}
          stroke="rgb(var(--radiation))"
          strokeDasharray={modules.stormShelter.level ? undefined : '4 3'}
          opacity={modules.stormShelter.level ? 1 : 0.6}
        />
      </Module>

      {/* Cleaning robot (Mars) */}
      {mars && (modules.cleaningBot.level > 0 || building.has('cleaningBot')) && (
        <Module id="cleaningBot" label="Robot" onSelect={onSelect} building={building.has('cleaningBot')}>
          <rect
            x={112}
            y={GROUND - 12}
            width={18}
            height={9}
            rx={2}
            fill="rgb(var(--science))"
            opacity={modules.cleaningBot.level ? 1 : 0.4}
          />
          <circle cx={116} cy={GROUND - 2} r={2.5} fill={c('strut')} />
          <circle cx={126} cy={GROUND - 2} r={2.5} fill={c('strut')} />
        </Module>
      )}

      {/* Crew on EVA */}
      {outside.map((m, i) => (
        <g key={m.id} aria-hidden="true">
          <circle cx={210 + i * 14} cy={GROUND - 16} r={4} fill={c('suit')} />
          <rect x={206 + i * 14} y={GROUND - 12} width={8} height={10} rx={2} fill={c('suit')} />
        </g>
      ))}

      {/* Environment overlays */}
      {haze > 0 && <rect width={W} height={H} fill={c('dust')} opacity={haze} pointerEvents="none" />}
      {shadow > 0 && <rect width={W} height={H} fill={c('shadow')} opacity={shadow} pointerEvents="none" />}
      {spe && (
        <rect
          x={2}
          y={2}
          width={W - 4}
          height={H - 4}
          fill="none"
          stroke="rgb(var(--radiation))"
          strokeWidth={4}
          opacity={0.85}
          pointerEvents="none"
        />
      )}
    </svg>
  );
}

function Module({
  id,
  label,
  children,
  onSelect,
  building,
}: {
  id: ModuleId;
  label: string;
  children: ReactNode;
  onSelect?: (module: ModuleId) => void;
  building: boolean;
}) {
  const interactive = Boolean(onSelect);
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(id);
    }
  };
  const anchor = LABEL_POSITIONS[id];
  return (
    <g
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={
        interactive
          ? `${MODULE_DEFS[id].name}: ${label}${building ? ', under construction' : ''}. Open build options.`
          : undefined
      }
      onClick={interactive ? () => onSelect?.(id) : undefined}
      onKeyDown={interactive ? onKey : undefined}
      className={
        interactive
          ? 'cursor-pointer outline-none [&:focus-visible>text]:fill-info [&:hover>text]:fill-[rgb(var(--scene-label-strong))]'
          : undefined
      }
    >
      {children}
      <text
        x={anchor[0]}
        y={anchor[1]}
        textAnchor="middle"
        fontSize={10}
        fill={c('label')}
        stroke={c('label-halo')}
        strokeWidth={3}
        strokeLinejoin="round"
        paintOrder="stroke"
        fontFamily="Inter, sans-serif"
      >
        {label}
        {building ? ' (building)' : ''}
      </text>
    </g>
  );
}

const LABEL_POSITIONS: Record<ModuleId, [number, number]> = {
  solar: [80, 104],
  battery: [180, GROUND + 18],
  shielding: [300, GROUND + 18],
  greenhouse: [420, GROUND + 18],
  recycler: [530, GROUND + 18],
  stormShelter: [588, GROUND + 34],
  cleaningBot: [121, GROUND + 18],
  o2Generator: [300, GROUND + 30],
};
