import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, blockedSlotsTable } from "@workspace/db";
import { requireAuth, requireClinicOwnership } from "../middleware/auth";
import { z } from "zod/v4";

const router: IRouter = Router();

function serializeSlot(s: any) {
  return {
    ...s,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt
  };
}

// GET /clinics/:clinicId/blocked-slots
router.get("/clinics/:clinicId/blocked-slots", requireAuth, requireClinicOwnership, async (req, res): Promise<void> => {
  const clinicId = Number(req.params.clinicId);
  if (isNaN(clinicId)) {
    res.status(400).json({ error: "Invalid clinic ID" });
    return;
  }

  try {
    const slots = await db
      .select()
      .from(blockedSlotsTable)
      .where(eq(blockedSlotsTable.clinicId, clinicId))
      .orderBy(blockedSlotsTable.date);

    res.json(slots.map(serializeSlot));
  } catch (err) {
    console.error("Failed to list blocked slots:", err);
    res.status(500).json({ error: "Failed to list blocked slots" });
  }
});

// POST /clinics/:clinicId/blocked-slots
router.post("/clinics/:clinicId/blocked-slots", requireAuth, requireClinicOwnership, async (req, res): Promise<void> => {
  const clinicId = Number(req.params.clinicId);
  if (isNaN(clinicId)) {
    res.status(400).json({ error: "Invalid clinic ID" });
    return;
  }

  const { doctorId, date, startTime, endTime, reason } = req.body ?? {};

  if (!date || !startTime || !endTime) {
    res.status(400).json({ error: "Date, startTime, and endTime are required" });
    return;
  }

  try {
    const [blockedSlot] = await db
      .insert(blockedSlotsTable)
      .values({
        clinicId,
        doctorId: doctorId ? Number(doctorId) : null,
        date,
        startTime,
        endTime,
        reason: reason || null,
      })
      .returning();

    res.status(201).json(serializeSlot(blockedSlot));
  } catch (err) {
    console.error("Failed to create blocked slot:", err);
    res.status(500).json({ error: "Failed to create blocked slot" });
  }
});

// DELETE /clinics/:clinicId/blocked-slots/:id
router.delete("/clinics/:clinicId/blocked-slots/:id", requireAuth, requireClinicOwnership, async (req, res): Promise<void> => {
  const clinicId = Number(req.params.clinicId);
  const id = Number(req.params.id);

  if (isNaN(clinicId) || isNaN(id)) {
    res.status(400).json({ error: "Invalid clinic ID or slot ID" });
    return;
  }

  try {
    const [deleted] = await db
      .delete(blockedSlotsTable)
      .where(
        and(
          eq(blockedSlotsTable.id, id),
          eq(blockedSlotsTable.clinicId, clinicId)
        )
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Blocked slot not found" });
      return;
    }

    res.sendStatus(204);
  } catch (err) {
    console.error("Failed to delete blocked slot:", err);
    res.status(500).json({ error: "Failed to delete blocked slot" });
  }
});

export default router;
