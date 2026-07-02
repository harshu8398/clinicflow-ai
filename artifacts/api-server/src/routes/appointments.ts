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

import { calculateAvailableSlots, parseTimeToDate, formatToLocalISO } from "../lib/scheduler";

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

  const valuesToInsert: any = {
    ...parsed.data,
    clinicId: params.data.clinicId,
  };

  // If a time slot is selected (manual appointments), auto-confirm it and validate availability
  if (parsed.data.selectedTimeSlot && parsed.data.appointmentDate) {
    const availableSlots = await calculateAvailableSlots(params.data.clinicId, parsed.data.appointmentDate);
    if (!availableSlots.includes(parsed.data.selectedTimeSlot)) {
      res.status(400).json({ error: "Selected time slot is not available" });
      return;
    }
    valuesToInsert.status = "confirmed";
  }

  let [appointment] = await db
    .insert(appointmentsTable)
    .values(valuesToInsert)
    .returning();

  // Google Calendar Integration for Manual Bookings
  if (appointment.selectedTimeSlot && appointment.appointmentDate && appointment.status === "confirmed") {
    const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, params.data.clinicId));
    if (clinic && clinic.googleConnected && clinic.googleCalendarId) {
      try {
        const startDate = parseTimeToDate(appointment.appointmentDate, appointment.selectedTimeSlot, "Asia/Kolkata");
        const endDate = new Date(startDate.getTime() + (clinic.slotDuration || 30) * 60 * 1000);

        const sourceLabel = appointment.appointmentSource === "Online" ? "AI" : "Admin";
        const descriptionLines = [
          `Appointment booked via ClinicFlow ${sourceLabel}.`,
          `Patient: ${appointment.patientName}`,
          `Phone: ${appointment.patientPhone}`,
          appointment.patientAge ? `Age: ${appointment.patientAge}` : null,
          appointment.patientGender ? `Gender: ${appointment.patientGender}` : null,
          appointment.visitType ? `Visit Type: ${appointment.visitType}` : null,
          appointment.patientProblem ? `Concern: ${appointment.patientProblem}` : null,
          appointment.notes ? `Notes: ${appointment.notes}` : null,
        ].filter(Boolean);

        const eventDetails = {
          summary: `Appointment: ${appointment.patientName}`,
          description: descriptionLines.join("\n"),
          start: formatToLocalISO(startDate, "Asia/Kolkata"),
          end: formatToLocalISO(endDate, "Asia/Kolkata"),
        };

        const token = await getValidAccessToken(clinic);
        const eventId = await createCalendarEvent(token, clinic.googleCalendarId, eventDetails);
        
        const [updated] = await db
          .update(appointmentsTable)
          .set({ calendarEventId: eventId })
          .where(eq(appointmentsTable.id, appointment.id))
          .returning();
        
        appointment = updated;
      } catch (err) {
        console.error("Failed to sync manual appointment with Google Calendar:", err);
      }
    }
  }

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

  const [existingAppt] = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.id, params.data.appointmentId),
        eq(appointmentsTable.clinicId, params.data.clinicId)
      )
    )
    .limit(1);

  if (!existingAppt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  const newDate = parsed.data.appointmentDate !== undefined ? parsed.data.appointmentDate : existingAppt.appointmentDate;
  const newSlot = parsed.data.selectedTimeSlot !== undefined ? parsed.data.selectedTimeSlot : existingAppt.selectedTimeSlot;

  if (
    newSlot && newDate &&
    (parsed.data.appointmentDate !== undefined || parsed.data.selectedTimeSlot !== undefined)
  ) {
    if (newDate !== existingAppt.appointmentDate || newSlot !== existingAppt.selectedTimeSlot) {
      const availableSlots = await calculateAvailableSlots(params.data.clinicId, newDate);
      if (!availableSlots.includes(newSlot)) {
        res.status(400).json({ error: "Selected time slot is not available" });
        return;
      }
    }
  }

  const updateFields: any = { status: parsed.data.status };
  if (parsed.data.appointmentDate !== undefined) {
    updateFields.appointmentDate = parsed.data.appointmentDate;
  }
  if (parsed.data.selectedTimeSlot !== undefined) {
    updateFields.selectedTimeSlot = parsed.data.selectedTimeSlot;
  }
  if (parsed.data.appointmentSource !== undefined) {
    updateFields.appointmentSource = parsed.data.appointmentSource;
  }
  if (parsed.data.patientAge !== undefined) {
    updateFields.patientAge = parsed.data.patientAge;
  }
  if (parsed.data.patientGender !== undefined) {
    updateFields.patientGender = parsed.data.patientGender;
  }
  if (parsed.data.visitType !== undefined) {
    updateFields.visitType = parsed.data.visitType;
  }
  if (parsed.data.notes !== undefined) {
    updateFields.notes = parsed.data.notes;
  }
  if (parsed.data.doctorId !== undefined) {
    updateFields.doctorId = parsed.data.doctorId;
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
        const startDate = parseTimeToDate(appointment.appointmentDate, appointment.selectedTimeSlot, "Asia/Kolkata");
        const endDate = new Date(startDate.getTime() + (clinic.slotDuration || 30) * 60 * 1000);

        const sourceLabel = appointment.appointmentSource === "Online" ? "AI" : "Admin";
        const descriptionLines = [
          `Appointment booked via ClinicFlow ${sourceLabel}.`,
          `Patient: ${appointment.patientName}`,
          `Phone: ${appointment.patientPhone}`,
          appointment.patientAge ? `Age: ${appointment.patientAge}` : null,
          appointment.patientGender ? `Gender: ${appointment.patientGender}` : null,
          appointment.visitType ? `Visit Type: ${appointment.visitType}` : null,
          appointment.patientProblem ? `Concern: ${appointment.patientProblem}` : null,
          appointment.notes ? `Notes: ${appointment.notes}` : null,
        ].filter(Boolean);

        const eventDetails = {
          summary: `Appointment: ${appointment.patientName}`,
          description: descriptionLines.join("\n"),
          start: formatToLocalISO(startDate, "Asia/Kolkata"),
          end: formatToLocalISO(endDate, "Asia/Kolkata"),
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
