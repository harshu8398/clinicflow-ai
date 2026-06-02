import { Router, type IRouter } from "express";
import { db, appointmentsTable, clinicsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  StartChatParams,
  StartChatResponse,
  SendChatMessageParams,
  SendChatMessageBody,
  SendChatMessageResponse,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const STEPS = {
  ASK_NAME: "ask_name",
  ASK_PHONE: "ask_phone",
  ASK_PROBLEM: "ask_problem",
  ASK_DATE: "ask_date",
  DONE: "done",
};

function serializeAppt(a: Record<string, unknown>) {
  return { ...a, createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt };
}

const NAME_REGEX = /^[a-zA-Z\s]+$/;
const PHONE_REGEX = /^\d{10}$/;

router.post("/clinics/:clinicId/chat/start", async (req, res): Promise<void> => {
  const params = StartChatParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [clinic] = await db
    .select()
    .from(clinicsTable)
    .where(eq(clinicsTable.id, params.data.clinicId));

  if (!clinic) {
    res.status(404).json({ error: "Clinic not found" });
    return;
  }

  const sessionId = randomUUID();

  res.json(
    StartChatResponse.parse({
      sessionId,
      step: STEPS.ASK_NAME,
      botMessage: `Hello! Welcome to ${clinic.name}.\n\nI am your digital receptionist and I will help you book an appointment in just a few steps.\n\nMay I know your full name please?`,
      isComplete: false,
    })
  );
});

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

      const patientName = ctx.patientName ?? "Patient";
      const patientPhone = ctx.patientPhone ?? "";
      const patientProblem = ctx.patientProblem ?? "";

      const [newAppt] = await db
        .insert(appointmentsTable)
        .values({
          clinicId,
          sessionId,
          patientName,
          patientPhone,
          patientProblem,
          appointmentDate: date,
          status: "pending_slot_selection",
        })
        .returning();

      nextStep = STEPS.DONE;
      isComplete = true;
      appointment = serializeAppt(newAppt as unknown as Record<string, unknown>);
      botMessage = `Your appointment request has been submitted successfully!\n\nSummary:\n- Name: ${patientName}\n- Phone: ${patientPhone}\n- Concern: ${patientProblem}\n- Preferred Date: ${date}\n\nThe clinic team will confirm your slot shortly. Thank you for choosing us!`;
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
