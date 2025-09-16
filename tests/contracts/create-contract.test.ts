import request from "supertest";
import { app } from "../../src/app";
import { connectDb, disconnectDb, clearDb } from "../utils/db";

describe("POST /api/contracts", () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  it("crea contrato y genera pdfHash", async () => {
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

    const res = await request(app).post("/api/contracts").send(payload).expect(201);

    expect(res.body.contract.region).toBe("galicia");
    expect(res.body.contract.pdfHash).toMatch(/^[a-f0-9]{64}$/);
    expect(typeof res.body.contract.pdfPath).toBe("string");
  });
});
