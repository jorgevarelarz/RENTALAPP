import request from "supertest";
import { app } from "../../src/app";
import { connectDb, disconnectDb, clearDb } from "../utils/db";

beforeAll(connectDb);
afterAll(disconnectDb);
afterEach(clearDb);

describe("Contracts API (multi-región)", () => {
  it("crea contrato válido en Galicia con cláusula autonómica IGVS", async () => {
    const payload = {
      landlord: "507f1f77bcf86cd799439011",
      tenant: "507f1f77bcf86cd799439012",
      property: "507f1f77bcf86cd799439013",
      region: "galicia",
      rent: 750,
      deposit: 750,
      startDate: "2025-10-01",
      endDate: "2026-09-30",
      clauses: [
        { id: "duracion_prorroga", params: { mesesIniciales: 12, mesesProrroga: 12 } },
        { id: "fianza_autonomica", params: {} }
      ]
    };

    const res = await request(app)
      .post("/api/contracts")
      .set('x-user-role', 'landlord')
      .set('x-user-verified', 'true')
      .send(payload)
      .expect(201);

    expect(res.body).toHaveProperty("contract");
    expect(res.body.contract.region).toBe("galicia");
    expect(res.body.contract.clauses.find((c: any) => c.id === "fianza_autonomica")).toBeTruthy();
    expect(res.body.contract.pdfHash).toMatch(/^[a-f0-9]{64}$/); // hash SHA-256
  });

  it("rechaza contrato con región inválida", async () => {
    const payload = {
      landlord: "507f1f77bcf86cd799439011",
      tenant: "507f1f77bcf86cd799439012",
      property: "507f1f77bcf86cd799439013",
      region: "andromeda",
      rent: 750,
      deposit: 750,
      startDate: "2025-10-01",
      endDate: "2026-09-30",
      clauses: []
    };

    await request(app)
      .post("/api/contracts")
      .set('x-user-role', 'landlord')
      .set('x-user-verified', 'true')
      .send(payload)
      .expect(400);
  });

  it("crea contrato con cláusulas opcionales válidas", async () => {
    const payload = {
      landlord: "507f1f77bcf86cd799439021",
      tenant: "507f1f77bcf86cd799439022",
      property: "507f1f77bcf86cd799439023",
      region: "madrid",
      rent: 950,
      deposit: 950,
      startDate: "2025-01-01",
      endDate: "2030-01-01",
      landlordType: 'individual',
      clauses: {
        furnished: true,
        inventoryAttached: true,
        pets: 'conditional',
        petsConditions: 'Solo perros pequeños con seguro',
        subleaseAllowed: false,
        durationMonths: 60,
        automaticExtension: true,
        depositExtra: 1,
        guarantee: 'aval',
        rentUpdateINE: true,
        paymentBySEPA: true,
        communityAndIBI: { payer: 'tenant', annualCost: 600 },
        supplies: [
          { supply: 'agua', payer: 'tenant' },
          { supply: 'luz', payer: 'tenant' },
          { supply: 'gas', payer: 'tenant' },
          { supply: 'internet', payer: 'tenant' },
        ],
        minorWorksAllowed: true,
        majorWorksWithAuth: true,
        penalty: '1monthPerYearPending',
        habitualUseOnly: true,
        teleworkAllowed: true,
        landlordInsurance: true,
        tenantInsurance: false,
        digitalInventory: true,
        digitalNotifications: true,
      },
    };

    const res = await request(app)
      .post('/api/contracts')
      .set('x-user-role', 'landlord')
      .set('x-user-verified', 'true')
      .send(payload)
      .expect(201);
    expect(res.body.contract.clauses.furnished).toBe(true);
    expect(res.body.contract.clauses.durationMonths).toBe(60);
    expect(res.body.contract.metadata.landlordType).toBe('individual');
  });

  it("rechaza cláusulas opcionales con duración insuficiente para persona jurídica", async () => {
    const payload = {
      landlord: "507f1f77bcf86cd799439031",
      tenant: "507f1f77bcf86cd799439032",
      property: "507f1f77bcf86cd799439033",
      region: "madrid",
      rent: 950,
      deposit: 950,
      startDate: "2025-01-01",
      endDate: "2026-01-01",
      landlordType: 'company',
      clauses: {
        furnished: false,
        inventoryAttached: false,
        pets: 'allowed',
        subleaseAllowed: false,
        durationMonths: 60,
        automaticExtension: false,
        depositExtra: 0,
        guarantee: 'none',
        rentUpdateINE: true,
        paymentBySEPA: true,
        communityAndIBI: { payer: 'landlord' },
        supplies: [
          { supply: 'agua', payer: 'tenant' },
          { supply: 'luz', payer: 'tenant' },
          { supply: 'gas', payer: 'tenant' },
          { supply: 'internet', payer: 'tenant' },
        ],
        minorWorksAllowed: true,
        majorWorksWithAuth: true,
        penalty: 'none',
        habitualUseOnly: true,
        teleworkAllowed: true,
        landlordInsurance: false,
        tenantInsurance: false,
        digitalInventory: false,
        digitalNotifications: true,
      },
    };

    await request(app)
      .post('/api/contracts')
      .set('x-user-role', 'landlord')
      .set('x-user-verified', 'true')
      .send(payload)
      .expect(400);
  });
});
