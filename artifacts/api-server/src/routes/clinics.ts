import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, clinicsTable, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
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
    doctorSignatureUrl: c.doctorSignatureUrl || null,
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

  const [existingClinic] = await db
    .select()
    .from(clinicsTable)
    .where(eq(clinicsTable.id, params.data.clinicId));

  if (!existingClinic) {
    res.status(404).json({ error: "Clinic not found" });
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

  if (bodyData.doctorSignatureUrl !== undefined) {
    if (bodyData.doctorSignatureUrl && bodyData.doctorSignatureUrl.startsWith("data:image/")) {
      const matches = bodyData.doctorSignatureUrl.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        res.status(400).json({ error: "Invalid signature image format" });
        return;
      }

      const ext = matches[1].toLowerCase();
      const allowedExtensions = ["png", "jpg", "jpeg", "webp"];
      if (!allowedExtensions.includes(ext)) {
        res.status(400).json({ error: "Supported signature file types are PNG, JPG, JPEG, or WEBP." });
        return;
      }

      const dataBuffer = Buffer.from(matches[2], "base64");
      if (dataBuffer.length > 2 * 1024 * 1024) {
        res.status(400).json({ error: "Signature image size must be smaller than 2MB." });
        return;
      }

      // Delete old signature file if it exists
      if (existingClinic.doctorSignatureUrl && existingClinic.doctorSignatureUrl.startsWith("/uploads/")) {
        const oldFilepath = path.join(process.cwd(), existingClinic.doctorSignatureUrl);
        if (fs.existsSync(oldFilepath)) {
          try {
            fs.unlinkSync(oldFilepath);
          } catch (e) {
            console.error("Failed to delete old signature:", e);
          }
        }
      }

      const filename = `signature-${params.data.clinicId}-${Date.now()}.${ext}`;
      const filepath = path.join(process.cwd(), "uploads", filename);
      if (!fs.existsSync(path.join(process.cwd(), "uploads"))) {
        fs.mkdirSync(path.join(process.cwd(), "uploads"), { recursive: true });
      }
      fs.writeFileSync(filepath, dataBuffer);
      bodyData.doctorSignatureUrl = `/uploads/${filename}`;
    } else if (!bodyData.doctorSignatureUrl) {
      // User removed the signature
      if (existingClinic.doctorSignatureUrl && existingClinic.doctorSignatureUrl.startsWith("/uploads/")) {
        const oldFilepath = path.join(process.cwd(), existingClinic.doctorSignatureUrl);
        if (fs.existsSync(oldFilepath)) {
          try {
            fs.unlinkSync(oldFilepath);
          } catch (e) {
            console.error("Failed to delete old signature:", e);
          }
        }
      }
      bodyData.doctorSignatureUrl = null;
    }
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
