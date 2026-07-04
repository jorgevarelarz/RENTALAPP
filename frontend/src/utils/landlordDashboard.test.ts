import { describe, expect, it } from 'vitest';
import { buildLandlordAlerts, estimateMonthlyRent, propertyPhotoCount } from './landlordDashboard';

describe('landlordDashboard utils', () => {
  it('counts photos from both known property fields', () => {
    expect(propertyPhotoCount({ images: ['a'], photos: ['a', 'b', 'c'] })).toBe(3);
    expect(propertyPhotoCount({ images: ['a', 'b'], photos: [] })).toBe(2);
  });

  it('estimates monthly rent from size and city', () => {
    expect(estimateMonthlyRent({ sizeM2: 50, city: 'Madrid' })).toBe(1100);
    expect(estimateMonthlyRent({ sizeM2: 50, city: 'Unknown' })).toBe(700);
    expect(estimateMonthlyRent({ city: 'Madrid' })).toBeNull();
  });

  it('builds operational landlord alerts', () => {
    const alerts = buildLandlordAlerts([
      { _id: 'p1', status: 'draft', images: ['a'], price: 1500, sizeM2: 50, city: 'Madrid' },
      { _id: 'p2', status: 'active', images: ['a', 'b', 'c'], price: 600, sizeM2: 80, city: 'Valencia' },
    ]);

    expect(alerts.map((alert) => alert.id)).toContain('missing-photos');
    expect(alerts.map((alert) => alert.id)).toContain('drafts');
    expect(alerts.map((alert) => alert.id)).toContain('vacant-active');
    expect(alerts.map((alert) => alert.id)).toContain('price-outliers');
  });
});
