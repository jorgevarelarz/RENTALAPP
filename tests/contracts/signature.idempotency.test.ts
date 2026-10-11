import request from "supertest";
import { app } from "../../src/app";
import { connectDb, disconnectDb, clearDb } from "../utils/db";
import { seedContractParties, LANDLORD_ID } from "../utils/contractParties";

describe("Signature callback idempotency", () => {
  let id: string;

  beforeAll(async () => {
    process.env.SIGN_PROVIDER = 'mock';
    await connectDb();
  });
  afterAll(disconnectDb);
  afterEach(clearDb);

  beforeEach(async () => {
    await seedContractParties();
    const res = await request(app).post("/api/contracts").set("x-user-id", LANDLORD_ID).send({
      landlord: "507f1f77bcf86cd799439011",
      tenant: "507f1f77bcf86cd799439012",
      property: "507f1f77bcf86cd799439013",
      region: "galicia",
      rent: 750,
      deposit: 750,
      startDate: "2025-10-01",
      endDate: "2026-09-30",
      clauses: [{ id: "duracion_prorroga", params: { mesesIniciales: 12, mesesProrroga: 12 } }],
    }).expect(201);
    id = res.body.contract._id;
  });

  it("processes first event and ignores duplicates", async () => {
    const payload = { eventId: "evt_123", provider: "mock", status: "signed" };

    const first = await request(app)
      .post(`/api/contracts/${id}/signature/callback`)
      .send(payload)
      .expect(200);
    expect(first.body.status).toBe("signed");

    const second = await request(app)
      .post(`/api/contracts/${id}/signature/callback`)
      .send(payload)
      .expect(200);
    expect(second.body.idempotent || second.body.alreadyFinalized).toBeTruthy();
  });
});
