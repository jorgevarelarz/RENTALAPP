import { Request, Response } from "express";
import { buildClauseCatalog } from "../services/clauses.service";
import { CLAUSE_POLICY_VERSION } from "../policies/clauses/catalog.v1";

export const listClauses = (req: Request, res: Response) => {
  try {
    // 1. Parse Inputs
    const regionParam = req.query.region;
    let regionQuery: string | undefined;
    if (Array.isArray(regionParam)) {
      const first = regionParam[0];
      regionQuery = typeof first === 'string' ? first : undefined;
    } else if (typeof regionParam === 'string') {
      regionQuery = regionParam;
    }

    const versionParam = req.query.version;
    const requestedVersion = String(versionParam || "") || CLAUSE_POLICY_VERSION;

    // 2. Version Check (Mimicking old route logic)
    if (requestedVersion !== CLAUSE_POLICY_VERSION) {
      return res.status(400).json({
        error: "unsupported_catalog_version",
        supported: CLAUSE_POLICY_VERSION,
      });
    }

    // 3. Call Service
    // The service throws if region is invalid, so we wrap in try/catch
    const catalog = buildClauseCatalog(regionQuery);

    // 4. Transform to Frontend Format
    // The frontend expects a flat list "items" with paramsMeta
    const items = [...catalog.base, ...catalog.regional];

    res.json({
      version: catalog.version,
      region: catalog.region || null,
      items,
    });

  } catch (error: any) {
    // If service throws "Región no soportada", we return 400
    // The old route returned { error: "region_not_supported" }
    // We try to match that behavior if possible, or just send the message.
    if (error?.message?.includes("Región no soportada")) {
        return res.status(400).json({ error: "region_not_supported" });
    }
    res.status(400).json({ error: error?.message ?? "No se pudo obtener el catálogo" });
  }
};
