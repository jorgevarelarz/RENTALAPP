import { Request, Response, NextFunction } from "express";

/**
 * Admin gate based on the authenticated user's role.
 * Assumes auth.middleware has already populated req.user.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  next();
}
