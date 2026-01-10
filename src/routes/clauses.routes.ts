import { Router } from "express";
import { listClauses } from "../controllers/clauses.controller";

const r = Router();

/**
 * GET /api/clauses?region=galicia&version=1.0.0
 * Delegates to clauses.controller.ts -> clauses.service.ts
 */
r.get("/clauses", listClauses);

export default r;
