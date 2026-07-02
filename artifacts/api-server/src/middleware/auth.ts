import { Request, Response, NextFunction } from "express";
import { validateActiveClinicSubscription } from "../routes/subscriptions";

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
  // Bypass if this is an impersonation session from a System Owner
  if (isNaN(clinicId) || (req.session.clinicId !== clinicId && !req.session.originalSystemOwnerUserId)) {
    res.status(403).json({ error: "Forbidden: you do not have access to this clinic" });
    return;
  }
  next();
}

export async function checkActiveSubscription(req: any, res: any, next: NextFunction): Promise<void> {
  if (!req.session.authenticated) {
    next();
    return;
  }

  const clinicId = req.session.clinicId;
  if (!clinicId) {
    next();
    return;
  }

  // Bypass for System Owners (ONLY when NOT impersonating)
  if (req.session.role === "system_owner" && !req.session.originalSystemOwnerUserId) {
    next();
    return;
  }

  // Bypass for reading endpoints
  if (req.method === "GET") {
    next();
    return;
  }

  // Bypass for subscription status check, proof submission, and authentication endpoints
  const bypassRoutes = [
    "/subscriptions/my-status",
    "/subscriptions/requests",
    "/subscriptions/stop-impersonation",
    "/auth/login",
    "/auth/me",
    "/auth/logout",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/demo-requests",
  ];
  if (bypassRoutes.some(route => req.originalUrl.includes(route))) {
    next();
    return;
  }

  try {
    // Validate the active clinic's subscription status
    const clinic = await validateActiveClinicSubscription(clinicId);
    if (!clinic) {
      next();
      return;
    }

    if (clinic.subscriptionStatus === "Expired") {
      res.status(403).json({
        error: "Subscription Expired: Please renew your subscription to continue using the system.",
        subscriptionExpired: true,
      });
      return;
    }

    if (clinic.subscriptionStatus === "Suspended") {
      res.status(403).json({
        error: "Your account has been suspended. Please contact support.",
        suspended: true,
      });
      return;
    }
  } catch (err) {
    console.error("Subscription validation middleware error:", err);
  }

  next();
}


