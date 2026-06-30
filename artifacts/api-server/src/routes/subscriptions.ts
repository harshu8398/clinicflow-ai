import { Router, type IRouter } from "express";
import { db, clinicsTable, usersTable, subscriptionSettingsTable, subscriptionRequestsTable, auditLogsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import fs from "fs";
import path from "path";

const router: IRouter = Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Middleware to check if user is a System Owner
function requireSystemOwner(req: any, res: any, next: any) {
  // If impersonating, role might be admin. But original role in session must be system_owner
  const isSystemOwner = req.session.role === "system_owner" || req.session.originalRole === "system_owner";
  if (!isSystemOwner) {
    res.status(403).json({ error: "Access denied: System Owner only" });
    return;
  }
  next();
}

// Middleware to automatically validate expiry of active clinic
export async function validateActiveClinicSubscription(clinicId: number): Promise<any> {
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
  if (!clinic) return null;

  // Lifetime plans never expire, suspended remains suspended
  if (clinic.subscriptionStatus === "Lifetime" || clinic.subscriptionStatus === "Suspended") {
    return clinic;
  }

  const now = new Date();
  if (clinic.expiryDate && now > new Date(clinic.expiryDate)) {
    if (clinic.subscriptionStatus !== "Expired") {
      const [updated] = await db
        .update(clinicsTable)
        .set({ subscriptionStatus: "Expired" })
        .where(eq(clinicsTable.id, clinicId))
        .returning();
      return updated;
    }
  } else {
    // If not expired, and status is currently Expired or Trial (if it's not Demo plan)
    if (clinic.subscriptionStatus === "Expired") {
      const [updated] = await db
        .update(clinicsTable)
        .set({ subscriptionStatus: clinic.planType === "Demo" ? "Trial" : "Active" })
        .where(eq(clinicsTable.id, clinicId))
        .returning();
      return updated;
    }
  }

  return clinic;
}

// ----------------------------------------------------
// CLINIC OWNER ENDPOINTS (PROTECTED BY AUTH)
// ----------------------------------------------------

// Get current clinic's subscription status and global settings
router.get("/subscriptions/my-status", requireAuth, async (req: any, res): Promise<void> => {
  const clinicId = req.session.clinicId;
  
  const isSystemOwner = req.session.role === "system_owner" && !req.session.originalSystemOwnerUserId;
  let clinic;

  if (isSystemOwner) {
    const [c] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
    if (c) {
      clinic = {
        ...c,
        subscriptionStatus: "Active",
      };
    }
  } else {
    // Update/validate subscription status on request
    clinic = await validateActiveClinicSubscription(clinicId);
  }

  if (!clinic) {
    res.status(404).json({ error: "Clinic not found" });
    return;
  }

  const [settings] = await db.select().from(subscriptionSettingsTable).limit(1);
  
  // Find any pending verification requests
  const requests = await db
    .select()
    .from(subscriptionRequestsTable)
    .where(eq(subscriptionRequestsTable.clinicId, clinicId))
    .orderBy(desc(subscriptionRequestsTable.submittedAt));

  res.json({
    clinic: {
      id: clinic.id,
      name: clinic.name,
      planType: clinic.planType,
      subscriptionStatus: clinic.subscriptionStatus,
      startDate: clinic.startDate,
      expiryDate: clinic.expiryDate,
      lastPaymentReference: clinic.lastPaymentReference,
      subscriptionNotes: clinic.subscriptionNotes,
    },
    settings: settings || null,
    requests: requests || [],
    impersonating: !!req.session.originalUserId,
  });
});

// Submit payment proof
router.post("/subscriptions/requests", requireAuth, async (req: any, res): Promise<void> => {
  const clinicId = req.session.clinicId;
  const { planType, amount, screenshot, notes } = req.body ?? {};

  if (!planType || !amount || !screenshot) {
    res.status(400).json({ error: "Plan type, amount, and payment proof screenshot are required" });
    return;
  }

  try {
    // Decode base64 image
    const matches = screenshot.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      res.status(400).json({ error: "Invalid image format" });
      return;
    }

    const ext = matches[1].toLowerCase();
    const allowedExtensions = ["png", "jpg", "jpeg", "webp"];
    if (!allowedExtensions.includes(ext)) {
      res.status(400).json({ error: "Supported payment proof file types are PNG, JPG, JPEG, or WEBP." });
      return;
    }

    const dataBuffer = Buffer.from(matches[2], "base64");

    // Check size <= 5 MB
    if (dataBuffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: "File size exceeds 5MB limit" });
      return;
    }

    const filename = `proof-${clinicId}-${Date.now()}.${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, dataBuffer);

    const screenshotUrl = `/uploads/${filename}`;

    // Create verification request
    const [request] = await db
      .insert(subscriptionRequestsTable)
      .values({
        clinicId,
        planType,
        amount,
        screenshotUrl,
        notes,
        status: "Pending Verification",
      })
      .returning();

    // Update clinic status to Pending Verification
    await db
      .update(clinicsTable)
      .set({
        subscriptionStatus: "Pending Verification",
        lastPaymentReference: notes || "",
      })
      .where(eq(clinicsTable.id, clinicId));

    // Audit log
    await db.insert(auditLogsTable).values({
      action: "Payment Verification Requested",
      userId: req.session.userId,
      details: `Verification requested for clinic ${clinicId}, plan ${planType}`,
    });

    res.status(201).json({
      success: true,
      message: "Payment proof submitted successfully. Awaiting verification.",
      request,
    });
  } catch (err: any) {
    console.error("Screenshot upload failed:", err);
    res.status(500).json({ error: "Failed to submit verification request" });
  }
});

// ----------------------------------------------------
// SYSTEM OWNER ENDPOINTS (PROTECTED BY SYSTEM OWNER)
// ----------------------------------------------------

// Get Platform Overview statistics (System Owner Dashboard)
router.get("/subscriptions/overview", requireAuth, requireSystemOwner, async (req, res): Promise<void> => {
  try {
    const clinics = await db.select().from(clinicsTable);
    
    const totalClinics = clinics.length;
    let activeSubscriptions = 0;
    let expiredSubscriptions = 0;
    let trialClinics = 0;
    let lifetimeClinics = 0;
    
    clinics.forEach(c => {
      if (c.subscriptionStatus === "Active") activeSubscriptions++;
      else if (c.subscriptionStatus === "Expired") expiredSubscriptions++;
      else if (c.subscriptionStatus === "Trial") trialClinics++;
      else if (c.subscriptionStatus === "Lifetime") lifetimeClinics++;
    });

    // Find pending verification requests
    const pendingReqs = await db
      .select()
      .from(subscriptionRequestsTable)
      .where(eq(subscriptionRequestsTable.status, "Pending Verification"));
    
    const pendingCount = pendingReqs.length;

    // Recent subscription requests activity
    const recentRequests = await db
      .select({
        id: subscriptionRequestsTable.id,
        planType: subscriptionRequestsTable.planType,
        amount: subscriptionRequestsTable.amount,
        status: subscriptionRequestsTable.status,
        submittedAt: subscriptionRequestsTable.submittedAt,
        clinicName: clinicsTable.name,
      })
      .from(subscriptionRequestsTable)
      .innerJoin(clinicsTable, eq(clinicsTable.id, subscriptionRequestsTable.clinicId))
      .orderBy(desc(subscriptionRequestsTable.submittedAt))
      .limit(5);

    // Recent audit logs
    const recentLogs = await db
      .select({
        id: auditLogsTable.id,
        action: auditLogsTable.action,
        createdAt: auditLogsTable.createdAt,
        details: auditLogsTable.details,
        userEmail: usersTable.email,
      })
      .from(auditLogsTable)
      .innerJoin(usersTable, eq(usersTable.id, auditLogsTable.userId))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(5);

    res.json({
      totalClinics,
      activeSubscriptions,
      expiredSubscriptions,
      trialClinics,
      lifetimeClinics,
      pendingCount,
      recentRequests,
      recentLogs,
    });
  } catch (err: any) {
    console.error("Overview load failed:", err);
    res.status(500).json({ error: "Failed to load platform overview statistics" });
  }
});

// List all clinics and subscription info
router.get("/subscriptions/clinics", requireAuth, requireSystemOwner, async (req, res): Promise<void> => {
  const clinics = await db.select().from(clinicsTable).orderBy(clinicsTable.createdAt);
  
  // Calculate days remaining dynamically
  const result = clinics.map(c => {
    let daysRemaining = 0;
    if (c.subscriptionStatus === "Lifetime") {
      daysRemaining = 999999; // Represents Never
    } else if (c.expiryDate) {
      const diffTime = new Date(c.expiryDate).getTime() - new Date().getTime();
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }
    return {
      ...c,
      daysRemaining,
    };
  });

  res.json(result);
});

// Get platform settings
router.get("/subscriptions/settings", requireAuth, requireSystemOwner, async (req, res): Promise<void> => {
  const [settings] = await db.select().from(subscriptionSettingsTable).limit(1);
  res.json(settings || null);
});

// Update platform settings (includes Base64 QR code upload)
router.put("/subscriptions/settings", requireAuth, requireSystemOwner, async (req: any, res): Promise<void> => {
  const { upiId, upiQrCode, monthlyPrice, quarterlyPrice, yearlyPrice, supportContact, supportWhatsapp } = req.body ?? {};

  let upiQrCodeUrl: string | undefined = undefined;

  if (upiQrCode && upiQrCode.startsWith("data:image")) {
    try {
      const matches = upiQrCode.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        res.status(400).json({ error: "Invalid QR code image format" });
        return;
      }
      const ext = matches[1].toLowerCase();
      const allowedExtensions = ["png", "jpg", "jpeg", "webp"];
      if (!allowedExtensions.includes(ext)) {
        res.status(400).json({ error: "Supported QR code file types are PNG, JPG, JPEG, or WEBP." });
        return;
      }
      const dataBuffer = Buffer.from(matches[2], "base64");
      if (dataBuffer.length > 2 * 1024 * 1024) {
        res.status(400).json({ error: "QR code image size must be smaller than 2MB." });
        return;
      }

      const filename = `qrcode-${Date.now()}.${ext}`;
      const filepath = path.join(UPLOADS_DIR, filename);
      fs.writeFileSync(filepath, dataBuffer);
      upiQrCodeUrl = `/uploads/${filename}`;
    } catch (err) {
      console.error("QR Code upload failed:", err);
      res.status(500).json({ error: "Failed to process QR code upload" });
      return;
    }
  }

  const [settings] = await db.select().from(subscriptionSettingsTable).limit(1);

  const updateData: any = {
    upiId,
    monthlyPrice,
    quarterlyPrice,
    yearlyPrice,
    supportContact,
    supportWhatsapp,
  };
  if (upiQrCodeUrl) {
    updateData.upiQrCodeUrl = upiQrCodeUrl;
  }

  let result;
  if (settings) {
    [result] = await db
      .update(subscriptionSettingsTable)
      .set(updateData)
      .where(eq(subscriptionSettingsTable.id, settings.id))
      .returning();
  } else {
    [result] = await db
      .insert(subscriptionSettingsTable)
      .values(updateData)
      .returning();
  }

  res.json(result);
});

// List subscription requests
router.get("/subscriptions/requests", requireAuth, requireSystemOwner, async (req, res): Promise<void> => {
  const requests = await db
    .select({
      request: subscriptionRequestsTable,
      clinicName: clinicsTable.name,
    })
    .from(subscriptionRequestsTable)
    .innerJoin(clinicsTable, eq(clinicsTable.id, subscriptionRequestsTable.clinicId))
    .orderBy(desc(subscriptionRequestsTable.submittedAt));

  const result = requests.map(r => ({
    ...r.request,
    clinicName: r.clinicName,
  }));

  res.json(result);
});

// Approve subscription request
router.post("/subscriptions/requests/:requestId/approve", requireAuth, requireSystemOwner, async (req: any, res): Promise<void> => {
  const requestId = Number(req.params.requestId);
  if (isNaN(requestId)) {
    res.status(400).json({ error: "Invalid request ID" });
    return;
  }

  const [request] = await db
    .select()
    .from(subscriptionRequestsTable)
    .where(eq(subscriptionRequestsTable.id, requestId));

  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  // Update request status to Approved
  await db
    .update(subscriptionRequestsTable)
    .set({ status: "Approved" })
    .where(eq(subscriptionRequestsTable.id, requestId));

  // Determine expiration date
  const now = new Date();
  let durationDays = 30;
  if (request.planType === "Quarterly") durationDays = 90;
  if (request.planType === "Yearly") durationDays = 365;

  const [clinic] = await db
    .select()
    .from(clinicsTable)
    .where(eq(clinicsTable.id, request.clinicId));

  const currentExpiry = clinic && clinic.expiryDate ? new Date(clinic.expiryDate) : new Date();
  const baseDate = currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

  // Activate clinic subscription
  await db
    .update(clinicsTable)
    .set({
      planType: request.planType,
      subscriptionStatus: "Active",
      startDate: now,
      expiryDate: newExpiry,
    })
    .where(eq(clinicsTable.id, request.clinicId));

  // Record audit log
  await db.insert(auditLogsTable).values({
    action: "Payment Approved",
    userId: req.session.userId,
    details: `Approved request ${requestId} for clinic ${request.clinicId}. Plan: ${request.planType}. New expiry: ${newExpiry.toISOString()}`,
  });

  res.json({ success: true, message: "Payment Approved. Subscription Activated Successfully." });
});

// Reject subscription request
router.post("/subscriptions/requests/:requestId/reject", requireAuth, requireSystemOwner, async (req: any, res): Promise<void> => {
  const requestId = Number(req.params.requestId);
  if (isNaN(requestId)) {
    res.status(400).json({ error: "Invalid request ID" });
    return;
  }

  const [request] = await db
    .select()
    .from(subscriptionRequestsTable)
    .where(eq(subscriptionRequestsTable.id, requestId));

  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  // Update request status to Rejected
  await db
    .update(subscriptionRequestsTable)
    .set({ status: "Rejected" })
    .where(eq(subscriptionRequestsTable.id, requestId));

  // Update clinic status to Rejected
  await db
    .update(clinicsTable)
    .set({ subscriptionStatus: "Rejected" })
    .where(eq(clinicsTable.id, request.clinicId));

  // Record audit log
  await db.insert(auditLogsTable).values({
    action: "Payment Rejected",
    userId: req.session.userId,
    details: `Rejected request ${requestId} for clinic ${request.clinicId}`,
  });

  res.json({ success: true, message: "Payment proof could not be verified. Status: Rejected." });
});

// Activate Subscription Manually
router.post("/subscriptions/clinics/:clinicId/activate", requireAuth, requireSystemOwner, async (req: any, res): Promise<void> => {
  const clinicId = Number(req.params.clinicId);
  const { planType, startDate, expiryDate } = req.body ?? {};

  if (isNaN(clinicId) || !planType || !startDate || !expiryDate) {
    res.status(400).json({ error: "Clinic ID, plan type, start date, and expiry date are required" });
    return;
  }

  await db
    .update(clinicsTable)
    .set({
      planType,
      subscriptionStatus: "Active",
      startDate: new Date(startDate),
      expiryDate: new Date(expiryDate),
    })
    .where(eq(clinicsTable.id, clinicId));

  await db.insert(auditLogsTable).values({
    action: "Subscription Activated",
    userId: req.session.userId,
    details: `Activated subscription for clinic ${clinicId}. Plan: ${planType}, Expiry: ${expiryDate}`,
  });

  res.json({ success: true, message: "Subscription activated successfully" });
});

// Extend Subscription
router.post("/subscriptions/clinics/:clinicId/extend", requireAuth, requireSystemOwner, async (req: any, res): Promise<void> => {
  const clinicId = Number(req.params.clinicId);
  const { days } = req.body ?? {};

  if (isNaN(clinicId) || typeof days !== "number") {
    res.status(400).json({ error: "Clinic ID and number of days to extend are required" });
    return;
  }

  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
  if (!clinic) {
    res.status(404).json({ error: "Clinic not found" });
    return;
  }

  const now = new Date();
  const currentExpiry = clinic.expiryDate ? new Date(clinic.expiryDate) : now;
  const baseDate = currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

  await db
    .update(clinicsTable)
    .set({
      expiryDate: newExpiry,
      subscriptionStatus: clinic.planType === "Demo" ? "Trial" : "Active",
    })
    .where(eq(clinicsTable.id, clinicId));

  await db.insert(auditLogsTable).values({
    action: "Plan Extended",
    userId: req.session.userId,
    details: `Extended subscription for clinic ${clinicId} by ${days} days. New expiry: ${newExpiry.toISOString()}`,
  });

  res.json({ success: true, message: "Subscription extended successfully", newExpiry });
});

// Change Plan
router.post("/subscriptions/clinics/:clinicId/change-plan", requireAuth, requireSystemOwner, async (req: any, res): Promise<void> => {
  const clinicId = Number(req.params.clinicId);
  const { planType } = req.body ?? {};

  if (isNaN(clinicId) || !planType) {
    res.status(400).json({ error: "Clinic ID and plan type are required" });
    return;
  }

  // Calculate new duration
  let durationDays = 30;
  if (planType === "Quarterly") durationDays = 90;
  if (planType === "Yearly") durationDays = 365;

  const now = new Date();
  const newExpiry = planType === "Lifetime" ? null : new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const status = planType === "Lifetime" ? "Lifetime" : (planType === "Demo" ? "Trial" : "Active");

  await db
    .update(clinicsTable)
    .set({
      planType,
      subscriptionStatus: status,
      expiryDate: newExpiry,
    })
    .where(eq(clinicsTable.id, clinicId));

  await db.insert(auditLogsTable).values({
    action: "Plan Changed",
    userId: req.session.userId,
    details: `Changed plan for clinic ${clinicId} to ${planType}`,
  });

  res.json({ success: true, message: `Plan changed successfully to ${planType}` });
});

// Make Lifetime
router.post("/subscriptions/clinics/:clinicId/make-lifetime", requireAuth, requireSystemOwner, async (req: any, res): Promise<void> => {
  const clinicId = Number(req.params.clinicId);
  if (isNaN(clinicId)) {
    res.status(400).json({ error: "Invalid clinic ID" });
    return;
  }

  await db
    .update(clinicsTable)
    .set({
      planType: "Lifetime",
      subscriptionStatus: "Lifetime",
      expiryDate: null,
    })
    .where(eq(clinicsTable.id, clinicId));

  await db.insert(auditLogsTable).values({
    action: "Lifetime Granted",
    userId: req.session.userId,
    details: `Granted lifetime access to clinic ${clinicId}`,
  });

  res.json({ success: true, message: "Clinic subscription set to Lifetime successfully" });
});

// Suspend Clinic
router.post("/subscriptions/clinics/:clinicId/suspend", requireAuth, requireSystemOwner, async (req: any, res): Promise<void> => {
  const clinicId = Number(req.params.clinicId);
  if (isNaN(clinicId)) {
    res.status(400).json({ error: "Invalid clinic ID" });
    return;
  }

  await db
    .update(clinicsTable)
    .set({ subscriptionStatus: "Suspended" })
    .where(eq(clinicsTable.id, clinicId));

  await db.insert(auditLogsTable).values({
    action: "Clinic Suspended",
    userId: req.session.userId,
    details: `Suspended clinic ${clinicId}`,
  });

  res.json({ success: true, message: "Clinic suspended successfully" });
});

// Expire Now (Testing Action)
router.post("/subscriptions/clinics/:clinicId/expire-now", requireAuth, requireSystemOwner, async (req: any, res): Promise<void> => {
  const clinicId = Number(req.params.clinicId);
  if (isNaN(clinicId)) {
    res.status(400).json({ error: "Clinic subscription record not found." });
    return;
  }

  // Fetch the latest clinic/subscription record and validate
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
  if (!clinic) {
    res.status(404).json({ error: "Unable to locate clinic record." });
    return;
  }

  if (!clinic.id) {
    res.status(404).json({ error: "Unable to locate clinic record." });
    return;
  }

  if (!clinic.subscriptionStatus) {
    res.status(404).json({ error: "Clinic subscription record not found." });
    return;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await db
    .update(clinicsTable)
    .set({
      subscriptionStatus: "Expired",
      expiryDate: yesterday,
    })
    .where(eq(clinicsTable.id, clinicId));

  res.json({ success: true, message: "Clinic subscription expired instantly for testing" });
});

// Login As Clinic (Impersonation)
router.post("/subscriptions/clinics/:clinicId/impersonate", requireAuth, requireSystemOwner, async (req: any, res): Promise<void> => {
  const clinicId = Number(req.params.clinicId);
  if (isNaN(clinicId)) {
    res.status(400).json({ error: "Invalid clinic ID" });
    return;
  }

  const [targetClinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
  if (!targetClinic) {
    res.status(404).json({ error: "Target clinic not found" });
    return;
  }

  // Find target clinic's admin user to log in as
  const [targetUser] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.clinicId, clinicId), eq(usersTable.role, "admin")));

  if (!targetUser) {
    res.status(404).json({ error: "Target clinic admin user not found to impersonate" });
    return;
  }

  // Save current system owner session
  req.session.originalSystemOwnerUserId = req.session.userId;
  req.session.originalUserId = req.session.userId;
  req.session.originalClinicId = req.session.clinicId;
  req.session.originalRole = req.session.role;

  // Set impersonated clinic session details
  req.session.clinicId = clinicId;
  req.session.userId = targetUser.id;
  req.session.role = "admin";

  await new Promise<void>((resolve, reject) => {
    req.session.save((err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Record audit log entry
  await db.insert(auditLogsTable).values({
    action: "Login As Clinic Used",
    userId: req.session.originalSystemOwnerUserId,
    details: `System Owner impersonating clinic ${clinicId} (${targetClinic.name})`,
  });

  res.json({ success: true, clinicId, clinicName: targetClinic.name });
});

// Stop Impersonation (Return to System Owner)
router.post("/subscriptions/stop-impersonation", requireAuth, async (req: any, res): Promise<void> => {
  if (!req.session.originalUserId || !req.session.originalSystemOwnerUserId) {
    res.status(400).json({ error: "No active impersonation session found" });
    return;
  }

  const originalUserId = req.session.originalUserId;
  const originalClinicId = req.session.originalClinicId;
  const originalRole = req.session.originalRole;

  // Restore session
  req.session.userId = originalUserId;
  req.session.clinicId = originalClinicId;
  req.session.role = originalRole;

  // Clear original variables
  req.session.originalUserId = undefined;
  req.session.originalSystemOwnerUserId = undefined;
  req.session.originalClinicId = undefined;
  req.session.originalRole = undefined;

  await new Promise<void>((resolve, reject) => {
    req.session.save((err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });

  res.json({ success: true, clinicId: originalClinicId });
});

// Get Audit Logs
router.get("/subscriptions/audit-logs", requireAuth, requireSystemOwner, async (req, res): Promise<void> => {
  const logs = await db
    .select({
      log: auditLogsTable,
      userEmail: usersTable.email,
    })
    .from(auditLogsTable)
    .innerJoin(usersTable, eq(usersTable.id, auditLogsTable.userId))
    .orderBy(desc(auditLogsTable.createdAt));

  const result = logs.map(l => ({
    ...l.log,
    userEmail: l.userEmail,
  }));

  res.json(result);
});

export default router;
