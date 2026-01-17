type DateRangeInput = {
  dateFrom?: string | Date;
  dateTo?: string | Date;
};

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

function toDate(value?: string | Date, endOfDayIfDateOnly = false): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  if (endOfDayIfDateOnly && dateOnlyPattern.test(raw)) {
    parsed.setHours(23, 59, 59, 999);
  }
  return parsed;
}

export function parseDateRange(input: DateRangeInput) {
  const from = toDate(input.dateFrom);
  const to = toDate(input.dateTo, true);
  if ((input.dateFrom && !from) || (input.dateTo && !to)) {
    return { error: 'invalid_date' as const };
  }
  if (from && to && from > to) {
    return { error: 'date_range_inverted' as const };
  }
  return { from, to } as const;
}
