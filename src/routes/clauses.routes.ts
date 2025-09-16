import { Router, Request, Response } from "express";
import { getCatalogByRegion, zodToMeta, CLAUSE_POLICY_VERSION } from "../policies/clauses";

const r = Router();

/**
 * GET /api/clauses?region=galicia&version=1.0.0
 * Respuesta:
 * {
 *   version: "1.0.0",
 *   region: "galicia",
 *   items: [{ id, label, version, paramsMeta }]
 * }
 */
r.get("/clauses", (req: Request, res: Response) => {
  const region = String(req.query.region || "").toLowerCase() || undefined;
  const requestedVersion = String(req.query.version || "") || CLAUSE_POLICY_VERSION;

  // Por ahora solo la versión activa
  if (requestedVersion !== CLAUSE_POLICY_VERSION) {
    return res.status(400).json({
      error: "unsupported_catalog_version",
      supported: CLAUSE_POLICY_VERSION,
    });
  }

  const catalog = getCatalogByRegion(region);
  if (!catalog || Object.keys(catalog).length === 0) {
    return res.status(400).json({ error: "region_not_supported" });
  }

  const items = Object.values(catalog).map((c) => ({
    id: c.id,
    label: c.label,
    version: c.version,
    paramsMeta: zodToMeta(c.paramsSchema),
  }));

  res.json({
    version: CLAUSE_POLICY_VERSION,
    region: region || null,
    items,
  });
});

export default r;
