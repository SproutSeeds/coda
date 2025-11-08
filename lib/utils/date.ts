const DAY_ONLY_DATE = /^\d{4}-\d{2}-\d{2}$/;

function createLocalDateFromDayString(value: string): Date | null {
  if (!DAY_ONLY_DATE.test(value)) {
    return null;
  }

  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export function parseUsageDate(value: string | Date): Date | null {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const localDate = createLocalDateFromDayString(value);
  if (localDate) {
    return localDate;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const DEFAULT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
};

export function formatUsageDayLabel(
  value: string | Date,
  locale = "en-US",
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_FORMAT,
): string {
  const date = parseUsageDate(value);
  if (!date) {
    return typeof value === "string" ? value : "";
  }

  return new Intl.DateTimeFormat(locale, options).format(date);
}
