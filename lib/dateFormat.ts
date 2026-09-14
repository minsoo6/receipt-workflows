const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Longest-first so YYYY wins over YY and MMMM over MM; one pass so replacements
// can't match inside already-substituted output (e.g. the "M" in "March").
const TOKEN_PATTERN = /YYYY|YY|MMMM|MMM|MM|M|DD|D/g;

export const DATE_FORMAT_PRESETS = ['YYYYMMDD', 'YYYY-MM-DD', 'MM-DD-YYYY', 'D MMM YYYY'];

/**
 * Formats an ISO `YYYY-MM-DD` string using the given token pattern.
 * Returns the input unchanged if it isn't a well-formed ISO date.
 */
export function formatDate(isoDate: string, format: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;

  // Parsed from the string rather than via `new Date(isoDate)`, which treats a
  // bare date as UTC midnight and can render as the previous day west of UTC.
  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) return isoDate;

  return format.replace(TOKEN_PATTERN, (token) => {
    switch (token) {
      case 'YYYY': return year;
      case 'YY': return year.slice(2);
      case 'MMMM': return MONTHS_LONG[monthIndex];
      case 'MMM': return MONTHS_SHORT[monthIndex];
      case 'MM': return month;
      case 'M': return String(Number(month));
      case 'DD': return day;
      case 'D': return String(Number(day));
      default: return token;
    }
  });
}
