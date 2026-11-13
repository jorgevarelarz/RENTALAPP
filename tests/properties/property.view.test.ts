import request from "supertest";
import { app } from "../../src/app";
import { connectDb, disconnectDb, clearDb } from "../utils/db";
import { sessionToken } from "../utils/sessionToken";
import { Property } from "../../src/models/property.model";

const OWNER = "507f1f77bcf86cd799439061";
const AGENCY = "507f1f77bcf86cd799439062";
const TENANT = "507f1f77bcf86cd799439063";

const auth = async (id: string, role: string) => `Bearer ${await sessionToken({ _id: id, role, isVerified: true })}`;

const makeProperty = (status: "active" | "draft" | "archived", title = "Piso en Malasaña") =>
  Property.create({
    owner: OWNER,
    agencyId: AGENCY,
    refAgencyId: AGENCY,
    agencyAccess: "manage",
    title,
    address: "C/ Pez 3",
    region: "madrid",
    city: "Madrid",
    location: { type: "Point", coordinates: [-3.705, 40.424] },
    price: 1200,
    deposit: 1200,
    sizeM2: 60,
    rooms: 2,
    bathrooms: 1,
    availableFrom: new Date("2026-11-01"),
    images: ["/uploads/a.jpg"],
    status,
    history: [{ ts: new Date(), actorId: OWNER, action: "created", payload: { note: "interno" } }],
  });

describe("Ficha pública del anuncio", () => {
  beforeAll(connectDb);
  afterEach(clearDb);
  afterAll(disconnectDb);

  it("quien no gestiona el anuncio no ve el propietario, la agencia ni el historial", async () => {
    const p = await makeProperty("active");
    const anon = await request(app).get(`/api/properties/${p._id}`).expect(200);
    for (const field of ["owner", "agencyId", "refAgencyId", "agencyAccess", "history"]) {
      expect(anon.body).not.toHaveProperty(field);
    }
    expect(anon.body).toMatchObject({ title: "Piso en Malasaña", price: 1200, _mine: false });
    expect(anon.body).not.toHaveProperty("_liked");

    const list = await request(app).get("/api/properties").expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).not.toHaveProperty("owner");
    expect(list.body.items[0]).not.toHaveProperty("history");

    const own = await request(app).get(`/api/properties/${p._id}`).set("Authorization", await auth(OWNER, "landlord")).expect(200);
    expect(own.body).toMatchObject({ owner: OWNER, agencyAccess: "manage", _mine: true });
    const agency = await request(app).get(`/api/properties/${p._id}`).set("Authorization", await auth(AGENCY, "agency")).expect(200);
    expect(agency.body._mine).toBe(true);
  });

  it("dice al inquilino si lo ha guardado y si ya lo ha solicitado", async () => {
    const p = await makeProperty("active");
    const tenant = await auth(TENANT, "tenant");
    let res = await request(app).get(`/api/properties/${p._id}`).set("Authorization", tenant).expect(200);
    expect(res.body._liked).toBe(false);
    expect(res.body._application).toBeUndefined();

    await request(app).post(`/api/properties/${p._id}/favorite`).set("Authorization", tenant).expect(200);
    await request(app).post(`/api/properties/${p._id}/apply`).set("Authorization", tenant).expect(200);

    res = await request(app).get(`/api/properties/${p._id}`).set("Authorization", tenant).expect(200);
    expect(res.body._liked).toBe(true);
    expect(res.body._application).toMatchObject({ status: "pending" });
    expect(res.body._application).not.toHaveProperty("tenantId");
  });

  it("un id mal formado da 404 y un borrador ajeno no admite solicitudes ni visitas", async () => {
    await request(app).get("/api/properties/no-es-un-id").expect(404);
    await request(app).post("/api/properties/no-es-un-id/view").expect(404);

    const draft = await makeProperty("draft", "Borrador");
    const archived = await makeProperty("archived", "Retirado");
    const tenant = await auth(TENANT, "tenant");
    await request(app).get(`/api/properties/${draft._id}`).set("Authorization", tenant).expect(404);
    await request(app).post(`/api/properties/${draft._id}/apply`).set("Authorization", tenant).expect(404);
    await request(app).post(`/api/properties/${archived._id}/apply`).set("Authorization", tenant).expect(404);
    await request(app).post("/api/properties/no-es-un-id/apply").set("Authorization", tenant).expect(404);

    await request(app).post(`/api/properties/${draft._id}/view`).expect(404);
    expect((await Property.findById(draft._id).lean())?.viewsCount).toBe(0);

    const active = await makeProperty("active");
    await request(app).post(`/api/properties/${active._id}/view`).expect(200);
    expect((await Property.findById(active._id).lean())?.viewsCount).toBe(1);
  });
});
