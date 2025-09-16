import request from "supertest";
import { app } from "../../src/app";
import { connectDb, disconnectDb, clearDb } from "../utils/db";

describe("Properties (minimal)", () => {
  const ownerId = "507f1f77bcf86cd799439011";
  let pid: string;

  beforeAll(connectDb);

  afterAll(async () => {
    await clearDb();
    await disconnectDb();
  });

  it("create draft", async () => {
    const payload = {
      owner: ownerId,
      title: "Piso céntrico",
      address: "C/ Mayor 1",
      region: "galicia",
      city: "A Coruña",
      location: { lng: -8.409, lat: 43.362 },
      price: 850,
      deposit: 850,
      sizeM2: 72,
      rooms: 2,
      bathrooms: 1,
      furnished: true,
      petsAllowed: false,
      availableFrom: "2025-10-01",
      images: ["https://cdn/x1.jpg", "https://cdn/x2.jpg", "https://cdn/x3.jpg"],
    };
    const res = await request(app)
      .post("/api/properties")
      .set("x-user-id", ownerId)
      .set("x-user-role", "landlord")
      .set("x-user-verified", "true")
      .send(payload)
      .expect(201);
    pid = res.body._id;
    expect(res.body.status).toBe("draft");
  });

  it("publish -> active", async () => {
    const res = await request(app)
      .post(`/api/properties/${pid}/publish`)
      .set("x-user-id", ownerId)
      .set("x-user-role", "landlord")
      .set("x-user-verified", "true")
      .send()
      .expect(200);
    expect(res.body.status).toBe("active");
  });

  it("publish bloqueado si no verificado", async () => {
    const payload = {
      owner: ownerId,
      title: "Piso sin verificar",
      address: "C/ Secundaria 2",
      region: "galicia",
      city: "A Coruña",
      location: { lng: -8.409, lat: 43.362 },
      price: 750,
      deposit: 750,
      sizeM2: 60,
      rooms: 2,
      bathrooms: 1,
      furnished: true,
      petsAllowed: false,
      availableFrom: "2025-11-01",
      images: ["https://cdn/y1.jpg", "https://cdn/y2.jpg", "https://cdn/y3.jpg"],
    };
    const created = await request(app)
      .post("/api/properties")
      .set("x-user-id", ownerId)
      .set("x-user-role", "landlord")
      .set("x-user-verified", "true")
      .send(payload)
      .expect(201);

    const res = await request(app)
      .post(`/api/properties/${created.body._id}/publish`)
      .set("x-user-id", ownerId)
      .set("x-user-role", "landlord")
      .set("x-user-verified", "false")
      .send()
      .expect(403);
    expect(res.body.error).toBe("owner_not_verified");
  });

  it("search by price & geo", async () => {
    const res = await request(app)
      .get("/api/properties?priceMax=900&nearLng=-8.41&nearLat=43.36&maxKm=5")
      .expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it("favorite/unfavorite", async () => {
    await request(app).post(`/api/properties/${pid}/favorite`).send().expect(200);
    await request(app).delete(`/api/properties/${pid}/favorite`).send().expect(200);
  });
});
