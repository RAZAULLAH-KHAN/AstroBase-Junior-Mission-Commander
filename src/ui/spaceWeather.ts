// Real space weather from NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information).
// The game reads the Sun's recent behaviour and turns it into a sun activity level that changes how
// often solar particle events hit the base. Live data is labelled as live; recorded data is labelled
// with its dates and is never presented as current.
import recorded from '../content/spaceWeather.json';
import type { SunActivity } from '../engine';

export interface ProtonEvent {
  id: string;
  time: string;
  instrument: string;
  link?: string;
}

export interface SpaceWeatherSnapshot {
  id: string;
  label: string;
  range: [string, string];
  sepCount: number;
  goesSep: ProtonEvent[];
  cmeCount: number | null;
  summary: string;
  live?: boolean;
  fetchedAt?: string;
}

export const RECORDED_SNAPSHOTS = recorded.snapshots as unknown as SpaceWeatherSnapshot[];
export const DEFAULT_SNAPSHOT_ID = 'recent-2026';
export const DONKI_HOME = 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/';

const DAY_MS = 86_400_000;
const LIVE_WINDOW_DAYS = 30;
const CACHE_KEY = 'astrobase.donki.v1';
const CACHE_TTL_MS = 6 * 3_600_000;
const TIMEOUT_MS = 8000;

function windowDays(s: SpaceWeatherSnapshot): number {
  return Math.max(1, Math.round((Date.parse(s.range[1]) - Date.parse(s.range[0])) / DAY_MS) + 1);
}

/**
 * Turn DONKI records into a sun level.
 * Stormy: a proton event above 100 MeV, or two or more proton events seen by the GOES satellites.
 * Active: one GOES proton event, or the Sun launching at least one coronal mass ejection a day.
 * Quiet: anything less.
 */
export function classify(s: SpaceWeatherSnapshot): SunActivity {
  const goes = s.goesSep.filter((e) => />10 MeV/.test(e.instrument)).length;
  const highEnergy = s.goesSep.some((e) => />100 MeV/.test(e.instrument));
  if (highEnergy || goes >= 2) return 'stormy';
  const cmePerDay = s.cmeCount === null ? 0 : s.cmeCount / windowDays(s);
  if (goes === 1 || cmePerDay >= 1) return 'active';
  return 'quiet';
}

export const SUN_LEVEL_TEXT: Record<SunActivity, { name: string; effect: string }> = {
  quiet: { name: 'Quiet', effect: 'Solar particle storms are half as likely as usual.' },
  active: { name: 'Active', effect: 'Solar particle storms happen at the normal rate.' },
  stormy: { name: 'Stormy', effect: 'Solar particle storms are twice as likely. Build shielding early.' },
};

export function fmtRange([from, to]: [string, string]): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const f = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
  return `${f(from)} – ${f(to)}`;
}

/** The label shown to players and stored with the mission, so the source is always visible. */
export function sourceLabel(s: SpaceWeatherSnapshot): string {
  if (s.live && s.fetchedAt) {
    const when = new Date(s.fetchedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    return `NASA DONKI, live data fetched ${when}`;
  }
  return `NASA DONKI, recorded data ${fmtRange(s.range)}`;
}

function isoDate(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

interface DonkiSep {
  sepID: string;
  eventTime: string;
  instruments?: { displayName: string }[];
  link?: string;
}

function readCache(): SpaceWeatherSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SpaceWeatherSnapshot;
    if (!s.fetchedAt || Date.now() - Date.parse(s.fetchedAt) > CACHE_TTL_MS) return null;
    return s;
  } catch {
    return null;
  }
}

function writeCache(s: SpaceWeatherSnapshot) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    // Storage can be unavailable (private mode). Live data still works for this visit.
  }
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`DONKI responded ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Fetch the last 30 days of solar particle events and coronal mass ejections from NASA DONKI.
 * Results are cached for 6 hours because the public demo key allows only a few requests per hour.
 * Throws when NASA cannot be reached; the caller falls back to recorded data and says so.
 */
export async function fetchLiveSpaceWeather(): Promise<SpaceWeatherSnapshot> {
  const cached = readCache();
  if (cached) return cached;

  const key = (import.meta.env.VITE_NASA_API_KEY as string | undefined) || 'DEMO_KEY';
  const end = Date.now();
  const range: [string, string] = [isoDate(end - (LIVE_WINDOW_DAYS - 1) * DAY_MS), isoDate(end)];
  const query = `startDate=${range[0]}&endDate=${range[1]}&api_key=${encodeURIComponent(key)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const [sep, cme] = await Promise.all([
      getJson<DonkiSep[] | null>(`https://api.nasa.gov/DONKI/SEP?${query}`, controller.signal),
      getJson<unknown[] | null>(`https://api.nasa.gov/DONKI/CME?${query}`, controller.signal),
    ]);
    const seps = Array.isArray(sep) ? sep : [];
    const goesSep: ProtonEvent[] = [];
    for (const e of seps) {
      const instrument = e.instruments?.map((i) => i.displayName).find((n) => /^GOES.*>10{1,2} MeV/.test(n));
      if (instrument) goesSep.push({ id: e.sepID, time: e.eventTime, instrument, link: e.link });
    }
    const cmeCount = Array.isArray(cme) ? cme.length : 0;
    const snapshot: SpaceWeatherSnapshot = {
      id: 'live',
      label: `Live: the last ${LIVE_WINDOW_DAYS} days`,
      range,
      sepCount: seps.length,
      goesSep,
      cmeCount,
      summary:
        `${seps.length === 0 ? 'No' : seps.length} solar particle event${seps.length === 1 ? '' : 's'} ` +
        `and ${cmeCount} coronal mass ejection${cmeCount === 1 ? '' : 's'} in the last ${LIVE_WINDOW_DAYS} days.`,
      live: true,
      fetchedAt: new Date().toISOString(),
    };
    writeCache(snapshot);
    return snapshot;
  } finally {
    clearTimeout(timer);
  }
}
