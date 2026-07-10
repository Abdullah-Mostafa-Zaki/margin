import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const CAIRO_TIMEZONE = "Africa/Cairo";

/**
 * Returns the current date and time in the Africa/Cairo timezone.
 * Useful for logging or comparing current boundaries safely.
 */
export function getCairoNow(): Date {
  return toZonedTime(new Date(), CAIRO_TIMEZONE);
}

/**
 * Returns the UTC Date representing 00:00:00.000 in Cairo time for the given date.
 * Ensures boundary queries (gte) correctly start at Cairo midnight.
 */
export function startOfCairoDay(date: Date): Date {
  const zoned = toZonedTime(date, CAIRO_TIMEZONE);
  const start = startOfDay(zoned);
  return fromZonedTime(start, CAIRO_TIMEZONE);
}

/**
 * Returns the UTC Date representing 23:59:59.999 in Cairo time for the given date.
 * Ensures boundary queries (lte) correctly end at Cairo's last millisecond.
 */
export function endOfCairoDay(date: Date): Date {
  const zoned = toZonedTime(date, CAIRO_TIMEZONE);
  const end = endOfDay(zoned);
  return fromZonedTime(end, CAIRO_TIMEZONE);
}

/**
 * Returns the UTC Date representing the start of the week in Cairo time.
 * Note: date-fns defaults to Sunday as the start of the week.
 */
export function startOfCairoWeek(date: Date): Date {
  const zoned = toZonedTime(date, CAIRO_TIMEZONE);
  const start = startOfWeek(zoned);
  return fromZonedTime(start, CAIRO_TIMEZONE);
}

/**
 * Returns the UTC Date representing the end of the week in Cairo time.
 */
export function endOfCairoWeek(date: Date): Date {
  const zoned = toZonedTime(date, CAIRO_TIMEZONE);
  const end = endOfWeek(zoned);
  return fromZonedTime(end, CAIRO_TIMEZONE);
}

/**
 * Returns the UTC Date representing the start of the month in Cairo time.
 */
export function startOfCairoMonth(date: Date): Date {
  const zoned = toZonedTime(date, CAIRO_TIMEZONE);
  const start = startOfMonth(zoned);
  return fromZonedTime(start, CAIRO_TIMEZONE);
}

/**
 * Returns the UTC Date representing the end of the month in Cairo time.
 */
export function endOfCairoMonth(date: Date): Date {
  const zoned = toZonedTime(date, CAIRO_TIMEZONE);
  const end = endOfMonth(zoned);
  return fromZonedTime(end, CAIRO_TIMEZONE);
}

/**
 * Formats a given Date object for display by first converting it to Cairo time.
 * Prevents UI layout shifts where users in different timezones see different dates.
 * 
 * @param date The Date object to format
 * @param formatString The date-fns format string (e.g., "MMM d, yyyy")
 */
export function formatCairoDate(date: Date, formatString: string): string {
  const zoned = toZonedTime(date, CAIRO_TIMEZONE);
  return format(zoned, formatString);
}

// ------------------------------------------------------------------
// Existing code
// ------------------------------------------------------------------

export function getDateRangeFromParams(searchParams: {
  range?: string;
  from?: string;
  to?: string;
}): { startDate: Date | null; endDate: Date | null } {
  const now = new Date();

  if (searchParams.range === '7d') {
    return {
      startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      endDate: now
    };
  }
  if (searchParams.range === '30d') {
    return {
      startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endDate: now
    };
  }
  if (searchParams.range === '365d') {
    return {
      startDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      endDate: now
    };
  }
  if (searchParams.from && searchParams.to) {
    return {
      startDate: new Date(searchParams.from),
      endDate: new Date(searchParams.to)
    };
  }

  // All time — no filter
  return { startDate: null, endDate: null };
}
