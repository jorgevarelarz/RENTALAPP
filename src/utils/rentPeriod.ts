/**
 * Periodos de renta («YYYY-MM») en hora de España. Un contrato que empieza el
 * 1 de noviembre a las 00:00 de Madrid se guarda como 31 de octubre en UTC; con
 * la zona del servidor su primer recibo caería en octubre.
 */
const RENT_TIME_ZONE = 'Europe/Madrid';

const periodFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: RENT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
});

export const rentPeriodOf = (date: Date): string => {
  const parts = periodFormatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return `${year}-${month}`;
};

export const isValidRentPeriod = (period: string): boolean => {
  if (!/^\d{4}-\d{2}$/.test(period)) return false;
  const month = Number(period.slice(5));
  return month >= 1 && month <= 12;
};

export type RentPeriodError = 'period_before_start' | 'period_in_future';

/**
 * Un recibo solo puede ser de un mes desde el inicio del contrato hasta el mes
 * en curso. No se corta en `endDate`: con la prórroga de la LAU el contrato
 * sigue vigente mientras esté activo.
 */
export const checkRentPeriod = (
  contract: { startDate?: Date | null },
  period: string,
  now: Date = new Date(),
): RentPeriodError | null => {
  if (contract.startDate && period < rentPeriodOf(new Date(contract.startDate))) {
    return 'period_before_start';
  }
  if (period > rentPeriodOf(now)) return 'period_in_future';
  return null;
};

/** Renta cobrable: número positivo y finito; si no, no se genera recibo. */
export const billableRent = (contract: { rent?: unknown }): number | null => {
  const rent = Number(contract.rent);
  return Number.isFinite(rent) && rent > 0 ? Math.round(rent * 100) / 100 : null;
};
