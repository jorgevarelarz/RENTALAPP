import request from "supertest";
import { app } from "../../src/app";
import { connectDb, disconnectDb, clearDb } from "../utils/db";
import { seedContractParties, LANDLORD_ID, TENANT_ID, PROPERTY_ID } from "../utils/contractParties";
import { Application } from "../../src/models/application.model";
import { Property } from "../../src/models/property.model";
import { Contract } from "../../src/models/contract.model";

const AGENCY_ID = "507f1f77bcf86cd799439031";
const OTHER_AGENCY_ID = "507f1f77bcf86cd799439032";

const as = (req: request.Test, userId: string, role: string) =>
  req.set("x-user-id", userId).set("x-user-role", role);

describe("Agencia gestora: inmuebles, candidatos y visitas", () => {
  let appId: string;

  beforeAll(connectDb);
  afterAll(disconnectDb);
  beforeEach(async () => {
    await seedContractParties({ agencyId: AGENCY_ID });
    await Property.updateOne({ _id: PROPERTY_ID }, { agencyAccess: "manage" });
    const created = await Application.create({ propertyId: PROPERTY_ID, tenantId: TENANT_ID, message: "Hola" });
    await Application.create({ propertyId: PROPERTY_ID, tenantId: LANDLORD_ID, status: "rejected" });
    appId = String(created._id);
  });
  afterEach(clearDb);

  it("GET /api/agency/properties trae propietario, precio y solicitudes abiertas", async () => {
    const res = await as(request(app).get("/api/agency/properties"), AGENCY_ID, "agency").expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: PROPERTY_ID,
      ownerId: LANDLORD_ID,
      ownerName: "Casero",
      agencyAccess: "manage",
      price: 750,
      deposit: 750,
      region: "galicia",
      openApplications: 1,
    });
  });

  it("tras el traspaso (status_only) no hay precio ni solicitudes, y los candidatos dan 403", async () => {
    await Property.updateOne({ _id: PROPERTY_ID }, { agencyAccess: "status_only" });
    const res = await as(request(app).get("/api/agency/properties"), AGENCY_ID, "agency").expect(200);
    expect(res.body.items[0].price).toBeUndefined();
    expect(res.body.items[0].openApplications).toBeUndefined();
    await as(request(app).get(`/api/properties/${PROPERTY_ID}/applications`), AGENCY_ID, "agency").expect(403);
    await as(request(app).post(`/api/applications/${appId}/propose`), AGENCY_ID, "agency")
      .send({ visitDate: "2027-10-20T08:00:00.000Z" })
      .expect(403);
  });

  it("la agencia gestora ve los candidatos del inmueble", async () => {
    const res = await as(request(app).get(`/api/properties/${PROPERTY_ID}/applications`), AGENCY_ID, "agency").expect(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.find((a: any) => a._id === appId)?.tenant?.email).toBe(`inquilina-${TENANT_ID}@test.com`);
  });

  it("otra agencia no ve los candidatos ni propone visitas", async () => {
    await as(request(app).get(`/api/properties/${PROPERTY_ID}/applications`), OTHER_AGENCY_ID, "agency").expect(403);
    await as(request(app).post(`/api/applications/${appId}/propose`), OTHER_AGENCY_ID, "agency")
      .send({ visitDate: "2027-10-20T08:00:00.000Z" })
      .expect(403);
  });

  it("la agencia gestora propone la visita en nombre del propietario y acepta la del candidato", async () => {
    const res = await as(request(app).post(`/api/applications/${appId}/propose`), AGENCY_ID, "agency")
      .send({ visitDate: "2027-10-20T08:00:00.000Z" })
      .expect(200);
    expect(res.body).toMatchObject({ status: "proposed", proposedBy: "landlord" });
    // La agencia no puede aceptar su propia propuesta: le toca al candidato
    await as(request(app).post(`/api/applications/${appId}/accept`), AGENCY_ID, "agency").expect(403);

    await as(request(app).post(`/api/applications/${appId}/propose`), TENANT_ID, "tenant")
      .send({ visitDate: "2027-10-21T15:00:00.000Z" })
      .expect(200);
    const ok = await as(request(app).post(`/api/applications/${appId}/accept`), AGENCY_ID, "agency").expect(200);
    expect(ok.body.status).toBe("scheduled");
    expect(new Date(ok.body.visitDate).toISOString()).toBe("2027-10-21T15:00:00.000Z");
  });
  describe("contratos de los inmuebles gestionados", () => {
    let contractId: string;
    beforeEach(async () => {
      const c = await Contract.create({
        landlord: LANDLORD_ID,
        tenant: TENANT_ID,
        property: PROPERTY_ID,
        agencyId: AGENCY_ID,
        rent: 750,
        deposit: 750,
        startDate: new Date("2026-11-01"),
        endDate: new Date("2027-10-31"),
        region: "galicia",
        status: "draft",
      });
      contractId = String(c._id);
    });

    it("la agencia gestora los lista, abre el detalle y ve los co-titulares", async () => {
      const list = await as(request(app).get("/api/contracts"), AGENCY_ID, "agency").expect(200);
      const items = list.body.items ?? list.body.data ?? list.body;
      expect(items.map((c: any) => String(c._id))).toContain(contractId);
      const res = await as(request(app).get(`/api/contracts/${contractId}`), AGENCY_ID, "agency").expect(200);
      expect(res.body).toMatchObject({ _id: contractId, landlordName: "Casero" });
      expect(res.body.ibanEncrypted).toBeUndefined();
      await as(request(app).get(`/api/contracts/${contractId}/parties`), AGENCY_ID, "agency").expect(200);
    });

    it("otra agencia, o la gestora tras el traspaso, reciben 403", async () => {
      await as(request(app).get(`/api/contracts/${contractId}`), OTHER_AGENCY_ID, "agency").expect(403);
      await as(request(app).get(`/api/contracts/${contractId}/parties`), OTHER_AGENCY_ID, "agency").expect(403);
      await Property.updateOne({ _id: PROPERTY_ID }, { agencyAccess: "status_only" });
      await as(request(app).get(`/api/contracts/${contractId}`), AGENCY_ID, "agency").expect(403);
      await as(request(app).get(`/api/contracts/${contractId}/parties`), AGENCY_ID, "agency").expect(403);
    });
  });
});
