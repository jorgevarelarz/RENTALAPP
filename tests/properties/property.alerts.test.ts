import request from "supertest";
import { app } from "../../src/app";
import { AlertSubscription } from "../../src/models/alertSubscription.model";
import { connectDb, disconnectDb, clearDb } from "../utils/db";

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
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("triggers price alert on update", async () => {
    await request(app)
      .put(`/api/properties/${pid}`)
      .set("x-user-id", "507f1f77bcf86cd799439011")
      .set("x-user-role", "landlord")
      .send({ price: 650 })
      .expect(200);

    const priceAlertLogged = logSpy.mock.calls.some(([msg]) =>
      typeof msg === "string" &&
      msg.includes("Aviso: cambio de precio en propiedad") &&
      msg.includes("507f1f77bcf86cd799439099"),
    );

    expect(priceAlertLogged).toBe(true);
  });

  it("triggers availability alert on update", async () => {
    await request(app)
      .put(`/api/properties/${pid}`)
      .set("x-user-id", "507f1f77bcf86cd799439011")
      .set("x-user-role", "landlord")
      .send({ availableFrom: "2025-12-15", availableTo: "2026-01-10" })
      .expect(200);

    const availabilityAlertLogged = logSpy.mock.calls.some(([msg]) =>
      typeof msg === "string" &&
      msg.includes("Aviso: cambio de disponibilidad") &&
      msg.includes("507f1f77bcf86cd799439098"),
    );

    expect(availabilityAlertLogged).toBe(true);
  });
});
