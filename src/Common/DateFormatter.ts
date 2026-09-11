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
  DATE_RELATIVE_AUTO_LIMIT_SECONDS,
  DateInput,
  dateParse,
  dateRelativeDiff
} from '../Helper/Date';

// A format name shared with the PHP side, or an explicit option bag for a shape
// the named formats do not cover.
export type DateFormat = string | Intl.DateTimeFormatOptions;

export type DateTranslate = (
  key: string,
  parameters: Record<string, string | number>
) => string;

export type DateResolveLocale = () => string;

export const DATE_RELATIVE_KEY_NOW = 'date.relative.now';
export const DATE_RELATIVE_KEY_PREFIX = 'date.relative.';

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
  [DATE_DISPLAY_MONTH_YEAR]: { year: 'numeric', month: 'long' }
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
  ) {
  }

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

      format = distance < DATE_RELATIVE_AUTO_LIMIT_SECONDS
        ? DATE_DISPLAY_RELATIVE
        : DATE_DISPLAY_DATE;
    }

    if (format === DATE_DISPLAY_RELATIVE) {
      return this.formatRelative(date, reference);
    }

    return this.formatAbsolute(date, format, locale);
  }

  formatAbsolute(date: Date, format: DateFormat, locale?: string): string {
    const options = typeof format === 'string'
      ? INTL_OPTIONS[format]
      : format;

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

    const key = DATE_RELATIVE_KEY_PREFIX
      + (diff.past ? 'past' : 'future')
      + `.${diff.unit}_${diff.count === 1 ? 'one' : 'other'}`;

    return this.translate(key, { '%count%': diff.count });
  }
}
