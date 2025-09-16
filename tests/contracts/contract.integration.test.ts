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

    await request(app).post("/api/contracts").send(payload).expect(400);
  });
});
