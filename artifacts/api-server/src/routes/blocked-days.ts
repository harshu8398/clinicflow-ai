import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, blockedDaysTable } from "@workspace/db";
import { requireAuth, requireClinicOwnership } from "../middleware/auth";

const router: IRouter = Router();

function serializeDay(d: any) {
  return {
    ...d,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt
  };
}

// GET /clinics/:clinicId/blocked-days
router.get("/clinics/:clinicId/blocked-days", requireAuth, requireClinicOwnership, async (req, res): Promise<void> => {
  const clinicId = Number(req.params.clinicId);
  if (isNaN(clinicId)) {
    res.status(400).json({ error: "Invalid clinic ID" });
    return;
  }

  try {
    const days = await db
      .select()
      .from(blockedDaysTable)
      .where(eq(blockedDaysTable.clinicId, clinicId))
      .orderBy(blockedDaysTable.date);

    res.json(days.map(serializeDay));
  } catch (err) {
    console.error("Failed to list blocked days:", err);
    res.status(500).json({ error: "Failed to list blocked days" });
  }
});

// POST /clinics/:clinicId/blocked-days
router.post("/clinics/:clinicId/blocked-days", requireAuth, requireClinicOwnership, async (req, res): Promise<void> => {
  const clinicId = Number(req.params.clinicId);
  if (isNaN(clinicId)) {
    res.status(400).json({ error: "Invalid clinic ID" });
    return;
  }

  const { doctorId, date, reason } = req.body ?? {};

  if (!date) {
    res.status(400).json({ error: "Date is required" });
    return;
  }

  try {
    const [blockedDay] = await db
      .insert(blockedDaysTable)
      .values({
        clinicId,
        doctorId: doctorId ? Number(doctorId) : null,
        date,
        reason: reason || null,
      })
      .returning();

    res.status(201).json(serializeDay(blockedDay));
  } catch (err) {
    console.error("Failed to create blocked day:", err);
    res.status(500).json({ error: "Failed to create blocked day" });
  }
});

// DELETE /clinics/:clinicId/blocked-days/:id
router.delete("/clinics/:clinicId/blocked-days/:id", requireAuth, requireClinicOwnership, async (req, res): Promise<void> => {
  const clinicId = Number(req.params.clinicId);
  const id = Number(req.params.id);

  if (isNaN(clinicId) || isNaN(id)) {
    res.status(400).json({ error: "Invalid clinic ID or day ID" });
    return;
  }

  try {
    const [deleted] = await db
      .delete(blockedDaysTable)
      .where(
        and(
          eq(blockedDaysTable.id, id),
          eq(blockedDaysTable.clinicId, clinicId)
        )
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Blocked day not found" });
      return;
    }

    res.sendStatus(204);
  } catch (err) {
    console.error("Failed to delete blocked day:", err);
    res.status(500).json({ error: "Failed to delete blocked day" });
  }
});

export default router;
