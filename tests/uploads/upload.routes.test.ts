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

  it("stores images with an unguessable name and without EXIF", async () => {
    const exifBody = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), Buffer.from("MM\0*\0\0\0\x08\0\0GPS-SECRETO", "latin1")]);
    const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, 0, exifBody.length + 2]), exifBody]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), app1, Buffer.from([0xff, 0xda, 0, 4, 1, 2, 9, 9, 0xff, 0xd9])]);

    const res = await request(app)
      .post("/api/uploads/images")
      .set("x-user-id", "507f1f77bcf86cd799439011")
      .set("x-user-role", "landlord")
      .set("x-user-verified", "true")
      .attach("files", jpeg, { filename: "foto.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    const name = String(res.body.urls[0]).split("/uploads/")[1];
    expect(name).toMatch(/^[0-9a-f]{32}\.jpg$/);
    const filePath = path.join(process.cwd(), "uploads", name);
    try {
      const stored = fs.readFileSync(filePath);
      expect(stored.toString("latin1")).not.toContain("GPS-SECRETO");
      expect(stored.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    } finally {
      fs.rmSync(filePath, { force: true });
    }
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
