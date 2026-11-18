import request from "supertest";
import { app } from "../../src/app";
import { connectDb, disconnectDb, clearDb } from "../utils/db";
import { sessionToken } from "../utils/sessionToken";
import { Property } from "../../src/models/property.model";
import { Application } from "../../src/models/application.model";
import { cleanApplicationMessage } from "../../src/controllers/property.controller";

const OWNER = "507f1f77bcf86cd799439071";
const TENANT = "507f1f77bcf86cd799439072";

const auth = async (id: string, role: string) => `Bearer ${await sessionToken({ _id: id, role, isVerified: true })}`;

const makeProperty = () =>
  Property.create({
    owner: OWNER,
    title: "Piso en Chamberí",
    address: "C/ Luchana 10",
    region: "madrid",
    city: "Madrid",
    location: { type: "Point", coordinates: [-3.7, 40.43] },
    price: 1100,
    deposit: 1100,
    sizeM2: 55,
    rooms: 2,
    bathrooms: 1,
    availableFrom: new Date("2026-11-01"),
    images: ["/uploads/a.jpg"],
    status: "active",
  });

describe("Mensaje al solicitar visita", () => {
  beforeAll(connectDb);
  afterEach(clearDb);
  afterAll(disconnectDb);

  it("limpia el texto: saltos de línea, caracteres de control y espacios", () => {
    expect(cleanApplicationMessage(undefined)).toEqual({});
    expect(cleanApplicationMessage("   ")).toEqual({});
    expect(cleanApplicationMessage("  Hola\r\n\r\n\r\n\r\nSoy Ana\u0000\u0007  ")).toEqual({ message: "Hola\n\nSoy Ana" });
    expect(cleanApplicationMessage(42)).toEqual({ error: "invalid_message" });
    expect(cleanApplicationMessage({ $gt: "" })).toEqual({ error: "invalid_message" });
    expect(cleanApplicationMessage("a".repeat(1001))).toEqual({ error: "message_too_long" });
    expect(cleanApplicationMessage(`${"a".repeat(1000)}   `)).toEqual({ message: "a".repeat(1000) });
  });

  it("el propietario lee el mensaje y el inquilino lo ve en la ficha y en sus solicitudes", async () => {
    const p = await makeProperty();
    const tenant = await auth(TENANT, "tenant");
    await request(app)
      .post(`/api/properties/${p._id}/apply`)
      .set("Authorization", tenant)
      .send({ message: "  Hola, trabajo en Madrid y me mudo en noviembre.  " })
      .expect(200);

    const owner = await auth(OWNER, "landlord");
    const list = await request(app).get(`/api/properties/${p._id}/applications`).set("Authorization", owner).expect(200);
    expect(list.body.items[0].message).toBe("Hola, trabajo en Madrid y me mudo en noviembre.");

    const detail = await request(app).get(`/api/properties/${p._id}`).set("Authorization", tenant).expect(200);
    expect(detail.body._application.message).toBe("Hola, trabajo en Madrid y me mudo en noviembre.");

    const mine = await request(app).get("/api/applications/my").set("Authorization", tenant).expect(200);
    expect(mine.body.items[0].message).toBe("Hola, trabajo en Madrid y me mudo en noviembre.");
  });

  it("sin mensaje la solicitud sigue funcionando y un mensaje inválido no crea nada", async () => {
    const p = await makeProperty();
    const tenant = await auth(TENANT, "tenant");

    let res = await request(app)
      .post(`/api/properties/${p._id}/apply`)
      .set("Authorization", tenant)
      .send({ message: "x".repeat(1001) })
      .expect(400);
    expect(res.body).toEqual({ error: "message_too_long", max: 1000 });
    res = await request(app).post(`/api/properties/${p._id}/apply`).set("Authorization", tenant).send({ message: ["a"] }).expect(400);
    expect(res.body.error).toBe("invalid_message");
    expect(await Application.countDocuments()).toBe(0);

    await request(app).post(`/api/properties/${p._id}/apply`).set("Authorization", tenant).expect(200);
    const saved = await Application.findOne({ propertyId: p._id }).lean();
    expect(saved?.message).toBeUndefined();

    // Repetir la solicitud no cambia el mensaje de la primera
    await request(app).post(`/api/properties/${p._id}/apply`).set("Authorization", tenant).send({ message: "Otra vez" }).expect(200);
    expect(await Application.countDocuments()).toBe(1);
    expect((await Application.findOne({ propertyId: p._id }).lean())?.message).toBeUndefined();
  });

  it("un id mal formado en las solicitudes del anuncio da 404", async () => {
    await request(app).get("/api/properties/no-es-un-id/applications").set("Authorization", await auth(OWNER, "landlord")).expect(404);
  });
});
