import request from 'supertest';

import { app } from '../../src/app';
import { Property } from '../../src/models/property.model';
import { ZoneRentReference } from '../../src/modules/rentalPublic/models/zoneRentReference.model';
import { TensionedArea } from '../../src/modules/rentalPublic/models/tensionedArea.model';
import { connectDb, disconnectDb, clearDb } from '../utils/db';

const CORUNA = { lng: -8.4, lat: 43.36 };

async function seedListings(count: number, pricePerM2: number) {
  const docs = Array.from({ length: count }, (_, i) => ({
    owner: '507f1f77bcf86cd799439011',
    title: `Piso comparable ${i}`,
    address: `C/ Comparable ${i}`,
    region: 'galicia',
    city: 'A Coruña',
    location: { type: 'Point', coordinates: [CORUNA.lng, CORUNA.lat] },
    price: pricePerM2 * 70,
    deposit: 700,
    sizeM2: 70,
    rooms: 2,
    bathrooms: 1,
    availableFrom: new Date('2025-11-01'),
    status: 'active',
  }));
  await Property.insertMany(docs);
}

function ask(body: Record<string, unknown>) {
  return request(app)
    .post('/api/properties/price-suggestion')
    .send({ region: 'galicia', city: 'A Coruña', sizeM2: 80, location: CORUNA, ...body });
}

describe('POST /api/properties/price-suggestion', () => {
  beforeAll(async () => {
    await connectDb();
  });

  afterEach(async () => {
    await clearDb();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('returns no suggestion when there is neither market data nor an official index', async () => {
    const res = await ask({});
    expect(res.status).toBe(200);
    expect(res.body.suggestion).toBeNull();
    expect(res.body.reason).toBe('not_enough_data');
  });

  it('falls back to the official index while the marketplace is empty', async () => {
    await ZoneRentReference.create({
      region: 'galicia',
      city: 'a coruña',
      pricePerM2: 10,
      source: 'indice-estatal',
      period: '2025',
      effectiveFrom: new Date('2025-01-01'),
    });

    const res = await ask({ condition: 'buen_estado' });

    expect(res.status).toBe(200);
    expect(res.body.suggestion.basis.source).toBe('official_reference');
    expect(res.body.suggestion.basis.reference.source).toBe('indice-estatal');
    // 10 €/m² * 80 m², no adjustments
    expect(res.body.suggestion.suggested).toBe(800);
  });

  it('prefers our own listings once there are enough comparables', async () => {
    await ZoneRentReference.create({
      region: 'galicia',
      city: 'a coruña',
      pricePerM2: 10,
      source: 'indice-estatal',
      effectiveFrom: new Date('2025-01-01'),
    });
    await seedListings(6, 12);

    const res = await ask({});

    expect(res.body.suggestion.basis.source).toBe('own_listings');
    expect(res.body.suggestion.basis.sampleSize).toBe(6);
    expect(res.body.suggestion.suggested).toBe(960); // 12 €/m² * 80
  });

  it('applies the condition and furnishing adjustments to the zone price', async () => {
    await seedListings(6, 10);

    const res = await ask({ condition: 'a_reformar', furnished: false });

    // 10 €/m² * 0.88 * 80 m²
    expect(res.body.suggestion.suggested).toBe(700);
    expect(res.body.suggestion.adjustments).toEqual([
      { key: 'condition', label: 'A reformar', factor: 0.88 },
    ]);
  });

  it('never suggests above the cap of a tensioned area, range included', async () => {
    await seedListings(6, 20);
    await TensionedArea.create({
      region: 'galicia',
      city: 'A Coruña',
      source: 'test',
      maxRent: 900,
      effectiveFrom: new Date('2025-01-01'),
      active: true,
    });

    const res = await ask({});

    expect(res.body.suggestion.cap).toMatchObject({ maxRent: 900, applied: true });
    expect(res.body.suggestion.suggested).toBe(900);
    expect(res.body.suggestion.range.max).toBeLessThanOrEqual(900);
  });

  it('rejects a request without a usable size', async () => {
    const res = await ask({ sizeM2: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('size_required');
  });
});
