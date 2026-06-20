import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, clinicsTable, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import {
  GetClinicParams,
  GetClinicResponse,
  UpdateClinicParams,
  UpdateClinicBody,
  UpdateClinicResponse,
  ListClinicsResponse,
  CreateClinicBody,
} from "@workspace/api-zod";
import { requireAuth, requireClinicOwnership } from "../middleware/auth";

const router: IRouter = Router();

import { calculateAvailableSlots } from "../lib/scheduler";

function serializeClinic(c: Record<string, unknown>) {
  let workingSessions: any[] = [];
  if (c.openingTime && typeof c.openingTime === "string" && c.openingTime.startsWith("[")) {
    try {
      workingSessions = JSON.parse(c.openingTime);
    } catch (e) {
      workingSessions = [];
    }
  }
  if (workingSessions.length === 0) {
    workingSessions = [
      { start: (c.openingTime as string) || "09:00", end: (c.closingTime as string) || "17:00" }
    ];
  }

  return {
    ...c,
    clinicName: c.name,
    contactEmail: c.email,
    consultationFee: c.fee,
    operatingTimings: c.timings,
    clinicLogo: c.logoUrl,
    clinicPhoneNumber: c.phone,
    workingSessions,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    googleTokenExpiresAt: c.googleTokenExpiresAt instanceof Date ? c.googleTokenExpiresAt.toISOString() : c.googleTokenExpiresAt,
    googleLastSyncAt: c.googleLastSyncAt instanceof Date ? c.googleLastSyncAt.toISOString() : c.googleLastSyncAt,
  };
}

router.get("/clinics", async (_req, res): Promise<void> => {
  const clinics = await db.select().from(clinicsTable).orderBy(clinicsTable.createdAt);
  res.json(ListClinicsResponse.parse(clinics.map(serializeClinic)));
});

router.post("/clinics", async (req, res): Promise<void> => {
  const parsed = CreateClinicBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const bodyData = { ...parsed.data } as any;

  const emailLower = (bodyData.email || "").toLowerCase().trim();
  if (emailLower) {
    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, emailLower));

    if (existingUser) {
      res.status(400).json({ error: "Email address is already in use by another clinic admin." });
      return;
    }

    // Check if clinic already exists with this email
    const [existingClinic] = await db
      .select()
      .from(clinicsTable)
      .where(eq(clinicsTable.email, emailLower));

    if (existingClinic) {
      res.status(400).json({ error: "A clinic with this email address is already registered." });
      return;
    }
  }

  const password = bodyData.password;
  delete bodyData.password;

  if (bodyData.clinicName !== undefined) {
    bodyData.name = bodyData.clinicName;
    delete bodyData.clinicName;
  }
  if (bodyData.contactEmail !== undefined) {
    bodyData.email = bodyData.contactEmail;
    delete bodyData.contactEmail;
  }
  if (bodyData.consultationFee !== undefined) {
    bodyData.fee = bodyData.consultationFee;
    delete bodyData.consultationFee;
  }
  if (bodyData.operatingTimings !== undefined) {
    bodyData.timings = bodyData.operatingTimings;
    delete bodyData.operatingTimings;
  }
  if (bodyData.clinicLogo !== undefined) {
    bodyData.logoUrl = bodyData.clinicLogo;
    delete bodyData.clinicLogo;
  }
  if (bodyData.clinicPhoneNumber !== undefined) {
    bodyData.phone = bodyData.clinicPhoneNumber;
    delete bodyData.clinicPhoneNumber;
  }
  if (bodyData.workingSessions !== undefined) {
    const sessions = bodyData.workingSessions;
    bodyData.openingTime = JSON.stringify(sessions);
    bodyData.closingTime = sessions[sessions.length - 1]?.end || "17:00";
    delete bodyData.workingSessions;
  }

  const [clinic] = await db.insert(clinicsTable).values(bodyData).returning();

  if (password && emailLower) {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(usersTable).values({
      clinicId: clinic.id,
      email: emailLower,
      passwordHash,
      role: "admin",
    });
  }

  res.status(201).json(GetClinicResponse.parse(serializeClinic(clinic)));
});

router.get("/clinics/:clinicId", async (req, res): Promise<void> => {
  const params = GetClinicParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, params.data.clinicId));
  if (!clinic) {
    res.status(404).json({ error: "Clinic not found" });
    return;
  }

  res.json(GetClinicResponse.parse(serializeClinic(clinic)));
});

router.put("/clinics/:clinicId", requireAuth, requireClinicOwnership, async (req, res): Promise<void> => {
  const params = UpdateClinicParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateClinicBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const bodyData = { ...parsed.data } as any;

  if (bodyData.clinicName !== undefined) {
    bodyData.name = bodyData.clinicName;
    delete bodyData.clinicName;
  }
  if (bodyData.contactEmail !== undefined) {
    bodyData.email = bodyData.contactEmail;
    delete bodyData.contactEmail;
  }
  if (bodyData.consultationFee !== undefined) {
    bodyData.fee = bodyData.consultationFee;
    delete bodyData.consultationFee;
  }
  if (bodyData.operatingTimings !== undefined) {
    bodyData.timings = bodyData.operatingTimings;
    delete bodyData.operatingTimings;
  }
  if (bodyData.clinicLogo !== undefined) {
    bodyData.logoUrl = bodyData.clinicLogo;
    delete bodyData.clinicLogo;
  }
  if (bodyData.clinicPhoneNumber !== undefined) {
    bodyData.phone = bodyData.clinicPhoneNumber;
    delete bodyData.clinicPhoneNumber;
  }
  if (bodyData.workingSessions !== undefined) {
    const sessions = bodyData.workingSessions;
    bodyData.openingTime = JSON.stringify(sessions);
    bodyData.closingTime = sessions[sessions.length - 1]?.end || "17:00";
    delete bodyData.workingSessions;
  }

  const [clinic] = await db
    .update(clinicsTable)
    .set(bodyData)
    .where(eq(clinicsTable.id, params.data.clinicId))
    .returning();

  if (!clinic) {
    res.status(404).json({ error: "Clinic not found" });
    return;
  }

  res.json(UpdateClinicResponse.parse(serializeClinic(clinic)));
});

router.get("/clinics/:clinicId/slots", async (req, res): Promise<void> => {
  const clinicId = Number(req.params.clinicId);
  const dateStr = req.query.date as string;

  if (isNaN(clinicId) || !dateStr) {
    res.status(400).json({ error: "Invalid clinic ID or missing date query parameter" });
    return;
  }

  try {
    const slots = await calculateAvailableSlots(clinicId, dateStr);
    res.json(slots);
  } catch (err: any) {
    console.error("Failed to calculate available slots:", err);
    res.status(500).json({ error: err.message || "Failed to calculate available slots" });
  }
});

export default router;
