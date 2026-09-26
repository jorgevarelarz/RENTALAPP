import {
  buildAdjustments,
  totalFactor,
  trimmedMean,
} from '../../src/services/rentSuggestion.service';

describe('trimmedMean', () => {
  it('averages a small sample as-is', () => {
    expect(trimmedMean([10, 12, 14])).toBeCloseTo(12);
  });

  it('returns 0 for an empty sample', () => {
    expect(trimmedMean([])).toBe(0);
  });

  it('discards the extremes once the sample is large enough', () => {
    const withOutlier = [10, 10, 10, 10, 10, 10, 10, 10, 10, 900];
    const plain = withOutlier.reduce((a, b) => a + b, 0) / withOutlier.length;
    expect(plain).toBeGreaterThan(90);
    expect(trimmedMean(withOutlier)).toBeCloseTo(10);
  });
});

describe('buildAdjustments', () => {
  const base = { region: 'galicia', city: 'A Coruña', sizeM2: 80 };

  it('adds nothing for a plain home in good condition', () => {
    expect(buildAdjustments({ ...base, condition: 'buen_estado' })).toEqual([]);
  });

  it('rewards a refurbished, furnished home', () => {
    const adjustments = buildAdjustments({ ...base, condition: 'reformado', furnished: true });
    expect(adjustments.map(a => a.key)).toEqual(['condition', 'furnished']);
    expect(totalFactor(adjustments)).toBeCloseTo(1.05 * 1.05);
  });

  it('penalises a high floor without a lift', () => {
    const adjustments = buildAdjustments({ ...base, floor: 4, hasElevator: false });
    expect(adjustments).toEqual([
      { key: 'elevator', label: 'Planta alta sin ascensor', factor: 0.94 },
    ]);
  });

  it('treats an unknown lift as neutral rather than penalising it', () => {
    expect(buildAdjustments({ ...base, floor: 4 })).toEqual([]);
  });

  it('keeps the ground floor rule ahead of the lift rules', () => {
    const adjustments = buildAdjustments({ ...base, floor: 0, hasElevator: true });
    expect(adjustments.map(a => a.key)).toEqual(['floor']);
  });
});

describe('totalFactor', () => {
  it('is neutral without adjustments', () => {
    expect(totalFactor([])).toBe(1);
  });

  it('clamps a runaway stack of positive adjustments', () => {
    const adjustments = Array.from({ length: 8 }, (_, i) => ({
      key: `k${i}`,
      label: `l${i}`,
      factor: 1.1,
    }));
    expect(totalFactor(adjustments)).toBe(1.25);
  });

  it('clamps a runaway stack of negative adjustments', () => {
    const adjustments = Array.from({ length: 8 }, (_, i) => ({
      key: `k${i}`,
      label: `l${i}`,
      factor: 0.8,
    }));
    expect(totalFactor(adjustments)).toBe(0.75);
  });
});
