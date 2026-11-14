// Number formatting rules: 1 decimal for kg/kWh, whole numbers for kcal and days, always units.

export function fmt1(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function fmtInt(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

export function fmtPct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function fmtDays(days: number): string {
  if (!Number.isFinite(days)) return 'Stable';
  if (days < 1) return 'Less than 1 day';
  const whole = Math.floor(days);
  return `${whole} ${whole === 1 ? 'day' : 'days'} left`;
}

export function fmtSigned(value: number, decimals = 1): string {
  const rounded = Number(value.toFixed(decimals));
  if (rounded === 0) return '0';
  const text = Math.abs(rounded).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${rounded > 0 ? '+' : '−'}${text}`;
}

export function fmtValue(value: number, unit: string): string {
  if (unit === 'kcal' || unit === 'BP' || unit === '' || unit === 'SP') return fmtInt(value);
  return fmt1(value);
}

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
