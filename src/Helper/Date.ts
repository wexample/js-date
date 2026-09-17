export type DateInput = Date | string | number | null | undefined;

export type DateRelativeUnit = 'now' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

export type DateRelativeDiff = {
  unit: DateRelativeUnit;
  count: number;
  past: boolean;
};

// The vocabulary a display asks for, shared with the PHP side so that a format
// named in a template means the same thing once the browser takes over.
export const DATE_DISPLAY_TIME = 'time';
export const DATE_DISPLAY_DATE = 'date';
export const DATE_DISPLAY_DATE_SHORT = 'date_short';
export const DATE_DISPLAY_DATE_LONG = 'date_long';
export const DATE_DISPLAY_DATE_TIME = 'date_time';
export const DATE_DISPLAY_DATE_TIME_SHORT = 'date_time_short';
export const DATE_DISPLAY_DATE_TIME_FULL = 'date_time_full';
export const DATE_DISPLAY_MONTH_YEAR = 'month_year';
export const DATE_DISPLAY_RELATIVE = 'relative';
export const DATE_DISPLAY_AUTO = 'auto';

export const DATE_RELATIVE_UNIT_SECONDS: Record<Exclude<DateRelativeUnit, 'now'>, number> = {
  minute: 60,
  hour: 3600,
  day: 86400,
  week: 604800,
  // Averaged, so that "3 months ago" does not shift with the length of the
  // months it happens to span.
  month: 2629800,
  year: 31557600,
};

// Read as: below this many seconds of distance, count in that unit. Past the
// last rung, count in years.
export const DATE_RELATIVE_LADDER: [number, DateRelativeUnit][] = [
  [45, 'now'],
  [3600, 'minute'],
  [86400, 'hour'],
  [604800, 'day'],
  [2629800, 'week'],
  [31557600, 'month'],
];

// Where `auto` stops counting backwards and shows a calendar date instead.
export const DATE_RELATIVE_AUTO_LIMIT_SECONDS = 604800;

// How long a rendered relative date stays true, so a ticker knows when to come
// back to it instead of redrawing the page every second.
export const DATE_RELATIVE_REFRESH_SECONDS: Record<DateRelativeUnit, number> = {
  now: 5,
  minute: 15,
  hour: 300,
  day: 3600,
  week: 3600,
  month: 3600,
  year: 3600,
};

export function dateParse(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  // A bare number is a Unix timestamp, in seconds or in milliseconds.
  if (typeof value === 'number' || /^\d+$/.test(value)) {
    const stamp = Number(value);

    return new Date(stamp > 99999999999 ? stamp : stamp * 1000);
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateRelativeDiff(seconds: number): DateRelativeDiff {
  const elapsed = Math.abs(seconds);
  const past = seconds >= 0;

  for (const [limit, unit] of DATE_RELATIVE_LADDER) {
    if (elapsed < limit) {
      return {
        unit,
        count:
          unit === 'now' ? 0 : Math.max(1, Math.round(elapsed / DATE_RELATIVE_UNIT_SECONDS[unit])),
        past,
      };
    }
  }

  return {
    unit: 'year',
    count: Math.max(1, Math.round(elapsed / DATE_RELATIVE_UNIT_SECONDS.year)),
    past,
  };
}
