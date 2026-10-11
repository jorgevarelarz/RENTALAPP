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
    const res = await proposeAs(LANDLORD_ID, "landlord", appId, { visitDate: "2026-10-12T08:00:00.000Z" }).expect(200);
    expect(res.body).toMatchObject({ status: "proposed", proposedBy: "landlord" });
    const saved = await Application.findById(appId).lean();
    expect(saved?.proposedDate?.toISOString()).toBe("2026-10-12T08:00:00.000Z");
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
    await proposeAs("507f1f77bcf86cd799439021", "landlord", appId, { visitDate: "2026-10-12T08:00:00.000Z" }).expect(403);
  });
});
