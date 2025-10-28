import { Request, Response } from "express";
import { buildClauseCatalog } from "../core/clauses.service";

export const listClauses = (req: Request, res: Response) => {
  try {
    const regionParam = req.query.region;
    let regionQuery: string | undefined;
    if (Array.isArray(regionParam)) {
      const first = regionParam[0];
      regionQuery = typeof first === 'string' ? first : undefined;
    } else if (typeof regionParam === 'string') {
      regionQuery = regionParam;
    }
    const catalog = buildClauseCatalog(regionQuery);
    res.json({ catalog });
  } catch (error: any) {
    res.status(400).json({ error: error?.message ?? "No se pudo obtener el catálogo" });
  }
};
