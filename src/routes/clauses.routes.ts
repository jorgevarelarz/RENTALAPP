import { Router } from "express";
import { listClauses } from "../controllers/clauses.controller";

const router = Router();

router.get("/", listClauses);

export default router;
