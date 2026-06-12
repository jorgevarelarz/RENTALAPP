import request from "supertest";
import fs from "fs";
import path from "path";
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

  it("does not expose contract PDFs through public uploads", async () => {
    const contractsDir = path.join(process.cwd(), "uploads", "contracts");
    const filePath = path.join(contractsDir, "public-static-test.pdf");
    fs.mkdirSync(contractsDir, { recursive: true });
    fs.writeFileSync(filePath, Buffer.from("%PDF-1.4\n"));

    try {
      const res = await request(app).get("/uploads/contracts/public-static-test.pdf");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("not_found");
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  });
});
