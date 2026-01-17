import { Types } from 'mongoose';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Contract } from '../../src/models/contract.model';
import { Property } from '../../src/models/property.model';
import { ComplianceStatus } from '../../src/modules/rentalPublic/models/complianceStatus.model';
import { RentalPriceHistory } from '../../src/modules/rentalPublic/models/rentalPriceHistory.model';
import { TensionedArea } from '../../src/modules/rentalPublic/models/tensionedArea.model';
import {
  evaluateAndPersist,
  ComplianceReasonCode,
  ComplianceStatusValue,
  buildAreaKey,
} from '../../src/modules/rentalPublic';

describe('RentalPublic compliance', () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  beforeEach(clearDb);

  it('marks risk and is idempotent for tensioned area rent increase', async () => {
    const now = new Date();
    const ownerId = new Types.ObjectId();
    const landlordId = new Types.ObjectId();
    const tenantId = new Types.ObjectId();

    const property = await Property.create({
      owner: ownerId,
      title: 'Test Property',
      address: 'Calle Falsa 123',
      region: 'galicia',
      city: 'oleiros',
      location: { type: 'Point', coordinates: [-8.3, 43.3] },
      price: 900,
      deposit: 900,
      availableFrom: now,
      status: 'active',
    });

    await TensionedArea.create({
      region: 'galicia',
      city: 'oleiros',
      areaKey: buildAreaKey('galicia', 'oleiros', ''),
      source: 'test',
      effectiveFrom: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      active: true,
    });

    await RentalPriceHistory.create({
      property: property._id,
      previousRent: 800,
      newRent: 900,
      changeDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      reason: 'seed',
      source: 'test',
    });

    const contract = await Contract.create({
      landlord: landlordId,
      tenant: tenantId,
      property: property._id,
      rent: 1000,
      deposit: 1000,
      startDate: now,
      endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      region: 'galicia',
      status: 'draft',
    });

    await evaluateAndPersist(String(contract._id), { changeDate: contract.startDate });

    const compliance = await ComplianceStatus.findOne({ contract: contract._id }).lean();
    expect(compliance).toBeTruthy();
    expect(compliance?.status).toBe(ComplianceStatusValue.Risk);
    expect(compliance?.reasons).toContain(ComplianceReasonCode.RentIncreaseTensionedArea);
    expect(compliance?.isTensionedArea).toBe(true);

    let histories = await RentalPriceHistory.find({ contract: contract._id }).lean();
    expect(histories).toHaveLength(1);

    await evaluateAndPersist(String(contract._id), { changeDate: contract.startDate });
    histories = await RentalPriceHistory.find({ contract: contract._id }).lean();
    expect(histories).toHaveLength(1);
  });

  it('uses geo geometry for tensioned areas when available', async () => {
    const now = new Date();
    const ownerId = new Types.ObjectId();
    const landlordId = new Types.ObjectId();
    const tenantId = new Types.ObjectId();

    const property = await Property.create({
      owner: ownerId,
      title: 'Geo Property',
      address: 'Calle Geo 1',
      region: 'galicia',
      city: 'oleiros',
      location: { type: 'Point', coordinates: [-8.3, 43.3] },
      price: 900,
      deposit: 900,
      availableFrom: now,
      status: 'active',
    });

    const tensioned = await TensionedArea.create({
      region: 'madrid',
      city: 'madrid',
      areaKey: buildAreaKey('madrid', 'madrid', ''),
      source: 'geo-test',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-8.4, 43.2],
            [-8.2, 43.2],
            [-8.2, 43.4],
            [-8.4, 43.4],
            [-8.4, 43.2],
          ],
        ],
      },
      effectiveFrom: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      active: true,
    });

    const contract = await Contract.create({
      landlord: landlordId,
      tenant: tenantId,
      property: property._id,
      rent: 1100,
      deposit: 1100,
      startDate: now,
      endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      region: 'galicia',
      status: 'draft',
    });

    await evaluateAndPersist(String(contract._id), { changeDate: contract.startDate });

    const compliance = await ComplianceStatus.findOne({ contract: contract._id }).lean();
    expect(compliance).toBeTruthy();
    expect(compliance?.status).toBe(ComplianceStatusValue.Risk);
    expect(compliance?.isTensionedArea).toBe(true);
    expect(compliance?.meta?.areaKey).toBe(tensioned.areaKey);
  });
});
