import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, clinicsTable } from "@workspace/db";
import {
  GetClinicParams,
  GetClinicResponse,
  UpdateClinicParams,
  UpdateClinicBody,
  UpdateClinicResponse,
  ListClinicsResponse,
  CreateClinicBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeClinic(c: Record<string, unknown>) {
  return { ...c, createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt };
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

  const [clinic] = await db.insert(clinicsTable).values(parsed.data).returning();
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

router.put("/clinics/:clinicId", async (req, res): Promise<void> => {
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

  const [clinic] = await db
    .update(clinicsTable)
    .set(parsed.data)
    .where(eq(clinicsTable.id, params.data.clinicId))
    .returning();

  if (!clinic) {
    res.status(404).json({ error: "Clinic not found" });
    return;
  }

  res.json(UpdateClinicResponse.parse(serializeClinic(clinic)));
});

export default router;
