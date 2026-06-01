import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, appointmentsTable } from "@workspace/db";
import {
  ListAppointmentsParams,
  ListAppointmentsResponse,
  CreateAppointmentParams,
  CreateAppointmentBody,
  GetAppointmentParams,
  GetAppointmentResponse,
  UpdateAppointmentStatusParams,
  UpdateAppointmentStatusBody,
  UpdateAppointmentStatusResponse,
  DeleteAppointmentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeAppt(a: Record<string, unknown>) {
  return { ...a, createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt };
}

router.get("/clinics/:clinicId/appointments", async (req, res): Promise<void> => {
  const params = ListAppointmentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const appointments = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.clinicId, params.data.clinicId))
    .orderBy(appointmentsTable.createdAt);

  res.json(ListAppointmentsResponse.parse(appointments.map(serializeAppt)));
});

router.post("/clinics/:clinicId/appointments", async (req, res): Promise<void> => {
  const params = CreateAppointmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [appointment] = await db
    .insert(appointmentsTable)
    .values({ ...parsed.data, clinicId: params.data.clinicId })
    .returning();

  res.status(201).json(GetAppointmentResponse.parse(serializeAppt(appointment)));
});

router.get("/clinics/:clinicId/appointments/:appointmentId", async (req, res): Promise<void> => {
  const params = GetAppointmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [appointment] = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.id, params.data.appointmentId),
        eq(appointmentsTable.clinicId, params.data.clinicId)
      )
    );

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  res.json(GetAppointmentResponse.parse(serializeAppt(appointment)));
});

router.patch("/clinics/:clinicId/appointments/:appointmentId", async (req, res): Promise<void> => {
  const params = UpdateAppointmentStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAppointmentStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [appointment] = await db
    .update(appointmentsTable)
    .set({ status: parsed.data.status })
    .where(
      and(
        eq(appointmentsTable.id, params.data.appointmentId),
        eq(appointmentsTable.clinicId, params.data.clinicId)
      )
    )
    .returning();

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  res.json(UpdateAppointmentStatusResponse.parse(serializeAppt(appointment)));
});

router.delete("/clinics/:clinicId/appointments/:appointmentId", async (req, res): Promise<void> => {
  const params = DeleteAppointmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [appointment] = await db
    .delete(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.id, params.data.appointmentId),
        eq(appointmentsTable.clinicId, params.data.clinicId)
      )
    )
    .returning();

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
