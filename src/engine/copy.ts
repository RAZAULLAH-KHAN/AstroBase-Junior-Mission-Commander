// Text templates for engine output (reports, alerts, quotes). All copy lives in content/i18n.
import en from '../content/i18n/en.json';
import tipsJson from '../content/tips.json';

type Vars = Record<string, string | number>;

export const copy = en;
export const tips = tipsJson as Record<string, string>;

/** Replace {name} placeholders in a template. Unknown placeholders are left visible to make gaps obvious. */
export function fill(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

export function tip(id: keyof typeof tipsJson, vars?: Vars): string {
  return fill(tips[id], vars);
}

export function fmt(value: number, decimals = 1): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtInt(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

export function pct(fraction: number): number {
  return Math.round(fraction * 100);
}
