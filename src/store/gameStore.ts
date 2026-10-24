// Application state (Doc 03 §7). The store validates decisions, calls the engine, persists and tracks UI state.
import { create } from 'zustand';
import {
  createMission,
  demoConfig,
  getKnownEvents,
  plannedEvaCrew,
  simulateDay,
  validateDecisions,
  type CrewTask,
  type DayDecisions,
  type DayReport,
  type EvaMode,
  type GameState,
  type MissionConfig,
  type ModuleId,
  type SystemId,
} from '../engine';
import {
  clearSave,
  loadSave,
  loadSettings,
  saveSettings,
  setTutorialDone,
  isTutorialDone,
  writeSave,
  type Settings,
} from './persistence';

export interface EventNotice {
  id: string; // `${eventKey}:${status}`
  eventKey: string;
}

interface UndoSnapshot {
  game: GameState;
  reports: DayReport[];
  seenNotices: string[];
}

export interface GameStore {
  game: GameState | null;
  pending: DayDecisions;
  reports: DayReport[];
  lastReport: DayReport | null;
  previous: UndoSnapshot | null;
  seenNotices: string[];
  notices: EventNotice[];
  reportOpen: boolean;
  tutorialStep: number | null;
  settings: Settings;
  message: string | null; // one-off status message (e.g. a discarded save)

  newMission(config: MissionConfig): void;
  startDemo(): void;
  loadSaved(): boolean;
  abandonMission(): void;

  setPriority(priority: SystemId[]): void;
  setDimmer(system: 'greenhouse' | 'lab', value: number): void;
  assign(crewId: string, task: CrewTask): void;
  toggleBuild(module: ModuleId): void;
  toggleRepair(module: ModuleId): void;
  setShelter(on: boolean): void;
  setCleanPanels(on: boolean): void;
  planEva(): void;
  cancelEva(): void;
  setEvaMode(mode: EvaMode): void;

  endDay(): DayReport | null;
  undo(): void;

  openReport(): void;
  closeReport(): void;
  dismissNotice(): void;

  startTutorial(): void;
  setTutorialStep(step: number | null): void;
  finishTutorial(): void;

  updateSettings(patch: Partial<Settings>): void;
  clearMessage(): void;
}

/** Decisions carried between days (priority, dimmers, tasks) start from the game state each day. */
export function freshPending(game: GameState): DayDecisions {
  return {
    priority: [...game.power.priority],
    dimmers: { ...game.power.dimmers },
    assignments: Object.fromEntries(
      game.crew.filter((c) => c.status !== 'evacuated').map((c) => [c.id, c.assignment]),
    ),
    builds: [],
    repair: [],
    shelter: false,
    cleanPanels: false,
    evaMode: 'survey',
  };
}

/** Forecasts and newly visible events the player has not acknowledged yet. */
function newNotices(game: GameState, seen: string[]): EventNotice[] {
  if (game.outcome) return [];
  return getKnownEvents(game)
    .filter(
      (k) => k.def.kind !== 'moduleFailure' && k.def.kind !== 'moduleDamage' && k.def.kind !== 'crewIllness',
    )
    .map((k) => ({ id: `${k.event.key}:${k.status}`, eventKey: k.event.key }))
    .filter((n) => !seen.includes(n.id));
}

/** Remember which crew were doing what before an EVA was planned, so cancelling restores them. */
const evaRestore = new Map<string, CrewTask>();

export const useGameStore = create<GameStore>((set, get) => {
  const persist = () => {
    const { game, reports, seenNotices } = get();
    if (!game || game.config.demo) return;
    writeSave({ schemaVersion: 1, game, reports, seenNotices });
  };

  const updatePending = (patch: Partial<DayDecisions>) =>
    set((st) => ({ pending: { ...st.pending, ...patch } }));

  const startGame = (game: GameState) => {
    evaRestore.clear();
    const notices = newNotices(game, []);
    set({
      game,
      pending: freshPending(game),
      reports: [],
      lastReport: null,
      previous: null,
      seenNotices: notices.map((n) => n.id),
      notices,
      reportOpen: false,
      tutorialStep: isTutorialDone() ? null : 0,
    });
    persist();
  };

  return {
    game: null,
    pending: {},
    reports: [],
    lastReport: null,
    previous: null,
    seenNotices: [],
    notices: [],
    reportOpen: false,
    tutorialStep: null,
    settings: loadSettings(),
    message: null,

    newMission: (config) => startGame(createMission(config)),

    startDemo: () => startGame(createMission(demoConfig())),

    loadSaved: () => {
      const result = loadSave();
      if (result.status === 'incompatible') {
        set({ message: 'Your saved mission was made with an older version and could not be loaded.' });
        return false;
      }
      if (result.status === 'none') return false;
      const { game, reports, seenNotices } = result.save;
      evaRestore.clear();
      const notices = newNotices(game, seenNotices);
      set({
        game,
        reports,
        lastReport: reports[reports.length - 1] ?? null,
        pending: freshPending(game),
        previous: null,
        seenNotices: [...seenNotices, ...notices.map((n) => n.id)],
        notices,
        reportOpen: false,
        tutorialStep: null,
      });
      return true;
    },

    abandonMission: () => {
      clearSave();
      evaRestore.clear();
      set({
        game: null,
        pending: {},
        reports: [],
        lastReport: null,
        previous: null,
        notices: [],
        reportOpen: false,
        tutorialStep: null,
      });
    },

    setPriority: (priority) => updatePending({ priority }),

    setDimmer: (system, value) => updatePending({ dimmers: { ...get().pending.dimmers, [system]: value } }),

    assign: (crewId, task) => {
      evaRestore.delete(crewId);
      updatePending({ assignments: { ...get().pending.assignments, [crewId]: task } });
    },

    toggleBuild: (module) => {
      const { game, pending } = get();
      if (!game) return;
      const builds = pending.builds ?? [];
      const exists = builds.some((b) => b.module === module);
      updatePending({
        builds: exists
          ? builds.filter((b) => b.module !== module)
          : [...builds, { module, targetLevel: game.modules[module].level + 1 }],
      });
    },

    toggleRepair: (module) => {
      const repair = get().pending.repair ?? [];
      updatePending({
        repair: repair.includes(module) ? repair.filter((m) => m !== module) : [...repair, module],
      });
    },

    setShelter: (on) => {
      if (on) get().cancelEva();
      updatePending({ shelter: on });
    },

    setCleanPanels: (on) => updatePending({ cleanPanels: on }),

    planEva: () => {
      const { game, pending } = get();
      if (!game) return;
      const assignments = { ...pending.assignments };
      // Prefer the Scientist (science bonus); never send the Engineer, who keeps repairs fast.
      const candidates = game.crew
        .filter((c) => c.status === 'active' && c.role !== 'engineer')
        .sort(
          (a, b) => Number(b.role === 'scientist') - Number(a.role === 'scientist') || b.health - a.health,
        )
        .slice(0, 2);
      for (const c of candidates) {
        evaRestore.set(c.id, assignments[c.id] ?? c.assignment);
        assignments[c.id] = 'eva';
      }
      updatePending({ assignments, shelter: false });
    },

    cancelEva: () => {
      const { game, pending } = get();
      if (!game) return;
      const assignments = { ...pending.assignments };
      for (const c of plannedEvaCrew(game, pending)) {
        const original = game.crew.find((x) => x.id === c.id)?.assignment;
        assignments[c.id] =
          evaRestore.get(c.id) ?? (original && original !== 'eva' ? original : 'maintenance');
      }
      evaRestore.clear();
      updatePending({ assignments });
    },

    setEvaMode: (mode) => updatePending({ evaMode: mode }),

    endDay: () => {
      const { game, pending, reports, seenNotices, tutorialStep } = get();
      if (!game || game.outcome) return null;
      if (!validateDecisions(game, pending).ok) return null;

      const canUndo = game.config.difficulty === 'training' && !game.flags.undoUsed && !game.config.demo;
      const { next, report } = simulateDay(game, pending);
      evaRestore.clear();
      const notices = newNotices(next, seenNotices);
      set({
        game: next,
        pending: freshPending(next),
        reports: [...reports, report],
        lastReport: report,
        previous: canUndo ? { game, reports, seenNotices } : null,
        seenNotices: [...seenNotices, ...notices.map((n) => n.id)],
        notices,
        reportOpen: true,
        tutorialStep: tutorialStep === 3 ? 4 : tutorialStep,
      });
      persist();
      return report;
    },

    undo: () => {
      const { previous } = get();
      if (!previous) return;
      const game: GameState = { ...previous.game, flags: { ...previous.game.flags, undoUsed: true } };
      set({
        game,
        reports: previous.reports,
        lastReport: previous.reports[previous.reports.length - 1] ?? null,
        pending: freshPending(game),
        previous: null,
        seenNotices: previous.seenNotices,
        notices: [],
        reportOpen: false,
      });
      persist();
    },

    openReport: () => set((st) => ({ reportOpen: st.lastReport !== null })),
    closeReport: () => {
      if (get().tutorialStep === 4) setTutorialDone(true);
      set((st) => ({ reportOpen: false, tutorialStep: st.tutorialStep === 4 ? null : st.tutorialStep }));
    },
    dismissNotice: () => set((st) => ({ notices: st.notices.slice(1) })),

    startTutorial: () => set({ tutorialStep: 0 }),
    setTutorialStep: (step) => set({ tutorialStep: step }),
    finishTutorial: () => {
      setTutorialDone(true);
      set({ tutorialStep: null });
    },

    updateSettings: (patch) => {
      const settings = { ...get().settings, ...patch };
      saveSettings(settings);
      set({ settings });
    },

    clearMessage: () => set({ message: null }),
  };
});
