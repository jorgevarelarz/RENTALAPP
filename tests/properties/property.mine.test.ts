import request from "supertest";
import { app } from "../../src/app";
import { connectDb, disconnectDb, clearDb } from "../utils/db";
import { sessionToken } from "../utils/sessionToken";
import { Property } from "../../src/models/property.model";
import { UserFavorite } from "../../src/models/userFavorite.model";

const OWNER = "507f1f77bcf86cd799439071";
const AGENCY = "507f1f77bcf86cd799439072";
const OTHER = "507f1f77bcf86cd799439073";
const TENANT = "507f1f77bcf86cd799439074";

const auth = async (id: string, role: string) => `Bearer ${await sessionToken({ _id: id, role, isVerified: true })}`;

const base = (owner: string, title: string, status: "active" | "draft" | "archived", extra: Record<string, unknown> = {}) => ({
  owner,
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
  status,
  history: [{ ts: new Date(), actorId: owner, action: "created" }],
  ...extra,
});

describe("Mis inmuebles y favoritos", () => {
  beforeAll(connectDb);
  afterEach(clearDb);
  afterAll(disconnectDb);

  it("GET /properties/mine da los del dueño aunque haya más de 50 anuncios ajenos, con borradores y paginado", async () => {
    await Property.insertMany(Array.from({ length: 60 }, (_, i) => base(OTHER, `Ajeno ${i}`, "active")));
    await Property.create(base(OWNER, "Mío publicado", "active"));
    await Property.create(base(OWNER, "Mío borrador", "draft"));
    await Property.create(base(OWNER, "Gestionado", "active", { agencyId: AGENCY, agencyAccess: "manage" }));

    const owner = await auth(OWNER, "landlord");
    const res = await request(app).get("/api/properties/mine").set("Authorization", owner).expect(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items.map((p: any) => p.title).sort()).toEqual(["Gestionado", "Mío borrador", "Mío publicado"]);
    expect(res.body.items[0]).toHaveProperty("owner", OWNER);

    const drafts = await request(app).get("/api/properties/mine?status=draft").set("Authorization", owner).expect(200);
    expect(drafts.body.items.map((p: any) => p.title)).toEqual(["Mío borrador"]);
    const page2 = await request(app).get("/api/properties/mine?limit=2&page=2").set("Authorization", owner).expect(200);
    expect(page2.body).toMatchObject({ page: 2, limit: 2, total: 3 });
    expect(page2.body.items).toHaveLength(1);
    await request(app).get("/api/properties/mine?status[$ne]=x").set("Authorization", owner).expect(400);

    const agency = await request(app).get("/api/properties/mine").set("Authorization", await auth(AGENCY, "agency")).expect(200);
    expect(agency.body.items.map((p: any) => p.title)).toEqual(["Gestionado"]);

    await request(app).get("/api/properties/mine").set("Authorization", await auth(TENANT, "tenant")).expect(403);
  });

  it("los favoritos no traen el propietario ni el historial, ni anuncios retirados o en borrador", async () => {
    const active = await Property.create(base(OWNER, "Publicado", "active", { agencyId: AGENCY, agencyAccess: "manage" }));
    const archived = await Property.create(base(OWNER, "Retirado", "archived"));
    const draft = await Property.create(base(OWNER, "Borrador", "draft"));
    for (const p of [active, archived, draft]) await UserFavorite.create({ userId: TENANT, propertyId: p._id });

    const res = await request(app).get("/api/properties/favorites").set("Authorization", await auth(TENANT, "tenant")).expect(200);
    expect(res.body.items.map((p: any) => p.title)).toEqual(["Publicado"]);
    for (const field of ["owner", "agencyId", "agencyAccess", "history"]) {
      expect(res.body.items[0]).not.toHaveProperty(field);
    }
    expect(res.body.items[0]._liked).toBe(true);
  });
});
