// Domain model for the AstroBase simulation (Doc 03 §5).
// Pure types only: no runtime code, no UI dependencies.

// ---------- Enums / literals ----------
export type Location = 'mars' | 'moon';
export type Difficulty = 'training' | 'standard' | 'commander';
export type SystemId = 'lifeSupport' | 'thermal' | 'water' | 'greenhouse' | 'lab';
export type ModuleId =
  | 'solar'
  | 'battery'
  | 'greenhouse'
  | 'recycler'
  | 'shielding'
  | 'stormShelter'
  | 'cleaningBot'
  | 'o2Generator';
export type CrewRole = 'commander' | 'engineer' | 'botanist' | 'medic' | 'scientist';
export type CrewTask = 'maintenance' | 'greenhouse' | 'research' | 'regolith' | 'eva' | 'rest';
export type CrewStatus = 'active' | 'sick' | 'sheltering' | 'onEVA' | 'evacuated';
export type AlertLevel = 'info' | 'amber' | 'red';
export type EvaMode = 'survey' | 'drill';
export type ObjectiveId = 'samples' | 'harvest' | 'storm' | 'lab' | 'drill';
export type FailureReason = 'o2' | 'water' | 'food' | 'evacuated' | 'radiation';
export type EventKind =
  | 'dustStorm'
  | 'shadow'
  | 'spe'
  | 'moduleFailure'
  | 'moduleDamage'
  | 'cropDisease'
  | 'crewIllness'
  | 'resupply';

export const SYSTEM_IDS: readonly SystemId[] = ['lifeSupport', 'thermal', 'water', 'greenhouse', 'lab'];
export const MODULE_IDS: readonly ModuleId[] = [
  'solar',
  'battery',
  'greenhouse',
  'recycler',
  'shielding',
  'stormShelter',
  'cleaningBot',
  'o2Generator',
];
export const CREW_TASKS: readonly CrewTask[] = [
  'maintenance',
  'greenhouse',
  'research',
  'regolith',
  'eva',
  'rest',
];

// ---------- Configuration ----------
export interface MissionConfig {
  location: Location;
  difficulty: Difficulty;
  seed: string; // e.g. "MARS-7KQ2PX"
  durationDays: number; // 30 (7 for the demo)
  crewSize: number; // 5
  demo?: boolean; // scripted judge demo (Doc 02 §1.1)
}

// ---------- Core state ----------
export interface Resources {
  o2Kg: number;
  waterKg: number;
  wastewaterKg: number; // used water waiting to be recycled
  foodKcal: number;
  batteryKWh: number;
  buildPoints: number;
}

export interface ModuleState {
  level: number;
  condition: number; // 0..1 (1 = perfect)
  repairCompleteDay?: number; // repair in progress, finishes at start of this day
}

export interface BuildOrder {
  module: ModuleId;
  targetLevel: number;
  completeOnDay: number;
}

export interface GreenhouseBed {
  areaM2: number;
  plantedDay: number; // may be negative for beds planted before the mission
  harvestedFull: boolean;
}

export interface PowerSettings {
  priority: SystemId[]; // index 0 = highest priority
  dimmers: Record<'greenhouse' | 'lab', number>; // 0..1
}

export interface EnvironmentState {
  dustOpticalDepth: number; // τ (Mars); 0 on the Moon
  panelDustFactor: number; // 1 = clean
  illuminationFraction: number; // Moon: 0..1 sunlit share of the day; Mars: 0.5
  solarActivity: 'quiet' | 'elevated' | 'spe';
}

export interface CrewMember {
  id: string;
  name: string;
  role: CrewRole;
  health: number; // 0..100
  doseMSv: number; // cumulative mission dose
  status: CrewStatus;
  assignment: CrewTask;
  previousAssignment?: CrewTask; // restored after an EVA day
  sickUntilDay?: number; // sick through the end of this day
}

export interface ScienceState {
  points: number;
  objectivesDone: ObjectiveId[];
  evaCount: number;
  drillEvaCount: number;
  labDays: number;
}

export interface ScheduledEvent {
  key: string; // unique instance key: `${defId}@${startDay}`
  defId: string;
  startDay: number;
  durationDays: number;
  warned: boolean; // whether a forecast is issued before it starts
  params: Record<string, number>;
}

export interface ActiveEvent extends ScheduledEvent {
  endsOnDay: number; // last day the event is active (inclusive)
}

export interface DayMetrics {
  day: number;
  generationKWh: number;
  clearSkyGenerationKWh: number;
  demand: Record<SystemId, number>;
  served: Record<SystemId, number>; // fraction 0..1
  directKWh: number;
  wastedKWh: number;
  batteryStartKWh: number;
  batteryEndKWh: number;
  batteryCapacityKWh: number;
  o2ProducedKg: number;
  o2UsedKg: number;
  waterRecoveredKg: number;
  waterUsedKg: number;
  foodHarvestKcal: number;
  foodEatenKcal: number;
  foodNeedKcal: number;
  doseTodayAvgMSv: number;
  sciencePoints: number;
  evaHappened: boolean;
  sheltered: boolean;
  bpIncome: number;
}

export interface GameFlags {
  undoUsed: boolean;
  lifeSupportShedDays: number;
  foodZeroStreak: number;
  batteryWasteStreak: number;
  stormLifeSupportShed: string[]; // event keys during which life support was shed
  evacuations: number;
}

export interface GameState {
  schemaVersion: 1;
  config: MissionConfig;
  day: number; // the day the player is currently deciding (1..durationDays)
  rngState: number;
  resources: Resources;
  modules: Record<ModuleId, ModuleState>;
  buildQueue: BuildOrder[];
  greenhouseBeds: GreenhouseBed[];
  power: PowerSettings;
  environment: EnvironmentState;
  crew: CrewMember[];
  science: ScienceState;
  scheduledEvents: ScheduledEvent[];
  activeEvents: ActiveEvent[]; // events active on the most recently simulated day
  history: DaySnapshot[]; // index 0 = mission start
  lastDay: DayMetrics | null;
  flags: GameFlags;
  outcome: Outcome | null;
}

// ---------- Player input ----------
export interface DayDecisions {
  priority?: SystemId[];
  dimmers?: Partial<Record<'greenhouse' | 'lab', number>>;
  builds?: { module: ModuleId; targetLevel: number }[];
  assignments?: Record<string, CrewTask>;
  evaMode?: EvaMode;
  shelter?: boolean;
  cleanPanels?: boolean;
  repair?: ModuleId[];
}

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
}

// ---------- Content definitions ----------
export interface EventDefinition {
  id: string;
  name: string;
  category: string;
  kind: EventKind;
  locations: Location[];
  difficulties: Difficulty[];
  baseProbability: number;
  durationDays: [number, number];
  warningDays: number;
  warningChance: number;
  params: Record<string, [number, number]>;
  module?: ModuleId;
  teaches: string;
  text: {
    forecast: string;
    start: string;
    effect: string;
    engineers: string;
    libraryKey: string;
  };
}

// ---------- Output ----------
export interface CausalLink {
  id: string;
  cause: string; // 'event:mars.dust.regional' | 'decision:dimmer.greenhouse' | 'system:power.deficit'
  effect: string; // 'solarOutput' | 'shed:greenhouse' ...
  magnitude: number; // signed numeric impact
  unit: string;
  parentId?: string;
  label: string; // short text for the chip
  detail?: string; // one-sentence explanation shown on focus
}

export interface ReportDelta {
  key: string;
  label: string;
  before: number;
  after: number;
  unit: string;
}

export interface Alert {
  level: AlertLevel;
  code: string;
  resource?: keyof Resources;
  daysRemaining?: number;
  message: string;
  target?: string; // UI element the alert relates to
}

export interface DayReport {
  day: number;
  headline: string;
  deltas: ReportDelta[];
  causal: CausalLink[];
  chains: CausalLink[][];
  shed: { system: SystemId; fractionServed: number }[];
  alerts: Alert[];
  tips: string[];
  crewQuote?: { crewId: string; name: string; role: CrewRole; text: string };
  eventsStarted: string[]; // event keys that started today
  objectivesCompleted: ObjectiveId[];
  outcome: Outcome | null;
}

export interface Outcome {
  result: 'success' | 'failure';
  reason?: FailureReason;
  score: number;
  stars: 0 | 1 | 2 | 3;
  turningPointDay?: number;
  breakdown: { label: string; points: number }[];
}

export interface DaySnapshot {
  day: number;
  o2Kg: number;
  waterKg: number;
  foodKcal: number;
  batteryKWh: number;
  generationKWh: number;
  avgHealth: number;
  avgDose: number;
  sciencePoints: number;
  eventIds: string[];
}

export interface ResourceForecast {
  netPerDay: number;
  daysRemaining: number; // Infinity when not decreasing
}

export interface Forecast {
  o2Kg: ResourceForecast;
  waterKg: ResourceForecast;
  foodKcal: ResourceForecast;
}

export interface KnownEvent {
  event: ScheduledEvent;
  def: EventDefinition;
  status: 'forecast' | 'active';
  startsInDays: number; // 0 = today
}

export interface PowerPreview {
  generationKWh: number;
  demand: Record<SystemId, number>;
  served: Record<SystemId, number>;
  batteryCapacityKWh: number;
  batteryEndKWh: number;
  wastedKWh: number;
  totalDemandKWh: number;
}
