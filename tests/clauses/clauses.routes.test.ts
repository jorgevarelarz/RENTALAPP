import request from "supertest";
import { app } from "../../src/app";

describe("GET /api/clauses", () => {
  it("devuelve catálogo base+Galicia con paramsMeta", async () => {
    const res = await request(app).get("/api/clauses?region=galicia&version=1.0.0").expect(200);
    expect(res.body.version).toBe("1.0.0");
    expect(res.body.region).toBe("galicia");
    expect(Array.isArray(res.body.items)).toBe(true);
    const igvs = res.body.items.find((i: any) => i.id === "fianza_autonomica");
    expect(igvs).toBeTruthy();
    // paramsMeta debe existir aunque sea objeto vacío (por nuestra serialización)
    expect(igvs.paramsMeta).toBeDefined();
  });

  it("falla si version no es soportada", async () => {
    const res = await request(app).get("/api/clauses?region=madrid&version=0.9.0").expect(400);
    expect(res.body.error).toBe("unsupported_catalog_version");
  });

  it("falla si region inválida", async () => {
    const res = await request(app).get("/api/clauses?region=venus").expect(400);
    expect(res.body.error).toBe("region_not_supported");
  });
});
