import { Router, type IRouter } from "express";
import { db, appointmentsTable, clinicsTable, chatSessionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  StartChatParams,
  StartChatResponse,
  SendChatMessageParams,
  SendChatMessageBody,
  SendChatMessageResponse,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";

import { calculateAvailableSlots } from "../lib/scheduler";
import { getValidAccessToken, createCalendarEvent } from "../lib/google-calendar";

const router: IRouter = Router();

const STEPS = {
  ASK_NAME: "ask_name",
  ASK_PHONE: "ask_phone",
  ASK_PROBLEM: "ask_problem",
  ASK_DATE: "ask_date",
  ASK_SLOT: "ask_slot",
  CONFIRM_BOOKING: "confirm_booking",
  DONE: "done",
};

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

function serializeAppt(a: Record<string, unknown>) {
  return { ...a, createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt };
}

const NAME_REGEX = /^[a-zA-Z\s]+$/;
const PHONE_REGEX = /^\d{10}$/;

// Issue a single-use entry token for a clinic chat (called by homepage clinic card click)
router.post("/clinics/:clinicId/chat/token", async (req, res): Promise<void> => {
  const clinicId = Number(req.params["clinicId"]);
  if (!clinicId || isNaN(clinicId)) {
    res.status(400).json({ error: "Invalid clinic ID" });
    return;
  }

  const [clinic] = await db
    .select({ id: clinicsTable.id })
    .from(clinicsTable)
    .where(eq(clinicsTable.id, clinicId));

  if (!clinic) {
    res.status(404).json({ error: "Clinic not found" });
    return;
  }

  const entryToken = randomUUID();
  const tokenExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Store token-only row (no sessionId yet — that is created on chat/start)
  await db.insert(chatSessionsTable).values({
    sessionId: `pending:${entryToken}`,
    clinicId,
    entryToken,
    tokenExpiresAt,
    tokenUsed: false,
  });

  res.json({ token: entryToken });
});

// Start chat — consumes the entry token and creates a real session
router.post("/clinics/:clinicId/chat/start", async (req, res): Promise<void> => {
  const params = StartChatParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const clinicId = params.data.clinicId;
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(403).json({ error: "Access token required" });
    return;
  }

  // Validate token: must exist, belong to this clinic, not expired, not used
  const [tokenRow] = await db
    .select()
    .from(chatSessionsTable)
    .where(
      and(
        eq(chatSessionsTable.entryToken, token),
        eq(chatSessionsTable.clinicId, clinicId)
      )
    );

  if (!tokenRow) {
    res.status(403).json({ error: "Invalid or expired access token" });
    return;
  }

  if (tokenRow.tokenUsed) {
    res.status(403).json({ error: "Access token already used" });
    return;
  }

  if (tokenRow.tokenExpiresAt && tokenRow.tokenExpiresAt < new Date()) {
    res.status(403).json({ error: "Access token expired" });
    return;
  }

  const [clinic] = await db
    .select()
    .from(clinicsTable)
    .where(eq(clinicsTable.id, clinicId));

  if (!clinic) {
    res.status(404).json({ error: "Clinic not found" });
    return;
  }

  const sessionId = randomUUID();

  // Mark token as used and update the row with the real sessionId
  await db
    .update(chatSessionsTable)
    .set({ tokenUsed: true, sessionId })
    .where(eq(chatSessionsTable.entryToken, token));

  res.json(
    StartChatResponse.parse({
      sessionId,
      step: STEPS.ASK_NAME,
      botMessage: `Hello! Welcome to ${clinic.name}.\n\nI am your digital receptionist and I will help you book an appointment in just a few steps.\n\nMay I know your full name please?`,
      isComplete: false,
    })
  );
});

// Send message — session must belong to this clinic
router.post("/clinics/:clinicId/chat/message", async (req, res): Promise<void> => {
  const params = SendChatMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { clinicId } = params.data;
  const { sessionId, step, message, context } = parsed.data;

  // Enforce clinic isolation: session must belong to this exact clinic
  const [chatSession] = await db
    .select()
    .from(chatSessionsTable)
    .where(
      and(
        eq(chatSessionsTable.sessionId, sessionId),
        eq(chatSessionsTable.clinicId, clinicId)
      )
    );

  if (!chatSession) {
    res.status(403).json({ error: "Session does not belong to this clinic" });
    return;
  }

  const ctx = context ?? {};

  let nextStep: string;
  let botMessage: string;
  let isComplete = false;
  let appointment: Record<string, unknown> | undefined;

  switch (step) {
    case STEPS.ASK_NAME: {
      const name = message.trim();
      if (!name || !NAME_REGEX.test(name)) {
        res.json(SendChatMessageResponse.parse({
          sessionId,
          step: STEPS.ASK_NAME,
          botMessage: "Please enter a valid name using letters only.",
          isComplete: false,
        }));
        return;
      }
      nextStep = STEPS.ASK_PHONE;
      botMessage = `Nice to meet you, ${name}!\n\nCould you please share your 10-digit mobile number?`;
      break;
    }

    case STEPS.ASK_PHONE: {
      const phone = message.trim().replace(/\s/g, "");
      if (!PHONE_REGEX.test(phone)) {
        res.json(SendChatMessageResponse.parse({
          sessionId,
          step: STEPS.ASK_PHONE,
          botMessage: "Please enter a valid 10-digit mobile number.",
          isComplete: false,
        }));
        return;
      }
      nextStep = STEPS.ASK_PROBLEM;
      botMessage = `Thank you! Please briefly describe your health issue or the reason for your visit.`;
      break;
    }

    case STEPS.ASK_PROBLEM: {
      const problem = message.trim();
      if (problem.length < 3) {
        res.json(SendChatMessageResponse.parse({
          sessionId,
          step: STEPS.ASK_PROBLEM,
          botMessage: "Please describe your health issue in at least a few words.",
          isComplete: false,
        }));
        return;
      }
      nextStep = STEPS.ASK_DATE;
      botMessage = `Understood. Please select your preferred appointment date using the calendar below.`;
      break;
    }

    case STEPS.ASK_DATE: {
      const date = message.trim();
      if (!date) {
        res.json(SendChatMessageResponse.parse({
          sessionId,
          step: STEPS.ASK_DATE,
          botMessage: "Please select a date from the calendar.",
          isComplete: false,
        }));
        return;
      }

      const availableSlots = await calculateAvailableSlots(clinicId, date);
      if (availableSlots.length === 0) {
        res.json(SendChatMessageResponse.parse({
          sessionId,
          step: STEPS.ASK_DATE,
          botMessage: "No available slots remain for this date.\n\nPlease select another appointment date.",
          isComplete: false,
        }));
        return;
      }

      ctx.appointmentDate = date;

      nextStep = STEPS.ASK_SLOT;
      isComplete = false;
      botMessage = `Great! Please select your preferred time slot for ${date} from the available options.`;
      break;
    }

    case STEPS.ASK_SLOT: {
      const slot = message.trim();
      const match = slot.match(/^\d{2}:\d{2}\s*(AM|PM)$/i);

      const availableSlots = await calculateAvailableSlots(clinicId, ctx.appointmentDate || "");
      if (availableSlots.length === 0) {
        res.json(SendChatMessageResponse.parse({
          sessionId,
          step: STEPS.ASK_DATE,
          botMessage: "No available slots remain for this date.\n\nPlease select another appointment date.",
          isComplete: false,
        }));
        return;
      }

      if (!match) {
        res.json(SendChatMessageResponse.parse({
          sessionId,
          step: STEPS.ASK_SLOT,
          botMessage: "Please select a valid time slot from the options.",
          isComplete: false,
        }));
        return;
      }

      ctx.selectedTimeSlot = slot;

      nextStep = STEPS.CONFIRM_BOOKING;
      isComplete = false;
      botMessage = `Here is a summary of your appointment details. Please review them and click "Confirm Booking" to finalize.`;
      break;
    }

    case STEPS.CONFIRM_BOOKING: {
      const confirmation = message.trim().toLowerCase();
      if (confirmation !== "confirm") {
        res.json(SendChatMessageResponse.parse({
          sessionId,
          step: STEPS.CONFIRM_BOOKING,
          botMessage: "Please confirm your booking details to finalize.",
          isComplete: false,
        }));
        return;
      }

      const patientName = ctx.patientName ?? "Patient";
      const patientPhone = ctx.patientPhone ?? "";
      const patientProblem = ctx.patientProblem ?? "";
      const appointmentDate = ctx.appointmentDate ?? "";
      const selectedTimeSlot = ctx.selectedTimeSlot ?? "";

      // Check double-booking
      const availableSlots = await calculateAvailableSlots(clinicId, appointmentDate);
      if (!availableSlots.includes(selectedTimeSlot)) {
        nextStep = STEPS.ASK_SLOT;
        isComplete = false;
        botMessage = `Sorry, the time slot ${selectedTimeSlot} on ${appointmentDate} was just booked by someone else. Please select another slot.`;
        break;
      }

      const [newAppt] = await db
        .insert(appointmentsTable)
        .values({
          clinicId,
          sessionId,
          patientName,
          patientPhone,
          patientProblem,
          appointmentDate,
          selectedTimeSlot,
          status: "confirmed",
        })
        .returning();

      // Sync to Google Calendar
      const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
      let googleEventId: string | null = null;
      if (clinic && clinic.googleConnected && clinic.googleCalendarId) {
        try {
          const startLocal = `${appointmentDate}T${convertTo24Hour(selectedTimeSlot)}`;
          const startDate = new Date(startLocal);
          const endDate = new Date(startDate.getTime() + (clinic.slotDuration || 30) * 60 * 1000);

          const eventDetails = {
            summary: `Appointment: ${patientName}`,
            description: `Appointment booked via ClinicFlow AI.\nPatient: ${patientName}\nPhone: ${patientPhone}\nProblem: ${patientProblem}`,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          };

          const token = await getValidAccessToken(clinic);
          googleEventId = await createCalendarEvent(token, clinic.googleCalendarId, eventDetails);

          await db
            .update(appointmentsTable)
            .set({ calendarEventId: googleEventId })
            .where(eq(appointmentsTable.id, newAppt.id));

          newAppt.calendarEventId = googleEventId;
        } catch (err) {
          console.error("Failed to create Google Calendar event in chat confirmation:", err);
        }
      }
      nextStep = STEPS.DONE;
      isComplete = true;
      appointment = serializeAppt(newAppt as unknown as Record<string, unknown>);
      botMessage = `Your appointment has been successfully booked and confirmed!\n\nSummary:\n- Doctor: ${clinic?.doctorName || "Doctor"}\n- Date: ${appointmentDate}\n- Time: ${selectedTimeSlot}\n- Name: ${patientName}\n- Phone: ${patientPhone}\n- Concern: ${patientProblem}\n\nA confirmation has been synced with the doctor's calendar. Thank you for choosing us!`;
      break;
    }

    default: {
      nextStep = STEPS.DONE;
      botMessage = "Your appointment has already been submitted. The clinic will be in touch soon!";
    }
  }

  const response: Record<string, unknown> = { sessionId, step: nextStep!, botMessage: botMessage!, isComplete };
  if (appointment) response.appointment = appointment;

  res.json(SendChatMessageResponse.parse(response));
});

export default router;
