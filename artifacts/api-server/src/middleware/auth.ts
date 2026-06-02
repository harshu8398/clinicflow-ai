import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.authenticated) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export function requireClinicOwnership(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.authenticated) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const clinicId = Number(req.params["clinicId"]);
  if (isNaN(clinicId) || req.session.clinicId !== clinicId) {
    res.status(403).json({ error: "Forbidden: you do not have access to this clinic" });
    return;
  }
  next();
}
