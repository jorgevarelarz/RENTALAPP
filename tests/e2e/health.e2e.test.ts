import request from "supertest";
import { app } from "../../src/app";

describe("health E2E", () => {
  it("should return ok:true", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body.ok).toBe(true);
  });
});
