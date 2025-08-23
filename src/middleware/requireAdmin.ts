import { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.header("x-admin") !== "true") {
    return res.status(403).json({ error: "forbidden" });
  }
  next();
}
