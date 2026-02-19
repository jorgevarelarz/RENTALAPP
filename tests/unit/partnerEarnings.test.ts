import { calcPartnerShareCents, clampPct, getAgencySharePctFromEnv, parsePositiveInt } from '../../src/utils/partnerEarnings';

describe('partnerEarnings utils', () => {
  test('parsePositiveInt', () => {
    expect(parsePositiveInt('10')).toBe(10);
    expect(parsePositiveInt(10)).toBe(10);
    expect(parsePositiveInt('10.9')).toBe(10);
    expect(parsePositiveInt(0)).toBeUndefined();
    expect(parsePositiveInt(-1)).toBeUndefined();
    expect(parsePositiveInt('abc')).toBeUndefined();
  });

  test('clampPct', () => {
    expect(clampPct('20', 99)).toBe(20);
    expect(clampPct(20.9, 99)).toBe(20);
    expect(clampPct(-1, 99)).toBe(0);
    expect(clampPct(1000, 99)).toBe(100);
    expect(clampPct('nope', 99)).toBe(99);
  });

  test('getAgencySharePctFromEnv defaults to 20', () => {
    expect(getAgencySharePctFromEnv({} as any)).toBe(20);
    expect(getAgencySharePctFromEnv({ AGENCY_RENT_FEE_SHARE_PCT: '15' } as any)).toBe(15);
  });

  test('calcPartnerShareCents floors', () => {
    expect(calcPartnerShareCents(199, 20)).toBe(39);
    expect(calcPartnerShareCents(0, 20)).toBe(0);
    expect(calcPartnerShareCents(100, 0)).toBe(0);
  });
});

