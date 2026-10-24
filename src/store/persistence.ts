// localStorage persistence (Doc 02 F-13, Doc 03 §7). Every access is guarded: storage can be unavailable.
import type { DayReport, GameState } from '../engine';

export const SAVE_KEY = 'astrobase.save.v1';
const SETTINGS_KEY = 'astrobase.settings.v1';
const TUTORIAL_KEY = 'astrobase.tutorialDone';

export interface SaveFile {
  schemaVersion: 1;
  game: GameState;
  reports: DayReport[];
  seenNotices: string[];
}

export type ThemePreference = 'system' | 'dark' | 'light';

export interface Settings {
  muted: boolean;
  largeText: boolean;
  theme: ThemePreference;
}

export const DEFAULT_SETTINGS: Settings = { muted: true, largeText: false, theme: 'system' };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export type LoadResult = { status: 'ok'; save: SaveFile } | { status: 'none' } | { status: 'incompatible' };

export function loadSave(): LoadResult {
  const raw = read(SAVE_KEY);
  if (!raw) return { status: 'none' };
  try {
    const parsed = JSON.parse(raw) as Partial<SaveFile>;
    if (parsed.schemaVersion !== 1 || parsed.game?.schemaVersion !== 1 || !Array.isArray(parsed.reports)) {
      write(SAVE_KEY, null);
      return { status: 'incompatible' };
    }
    return { status: 'ok', save: { ...(parsed as SaveFile), seenNotices: parsed.seenNotices ?? [] } };
  } catch {
    write(SAVE_KEY, null);
    return { status: 'incompatible' };
  }
}

export function hasSave(): boolean {
  const result = loadSave();
  return result.status === 'ok' && !result.save.game.outcome;
}

export function writeSave(save: SaveFile): boolean {
  return write(SAVE_KEY, JSON.stringify(save));
}

export function clearSave(): void {
  write(SAVE_KEY, null);
}

export function loadSettings(): Settings {
  const raw = read(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  write(SETTINGS_KEY, JSON.stringify(settings));
}

export function isTutorialDone(): boolean {
  return read(TUTORIAL_KEY) === '1';
}

export function setTutorialDone(done: boolean): void {
  write(TUTORIAL_KEY, done ? '1' : null);
}
