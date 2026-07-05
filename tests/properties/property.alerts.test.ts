import request from "supertest";

jest.mock("../../src/utils/email", () => ({
  ...jest.requireActual("../../src/utils/email"),
  sendPriceAlert: jest.fn().mockResolvedValue(undefined),
  sendAvailabilityAlert: jest.fn().mockResolvedValue(undefined),
}));

import { app } from "../../src/app";
import { AlertSubscription } from "../../src/models/alertSubscription.model";
import { sendPriceAlert, sendAvailabilityAlert } from "../../src/utils/email";
import { connectDb, disconnectDb, clearDb } from "../utils/db";

describe("Property alerts", () => {
  let pid: string;

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
    jest.clearAllMocks();
  });

  it("triggers price alert on update", async () => {
    await request(app)
      .put(`/api/properties/${pid}`)
      .set("x-user-id", "507f1f77bcf86cd799439011")
      .set("x-user-role", "landlord")
      .send({ price: 650 })
      .expect(200);

    const calls = (sendPriceAlert as jest.Mock).mock.calls;
    const priceAlertSent = calls.some(
      ([to, property]) => to === "507f1f77bcf86cd799439099" && property.price === 650,
    );

    expect(priceAlertSent).toBe(true);
  });

  it("triggers availability alert on update", async () => {
    await request(app)
      .put(`/api/properties/${pid}`)
      .set("x-user-id", "507f1f77bcf86cd799439011")
      .set("x-user-role", "landlord")
      .send({ availableFrom: "2025-12-15", availableTo: "2026-01-10" })
      .expect(200);

    const calls = (sendAvailabilityAlert as jest.Mock).mock.calls;
    const availabilityAlertSent = calls.some(([to]) => to === "507f1f77bcf86cd799439098");

    expect(availabilityAlertSent).toBe(true);
  });
});
