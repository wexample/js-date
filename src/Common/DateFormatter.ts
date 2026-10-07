import {
  DATE_DISPLAY_AUTO,
  DATE_DISPLAY_DATE,
  DATE_DISPLAY_DATE_LONG,
  DATE_DISPLAY_DATE_SHORT,
  DATE_DISPLAY_DATE_TIME,
  DATE_DISPLAY_DATE_TIME_FULL,
  DATE_DISPLAY_DATE_TIME_SHORT,
  DATE_DISPLAY_MONTH_YEAR,
  DATE_DISPLAY_RELATIVE,
  DATE_DISPLAY_TIME,
  DATE_DISPLAY_WEEK,
  DATE_DISPLAY_WEEK_RANGE,
  DATE_RELATIVE_AUTO_LIMIT_SECONDS,
  DateInput,
  dateParse,
  dateEndOfWeek,
  dateRelativeDiff,
  dateStartOfWeek,
  dateWeekNumber,
} from '../Helper/Date';

// A format name shared with the PHP side, or an explicit option bag for a shape
// the named formats do not cover.
export type DateFormat = string | Intl.DateTimeFormatOptions;

export type DateTranslate = (key: string, parameters: Record<string, string | number>) => string;

export type DateResolveLocale = () => string;

export const DATE_RELATIVE_KEY_NOW = 'date.relative.now';
export const DATE_RELATIVE_KEY_PREFIX = 'date.relative.';
// `%week%`, plus `%range%` for the range form: « Week %week% · %range% ».
export const DATE_WEEK_KEY = 'date.week.label';
export const DATE_WEEK_RANGE_KEY = 'date.week.range';

// The day and month of either end of a range, the year joining them only when
// the range crosses one — the PHP formatter's `dMMM` and `dMMMy` skeletons.
const RANGE_OPTIONS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
const RANGE_OPTIONS_YEAR: Intl.DateTimeFormatOptions = { ...RANGE_OPTIONS, year: 'numeric' };
const RANGE_SEPARATOR_DAYS = '–';
const RANGE_SEPARATOR_DATES = ' – ';

// The counterpart of the PHP formatter's ICU date and time styles: the same
// notion, spelled the way the browser spells it.
const INTL_OPTIONS: Record<string, Intl.DateTimeFormatOptions> = {
  [DATE_DISPLAY_TIME]: { timeStyle: 'short' },
  [DATE_DISPLAY_DATE]: { dateStyle: 'medium' },
  [DATE_DISPLAY_DATE_SHORT]: { dateStyle: 'short' },
  [DATE_DISPLAY_DATE_LONG]: { dateStyle: 'long' },
  [DATE_DISPLAY_DATE_TIME]: { dateStyle: 'medium', timeStyle: 'short' },
  [DATE_DISPLAY_DATE_TIME_SHORT]: { dateStyle: 'short', timeStyle: 'short' },
  [DATE_DISPLAY_DATE_TIME_FULL]: { dateStyle: 'full', timeStyle: 'medium' },
  [DATE_DISPLAY_MONTH_YEAR]: { year: 'numeric', month: 'long' },
};

/**
 * Turns a moment into the text a reader sees.
 *
 * The counterpart of the PHP formatter of the same name: both read the same
 * format names, the same relative ladder and the same translation keys, so a date
 * printed on the server and the same date redrawn here a minute later say the
 * same thing. Wording of the relative forms is left to a translator handed in at
 * construction, so that the application around it decides where the catalogue
 * lives.
 */
export default class DateFormatter {
  constructor(
    private readonly translate: DateTranslate,
    private readonly resolveLocale: DateResolveLocale
  ) {}

  format(
    value: DateInput,
    format: DateFormat = DATE_DISPLAY_AUTO,
    locale?: string,
    now?: DateInput
  ): string {
    const date = dateParse(value);

    if (!date) {
      return '';
    }

    const reference = dateParse(now) || new Date();

    if (format === DATE_DISPLAY_AUTO) {
      const distance = Math.abs(reference.getTime() - date.getTime()) / 1000;

      format =
        distance < DATE_RELATIVE_AUTO_LIMIT_SECONDS ? DATE_DISPLAY_RELATIVE : DATE_DISPLAY_DATE;
    }

    if (format === DATE_DISPLAY_RELATIVE) {
      return this.formatRelative(date, reference);
    }

    if (format === DATE_DISPLAY_WEEK || format === DATE_DISPLAY_WEEK_RANGE) {
      return this.formatWeek(date, format === DATE_DISPLAY_WEEK_RANGE, locale);
    }

    return this.formatAbsolute(date, format, locale);
  }

  /**
   * The ISO week holding the date: « Week 29 », or « Week 29 · 14–20 Jul » with
   * its Monday-to-Sunday bounds.
   */
  formatWeek(date: Date, withRange: boolean = false, locale?: string): string {
    const parameters: Record<string, string | number> = { '%week%': dateWeekNumber(date) };

    if (!withRange) {
      return this.translate(DATE_WEEK_KEY, parameters);
    }

    parameters['%range%'] = this.formatDayRange(dateStartOfWeek(date), dateEndOfWeek(date), locale);

    return this.translate(DATE_WEEK_RANGE_KEY, parameters);
  }

  /**
   * Two days as one range, what they share written once: « 14–20 Jul »,
   * « 28 Jul – 3 Aug », « 29 Dec 2025 – 4 Jan 2026 », in the locale's order.
   *
   * Built the way the PHP formatter builds it, from the locale's own
   * day-and-month form, rather than through `formatRange()`: the browser's
   * interval formatter spaces its dash differently, and a date the server wrote
   * must not change shape when the browser redraws it.
   */
  formatDayRange(start: Date, end: Date, locale?: string): string {
    const resolved = locale || this.resolveLocale();
    const sameYear = start.getFullYear() === end.getFullYear();
    const formatter = new Intl.DateTimeFormat(resolved, sameYear ? RANGE_OPTIONS : RANGE_OPTIONS_YEAR);

    if (sameYear && start.getMonth() === end.getMonth()) {
      // The end date written once, its day preceded by the first one — the bare
      // day field, read from the same form so a locale adding a unit to it
      // (`13日`) does not write that unit twice.
      const startDay = formatter.formatToParts(start).find((part) => part.type === 'day')?.value ?? '';

      return formatter
        .formatToParts(end)
        .map((part) =>
          part.type === 'day' ? startDay + RANGE_SEPARATOR_DAYS + part.value : part.value
        )
        .join('');
    }

    return formatter.format(start) + RANGE_SEPARATOR_DATES + formatter.format(end);
  }

  formatAbsolute(date: Date, format: DateFormat, locale?: string): string {
    const options = typeof format === 'string' ? INTL_OPTIONS[format] : format;

    return new Intl.DateTimeFormat(locale || this.resolveLocale(), options).format(date);
  }

  formatRelative(value: DateInput, now?: DateInput): string {
    const date = dateParse(value);

    if (!date) {
      return '';
    }

    const reference = dateParse(now) || new Date();
    const diff = dateRelativeDiff((reference.getTime() - date.getTime()) / 1000);

    if (diff.unit === 'now') {
      return this.translate(DATE_RELATIVE_KEY_NOW, {});
    }

    const key =
      DATE_RELATIVE_KEY_PREFIX +
      (diff.past ? 'past' : 'future') +
      `.${diff.unit}_${diff.count === 1 ? 'one' : 'other'}`;

    return this.translate(key, { '%count%': diff.count });
  }
}
