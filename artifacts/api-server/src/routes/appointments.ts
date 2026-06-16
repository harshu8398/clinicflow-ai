import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, appointmentsTable, clinicsTable, prescriptionsTable } from "@workspace/db";
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
import { requireAuth, requireClinicOwnership } from "../middleware/auth";
import {
  getValidAccessToken,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "../lib/google-calendar";

const router: IRouter = Router();

function serializeAppt(a: Record<string, unknown>) {
  return { ...a, createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt };
}

function convertTo24Hour(time12h: string): string {
  const [time, modifier] = time12h.split(" ");
  let [hours, minutes] = time.split(":");
  if (hours === "12") {
    hours = "00";
  }
  if (modifier === "PM") {
    hours = (parseInt(hours, 10) + 12).toString();
  }
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`;
}

router.get("/clinics/:clinicId/appointments", requireAuth, requireClinicOwnership, async (req, res): Promise<void> => {
  const params = ListAppointmentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const appointmentsWithPresc = await db
    .select({
      appointment: appointmentsTable,
      prescriptionId: prescriptionsTable.id,
    })
    .from(appointmentsTable)
    .leftJoin(prescriptionsTable, eq(prescriptionsTable.appointmentId, appointmentsTable.id))
    .where(eq(appointmentsTable.clinicId, params.data.clinicId))
    .orderBy(appointmentsTable.createdAt);

  const serialized = appointmentsWithPresc.map(({ appointment }) => serializeAppt(appointment));
  const parsed = ListAppointmentsResponse.parse(serialized);

  const result = parsed.map((appt, index) => ({
    ...appt,
    prescriptionGenerated: !!appointmentsWithPresc[index].prescriptionId,
  }));

  res.json(result);
});

router.post("/clinics/:clinicId/appointments", requireAuth, requireClinicOwnership, async (req, res): Promise<void> => {
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

router.get("/clinics/:clinicId/appointments/:appointmentId", requireAuth, requireClinicOwnership, async (req, res): Promise<void> => {
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

router.patch("/clinics/:clinicId/appointments/:appointmentId", requireAuth, requireClinicOwnership, async (req, res): Promise<void> => {
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

  const updateFields: any = { status: parsed.data.status };
  if (parsed.data.appointmentDate !== undefined) {
    updateFields.appointmentDate = parsed.data.appointmentDate;
  }
  if (parsed.data.selectedTimeSlot !== undefined) {
    updateFields.selectedTimeSlot = parsed.data.selectedTimeSlot;
  }

  const [appointment] = await db
    .update(appointmentsTable)
    .set(updateFields)
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

  // Google Calendar Integration
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, params.data.clinicId));
  if (clinic && clinic.googleConnected && clinic.googleCalendarId) {
    try {
      if (appointment.selectedTimeSlot && appointment.appointmentDate) {
        const startLocal = `${appointment.appointmentDate}T${convertTo24Hour(appointment.selectedTimeSlot)}`;
        const startDate = new Date(startLocal);
        const endDate = new Date(startDate.getTime() + (clinic.slotDuration || 30) * 60 * 1000);

        const eventDetails = {
          summary: `Appointment: ${appointment.patientName}`,
          description: `Appointment booked via ClinicFlow AI.\nPatient: ${appointment.patientName}\nPhone: ${appointment.patientPhone}\nProblem: ${appointment.patientProblem}`,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        };

        const token = await getValidAccessToken(clinic);

        if (appointment.calendarEventId) {
          if (appointment.status === "cancelled") {
            await deleteCalendarEvent(token, clinic.googleCalendarId, appointment.calendarEventId);
            await db
              .update(appointmentsTable)
              .set({ calendarEventId: null })
              .where(eq(appointmentsTable.id, appointment.id));
            appointment.calendarEventId = null;
          } else {
            await updateCalendarEvent(token, clinic.googleCalendarId, appointment.calendarEventId, eventDetails);
          }
        } else if (appointment.status !== "cancelled" && appointment.status !== "pending_slot_selection") {
          const eventId = await createCalendarEvent(token, clinic.googleCalendarId, eventDetails);
          await db
            .update(appointmentsTable)
            .set({ calendarEventId: eventId })
            .where(eq(appointmentsTable.id, appointment.id));
          appointment.calendarEventId = eventId;
        }
      }
    } catch (err) {
      console.error("Failed to sync appointment with Google Calendar:", err);
    }
  }

  res.json(UpdateAppointmentStatusResponse.parse(serializeAppt(appointment)));
});

router.delete("/clinics/:clinicId/appointments/:appointmentId", requireAuth, requireClinicOwnership, async (req, res): Promise<void> => {
  const params = DeleteAppointmentParams.safeParse(req.params);
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

  // Google Calendar Integration
  if (appointment.calendarEventId) {
    const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, params.data.clinicId));
    if (clinic && clinic.googleConnected && clinic.googleCalendarId) {
      try {
        const token = await getValidAccessToken(clinic);
        await deleteCalendarEvent(token, clinic.googleCalendarId, appointment.calendarEventId);
      } catch (err) {
        console.error("Failed to delete Google Calendar event for deleted appointment:", err);
      }
    }
  }

  await db
    .delete(appointmentsTable)
    .where(eq(appointmentsTable.id, params.data.appointmentId));

  res.sendStatus(204);
});

export default router;
