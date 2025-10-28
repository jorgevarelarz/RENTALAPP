import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { AlertSubscription } from '../../src/models/alertSubscription.model';
import { User } from '../../src/models/user.model';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import logger from '../../src/utils/logger';

describe("Property alerts", () => {
  let pid: string;
  let logSpy: jest.SpyInstance;

  beforeAll(async () => {
    await connectDb();
    const res = await request(app).post("/api/properties").send({
      owner: "507f1f77bcf86cd799439011",
      title: "Piso alertas test",
      address: "C/ Falsa 123",
      region: "galicia",
      city: "A Coruña",
      location: { lng: -8.4, lat: 43.36 },
      price: 700,
      deposit: 700,
      sizeM2: 60,
      rooms: 2,
      bathrooms: 1,
      furnished: false,
      petsAllowed: true,
      availableFrom: "2025-11-01",
      images: ["https://cdn/x1.jpg", "https://cdn/x2.jpg", "https://cdn/x3.jpg"],
    });
    pid = res.body._id;
    await User.create({
      _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439099"),
      name: "Precio Alerts",
      email: "alerts-price@example.com",
      passwordHash: "hashed",
      role: "tenant",
    } as any);
    await User.create({
      _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439098"),
      name: "Disponibilidad Alerts",
      email: "alerts-availability@example.com",
      passwordHash: "hashed",
      role: "tenant",
    } as any);

    await AlertSubscription.create({
      userId: "507f1f77bcf86cd799439099",
      propertyId: pid,
      type: "price",
    });
    await AlertSubscription.create({
      userId: "507f1f77bcf86cd799439098",
      propertyId: pid,
      type: "availability",
    });
  });

  afterAll(async () => {
    await clearDb();
    await disconnectDb();
  });

  beforeEach(() => {
    logSpy = jest.spyOn(logger, 'info').mockImplementation(() => logger);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("triggers price alert on update", async () => {
    await request(app).put(`/api/properties/${pid}`).send({ price: 650 }).expect(200);

    const priceAlertLogged = logSpy.mock.calls.some(([payload]) =>
      typeof payload === 'object' &&
      payload?.to === 'alerts-price@example.com' &&
      payload?.subject?.includes('Aviso: cambio de precio en propiedad'),
    );

    expect(priceAlertLogged).toBe(true);
  });

  it("triggers availability alert on update", async () => {
    await request(app)
      .put(`/api/properties/${pid}`)
      .send({ availableFrom: "2025-12-15", availableTo: "2026-01-10" })
      .expect(200);

    const availabilityAlertLogged = logSpy.mock.calls.some(([payload]) =>
      typeof payload === 'object' &&
      payload?.to === 'alerts-availability@example.com' &&
      payload?.subject?.includes('Aviso: cambio de disponibilidad'),
    );

    expect(availabilityAlertLogged).toBe(true);
  });
});
