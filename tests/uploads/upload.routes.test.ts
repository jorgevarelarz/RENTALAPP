import request from "supertest";
import { app } from "../../src/app";

describe("Uploads (validation)", () => {
  it("rejects spoofed jpeg content", async () => {
    const res = await request(app)
      .post("/api/uploads/images")
      .set("x-user-id", "507f1f77bcf86cd799439011")
      .set("x-user-role", "landlord")
      .set("x-user-verified", "true")
      .attach("files", Buffer.from("not-a-real-jpeg"), {
        filename: "fake.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(415);
    expect(res.body.error).toBe("invalid_file_type");
  });
});
