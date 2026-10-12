import request from "supertest";
import { app } from "../../src/app";
import { connectDb, disconnectDb, clearDb } from "../utils/db";
import { Property } from "../../src/models/property.model";

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

  it("blocks update by non-owner landlord", async () => {
    const otherOwner = "507f1f77bcf86cd799439012";
    await request(app)
      .put(`/api/properties/${pid}`)
      .set("x-user-id", otherOwner)
      .set("x-user-role", "landlord")
      .set("x-user-verified", "true")
      .send({ price: 999 })
      .expect(403);
  });

  it("owner can update property", async () => {
    const res = await request(app)
      .put(`/api/properties/${pid}`)
      .set("x-user-id", ownerId)
      .set("x-user-role", "landlord")
      .set("x-user-verified", "true")
      .send({ price: 900 })
      .expect(200);
    expect(res.body.price).toBe(900);
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

  it("search by city ignores case but needs the whole name", async () => {
    const ids = async (qs: string) =>
      (await request(app).get("/api/properties?" + qs).expect(200)).body.items.map((p: any) => p._id);
    expect(await ids("city=" + encodeURIComponent("a coruña"))).toContain(pid);
    expect(await ids("city=" + encodeURIComponent(" A CORUÑA "))).toContain(pid);
    expect(await ids("city=Coru")).toHaveLength(0);
    // Los caracteres de regex se buscan como texto
    expect(await ids("city=" + encodeURIComponent(".*"))).toHaveLength(0);
  });

  it("search by city and text ignores accents", async () => {
    const ids = async (qs: string) =>
      (await request(app).get("/api/properties?" + qs).expect(200)).body.items.map((p: any) => String(p._id));
    const base = {
      owner: ownerId, address: "C/ Mayor 1", location: { type: "Point", coordinates: [-4.7, 40.65] },
      price: 600, deposit: 600, sizeM2: 50, rooms: 1, bathrooms: 1,
      availableFrom: new Date("2025-10-01"), status: "active",
    };
    const avila = await Property.create({ ...base, title: "Piso en Ávila", region: "castilla-y-leon", city: "Ávila" });
    const hosp = await Property.create({ ...base, title: "Piso", region: "cataluna", city: "L’Hospitalet de Llobregat" });

    expect(await ids("city=" + encodeURIComponent("a coruna"))).toContain(pid);
    expect(await ids("city=" + encodeURIComponent("A CORUNA"))).toContain(pid);
    expect(await ids("city=avila")).toEqual([String(avila._id)]);
    expect(await ids("city=" + encodeURIComponent("ÁVILA"))).toContain(String(avila._id));
    expect(await ids("city=" + encodeURIComponent("àvila"))).toContain(String(avila._id));
    expect(await ids("city=" + encodeURIComponent("l'hospitalet de llobregat"))).toEqual([String(hosp._id)]);
    expect(await ids("q=coruna")).toContain(pid);
    expect(await ids("q=" + encodeURIComponent("piso en avila"))).toEqual([String(avila._id)]);
    // Sin tildes no significa parecido: otra vocal no vale
    expect(await ids("city=evila")).toHaveLength(0);
  });

  it("sorts by views for «Populares»", async () => {
    const other = await Property.create({
      owner: ownerId, title: "Piso visitado", address: "C/ Real 9", region: "galicia", city: "Lugo",
      location: { type: "Point", coordinates: [-7.55, 43.01] }, price: 700, deposit: 700, sizeM2: 50,
      rooms: 1, bathrooms: 1, availableFrom: new Date("2025-10-01"), status: "active", viewsCount: 50,
    });
    await Property.updateOne({ _id: pid }, { viewsCount: 5 });
    const res = await request(app).get("/api/properties?sort=viewsCount&dir=desc").expect(200);
    const order = res.body.items.map((p: any) => String(p._id));
    expect(order.indexOf(String(other._id))).toBeLessThan(order.indexOf(pid));
    const asc = await request(app).get("/api/properties?sort=viewsCount&dir=asc").expect(200);
    const ascOrder = asc.body.items.map((p: any) => String(p._id));
    expect(ascOrder.indexOf(pid)).toBeLessThan(ascOrder.indexOf(String(other._id)));
  });

  it("anonymous search never lists drafts and treats q as plain text", async () => {
    const draft = await request(app)
      .post("/api/properties")
      .set("x-user-id", ownerId)
      .set("x-user-role", "landlord")
      .set("x-user-verified", "true")
      .send({
        owner: ownerId, title: "Borrador oculto", address: "C/ Real 2",
        region: "galicia", city: "A Coruña", location: { lng: -8.409, lat: 43.362 },
        price: 800, deposit: 800, sizeM2: 60, rooms: 2, bathrooms: 1, furnished: false,
        petsAllowed: false, availableFrom: "2025-10-01",
        images: ["https://cdn/y1.jpg", "https://cdn/y2.jpg", "https://cdn/y3.jpg"],
      })
      .expect(201);
    const drafts = await request(app).get("/api/properties?status=draft").expect(200);
    expect(drafts.body.items).toHaveLength(0);
    await request(app).get(`/api/properties/${draft.body._id}`).expect(404);
    // Una regex patológica se busca como texto literal en vez de ejecutarse
    const res = await request(app).get("/api/properties?q=" + encodeURIComponent("^(a+)+$")).expect(200);
    expect(res.body.items).toHaveLength(0);
    await request(app).get("/api/properties?q=" + encodeURIComponent("[")).expect(200);
  });

  it("a stale or invalid token on public search is treated as anonymous", async () => {
    const res = await request(app)
      .get("/api/properties")
      .set("Authorization", "Bearer token-caducado")
      .expect(200);
    expect(res.body.items.every((p: any) => p.status === "active")).toBe(true);
  });

  it("favorite/unfavorite", async () => {
    await request(app).post(`/api/properties/${pid}/favorite`).send().expect(200);
    await request(app).delete(`/api/properties/${pid}/favorite`).send().expect(200);
  });
});
