import request from "supertest";

jest.setTimeout(180000);
// Retries are optional; only used if supported by the environment
// @ts-ignore
jest.retryTimes?.(2);
import { app } from "../../src/app";

describe("health E2E", () => {
  it("should return ok:true", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body.ok).toBe(true);
  });
});
