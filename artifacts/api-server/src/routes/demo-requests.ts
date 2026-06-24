import { Router, type IRouter } from "express";
import { db, demoRequestsTable } from "@workspace/db";
import { eq, or, ilike, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { sendDemoRequestEmail } from "../lib/email";

const router: IRouter = Router();

function requireSystemOwner(req: any, res: any, next: any) {
  const isSystemOwner = req.session.role === "system_owner" || req.session.originalRole === "system_owner";
  if (!isSystemOwner) {
    res.status(403).json({ error: "Access denied: System Owner only" });
    return;
  }
  next();
}

// POST /api/demo-requests (Public)
router.post("/demo-requests", async (req, res): Promise<void> => {
  const { fullName, clinicName, mobileNumber, email, city, notes } = req.body ?? {};

  if (!fullName || !clinicName || !mobileNumber || !email || !city) {
    res.status(400).json({ error: "Full Name, Clinic Name, Mobile Number, Email, and City are required." });
    return;
  }

  try {
    const [inserted] = await db
      .insert(demoRequestsTable)
      .values({
        fullName,
        clinicName,
        mobileNumber,
        email,
        city,
        notes: notes || null,
        status: "New",
      })
      .returning();

    // Send email notification to System Owner
    await sendDemoRequestEmail({
      fullName,
      clinicName,
      mobileNumber,
      email,
      city,
    });

    res.status(201).json({
      success: true,
      message: "We will contact you soon.",
      request: inserted,
    });
  } catch (err: any) {
    console.error("Demo request insert failed:", err);
    res.status(500).json({ error: "Failed to submit demo request" });
  }
});

// GET /api/demo-requests (Protected - System Owner only)
router.get("/demo-requests", requireAuth, requireSystemOwner, async (req, res): Promise<void> => {
  const { search, status } = req.query ?? {};

  try {
    // Compute global stats
    const allLeads = await db.select().from(demoRequestsTable);
    const total = allLeads.length;
    const newCount = allLeads.filter(l => l.status === "New").length;
    const contactedCount = allLeads.filter(l => l.status === "Contacted").length;
    const scheduledCount = allLeads.filter(l => l.status === "Demo Scheduled").length;
    const convertedCount = allLeads.filter(l => l.status === "Converted").length;
    const closedCount = allLeads.filter(l => l.status === "Closed").length;
    const conversionRate = total > 0 ? Number(((convertedCount / total) * 100).toFixed(2)) : 0;

    const stats = {
      total,
      newCount,
      contactedCount,
      scheduledCount,
      convertedCount,
      closedCount,
      conversionRate,
    };

    // Filtered results
    let conditions = [];
    if (status && typeof status === "string" && status !== "all") {
      conditions.push(eq(demoRequestsTable.status, status));
    }
    if (search && typeof search === "string" && search.trim() !== "") {
      const searchPattern = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(demoRequestsTable.fullName, searchPattern),
          ilike(demoRequestsTable.clinicName, searchPattern),
          ilike(demoRequestsTable.mobileNumber, searchPattern),
          ilike(demoRequestsTable.email, searchPattern)
        )
      );
    }

    const query = db.select().from(demoRequestsTable);
    const leads = await (conditions.length > 0 
      ? query.where(and(...conditions))
      : query
    ).orderBy(desc(demoRequestsTable.createdAt));

    res.json({
      leads: leads.map(l => ({
        ...l,
        createdAt: l.createdAt.toISOString()
      })),
      stats,
    });
  } catch (err: any) {
    console.error("Failed to load demo requests:", err);
    res.status(500).json({ error: "Failed to load demo requests" });
  }
});

// PATCH /api/demo-requests/:requestId/status (Protected - System Owner only)
router.patch("/demo-requests/:requestId/status", requireAuth, requireSystemOwner, async (req, res): Promise<void> => {
  const requestId = Number(req.params.requestId);
  const { status } = req.body ?? {};

  if (isNaN(requestId) || !status) {
    res.status(400).json({ error: "Request ID and status are required." });
    return;
  }

  const validStatuses = ["New", "Contacted", "Demo Scheduled", "Converted", "Closed"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "Invalid status value." });
    return;
  }

  try {
    const [updated] = await db
      .update(demoRequestsTable)
      .set({ status })
      .where(eq(demoRequestsTable.id, requestId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Demo request not found." });
      return;
    }

    res.json({ success: true, request: { ...updated, createdAt: updated.createdAt.toISOString() } });
  } catch (err: any) {
    console.error("Failed to update status:", err);
    res.status(500).json({ error: "Failed to update demo request status" });
  }
});

export default router;
