import request from "supertest";
import { app } from "../../src/app";
import { connectDb, disconnectDb, clearDb } from "../utils/db";
import { seedContractParties, LANDLORD_ID, TENANT_ID, PROPERTY_ID } from "../utils/contractParties";
import { Application } from "../../src/models/application.model";

const proposeAs = (userId: string, role: string, appId: string, body: Record<string, unknown>) =>
  request(app)
    .post(`/api/applications/${appId}/propose`)
    .set("x-user-id", userId)
    .set("x-user-role", role)
    .send(body);

describe("POST /api/applications/:id/propose: fecha de la visita", () => {
  let appId: string;

  beforeAll(connectDb);
  afterAll(disconnectDb);
  beforeEach(async () => {
    await seedContractParties();
    const created = await Application.create({ propertyId: PROPERTY_ID, tenantId: TENANT_ID });
    appId = String(created._id);
  });
  afterEach(clearDb);

  it("guarda el instante exacto que manda la interfaz (ISO con zona)", async () => {
    // 10:00 en Madrid (horario de verano, UTC+2) = 08:00 UTC
    const res = await proposeAs(LANDLORD_ID, "landlord", appId, { visitDate: "2027-10-12T08:00:00.000Z" }).expect(200);
    expect(res.body).toMatchObject({ status: "proposed", proposedBy: "landlord" });
    const saved = await Application.findById(appId).lean();
    expect(saved?.proposedDate?.toISOString()).toBe("2027-10-12T08:00:00.000Z");
  });

  it("una fecha inválida da 400 invalid_visit_date y no cambia la solicitud", async () => {
    const res = await proposeAs(LANDLORD_ID, "landlord", appId, { visitDate: "mañana por la tarde" }).expect(400);
    expect(res.body.error).toBe("invalid_visit_date");
    const saved = await Application.findById(appId).lean();
    expect(saved?.status).toBe("pending");
  });

  it("sin fecha: 400 visitDate_required", async () => {
    const res = await proposeAs(LANDLORD_ID, "landlord", appId, {}).expect(400);
    expect(res.body.error).toBe("visitDate_required");
  });

  it("otro casero no puede proponer visita en un inmueble ajeno", async () => {
    await proposeAs("507f1f77bcf86cd799439021", "landlord", appId, { visitDate: "2027-10-12T08:00:00.000Z" }).expect(403);
  });

  it("una fecha pasada da 400 visit_date_in_past y no cambia la solicitud", async () => {
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const res = await proposeAs(TENANT_ID, "tenant", appId, { visitDate: past }).expect(400);
    expect(res.body.error).toBe("visit_date_in_past");
    const saved = await Application.findById(appId).lean();
    expect(saved?.status).toBe("pending");
  });

  it("un id mal formado da 404 al proponer y al aceptar", async () => {
    const r1 = await proposeAs(TENANT_ID, "tenant", "no-es-un-id", { visitDate: "2027-10-12T08:00:00.000Z" }).expect(404);
    expect(r1.body.error).toBe("application_not_found");
    await request(app).post("/api/applications/no-es-un-id/accept")
      .set("x-user-id", TENANT_ID).set("x-user-role", "tenant").expect(404);
  });

  it("una solicitud descartada no admite propuestas ni aceptarlas (409 application_closed)", async () => {
    await Application.updateOne({ _id: appId }, {
      status: "rejected", proposedDate: new Date("2027-10-12T08:00:00.000Z"), proposedBy: "landlord",
    });
    const r1 = await proposeAs(TENANT_ID, "tenant", appId, { visitDate: "2027-10-13T08:00:00.000Z" }).expect(409);
    expect(r1.body.error).toBe("application_closed");
    const r2 = await request(app).post(`/api/applications/${appId}/accept`)
      .set("x-user-id", TENANT_ID).set("x-user-role", "tenant").expect(409);
    expect(r2.body.error).toBe("application_closed");
    expect((await Application.findById(appId).lean())?.status).toBe("rejected");
  });

  it("una propuesta cuya hora ya pasó no se acepta (409 proposed_date_passed)", async () => {
    await Application.updateOne({ _id: appId }, {
      status: "proposed", proposedDate: new Date(Date.now() - 60 * 60 * 1000), proposedBy: "landlord",
    });
    const res = await request(app).post(`/api/applications/${appId}/accept`)
      .set("x-user-id", TENANT_ID).set("x-user-role", "tenant").expect(409);
    expect(res.body.error).toBe("proposed_date_passed");
    expect((await Application.findById(appId).lean())?.status).toBe("proposed");
  });

  it("el inquilino contrapropone y el propietario acepta: queda la visita a esa hora", async () => {
    await proposeAs(LANDLORD_ID, "landlord", appId, { visitDate: "2027-10-12T08:00:00.000Z" }).expect(200);
    await proposeAs(TENANT_ID, "tenant", appId, { visitDate: "2027-10-13T16:30:00.000Z" }).expect(200);
    const res = await request(app).post(`/api/applications/${appId}/accept`)
      .set("x-user-id", LANDLORD_ID).set("x-user-role", "landlord").expect(200);
    expect(res.body.status).toBe("scheduled");
    expect(new Date(res.body.visitDate).toISOString()).toBe("2027-10-13T16:30:00.000Z");
  });

  it("cambiar una visita concertada: queda propuesta, la concertada sigue guardada hasta aceptar la nueva, y a la misma hora da 400", async () => {
    await Application.updateOne({ _id: appId }, { status: "scheduled", visitDate: new Date("2027-10-12T08:00:00.000Z") });

    const same = await proposeAs(TENANT_ID, "tenant", appId, { visitDate: "2027-10-12T08:00:00.000Z" }).expect(400);
    expect(same.body.error).toBe("same_visit_date");
    expect((await Application.findById(appId).lean())?.status).toBe("scheduled");

    await proposeAs(TENANT_ID, "tenant", appId, { visitDate: "2027-10-14T17:00:00.000Z" }).expect(200);
    let saved = await Application.findById(appId).lean();
    expect(saved).toMatchObject({ status: "proposed", proposedBy: "tenant" });
    expect(saved?.visitDate?.toISOString()).toBe("2027-10-12T08:00:00.000Z");

    await request(app).post(`/api/applications/${appId}/accept`)
      .set("x-user-id", LANDLORD_ID).set("x-user-role", "landlord").expect(200);
    saved = await Application.findById(appId).lean();
    expect(saved?.status).toBe("scheduled");
    expect(saved?.visitDate?.toISOString()).toBe("2027-10-14T17:00:00.000Z");
    expect(saved?.proposedDate).toBeUndefined();
  });

  it("tras una visita pasada se puede proponer otra a cualquier hora", async () => {
    await Application.updateOne({ _id: appId }, { status: "scheduled", visitDate: new Date(Date.now() - 24 * 3600 * 1000) });
    await proposeAs(TENANT_ID, "tenant", appId, { visitDate: "2027-10-14T17:00:00.000Z" }).expect(200);
  });
});
