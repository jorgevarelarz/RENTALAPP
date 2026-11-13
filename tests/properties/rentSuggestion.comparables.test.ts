import mongoose from 'mongoose';
import { Property } from '../../src/models/property.model';
import { MAX_OWN_COMPARABLES, suggestRent } from '../../src/services/rentSuggestion.service';
import { connectDb, disconnectDb, clearDb } from '../utils/db';

beforeAll(connectDb);
afterAll(disconnectDb);
afterEach(clearDb);

const listing = (pricePerM2: number, updatedAt: Date) => ({
  owner: new mongoose.Types.ObjectId(),
  title: 'Piso',
  address: 'Calle Mayor 1',
  region: 'madrid',
  city: 'Madrid',
  location: { type: 'Point', coordinates: [-3.7, 40.4] },
  price: pricePerM2 * 50,
  deposit: pricePerM2 * 50,
  sizeM2: 50,
  availableFrom: new Date(),
  status: 'active',
  createdAt: updatedAt,
  updatedAt,
});

it('uses only the most recent listings of a big city as comparables', async () => {
  const day = 24 * 60 * 60 * 1000;
  const recent = Array.from({ length: MAX_OWN_COMPARABLES }, (_, i) => listing(20, new Date(Date.now() - i * 1000)));
  const stale = Array.from({ length: 40 }, () => listing(10, new Date(Date.now() - 400 * day)));
  await Property.collection.insertMany([...stale, ...recent]);

  const suggestion = await suggestRent({ region: 'madrid', city: 'madrid', sizeM2: 100 });

  expect(suggestion?.basis).toMatchObject({ source: 'own_listings', scope: 'city', sampleSize: MAX_OWN_COMPARABLES });
  expect(suggestion?.basePricePerM2).toBe(20);
  expect(suggestion?.suggested).toBe(2000);
});
