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
      botMessage: `Hello! Welcome to ${clinic.name}. I am your digital receptionist, here to help you book an appointment.\n\nMay I know your full name please?`,
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
      if (!name) {
        res.json(SendChatMessageResponse.parse({ sessionId, step: STEPS.ASK_NAME, botMessage: "I did not catch that. Could you please tell me your full name?", isComplete: false }));
        return;
      }
      nextStep = STEPS.ASK_PHONE;
      botMessage = `Nice to meet you, ${name}! Could you please share your phone number?`;
      break;
    }

    case STEPS.ASK_PHONE: {
      const phone = message.trim();
      if (!phone) {
        res.json(SendChatMessageResponse.parse({ sessionId, step: STEPS.ASK_PHONE, botMessage: "Please enter a valid phone number.", isComplete: false }));
        return;
      }
      nextStep = STEPS.ASK_PROBLEM;
      botMessage = `Thank you! What health concern or problem are you visiting for?`;
      break;
    }

    case STEPS.ASK_PROBLEM: {
      const problem = message.trim();
      if (!problem) {
        res.json(SendChatMessageResponse.parse({ sessionId, step: STEPS.ASK_PROBLEM, botMessage: "Please describe your health concern briefly.", isComplete: false }));
        return;
      }
      nextStep = STEPS.ASK_DATE;
      botMessage = `Understood. What is your preferred appointment date? (e.g. 2026-06-15)`;
      break;
    }

    case STEPS.ASK_DATE: {
      const date = message.trim();
      if (!date) {
        res.json(SendChatMessageResponse.parse({ sessionId, step: STEPS.ASK_DATE, botMessage: "Please provide a preferred appointment date.", isComplete: false }));
        return;
      }

      const patientName = ctx.patientName ?? "Patient";
      const patientPhone = ctx.patientPhone ?? "";
      const patientProblem = ctx.patientProblem ?? "";

      const [newAppt] = await db
        .insert(appointmentsTable)
        .values({ clinicId, patientName, patientPhone, patientProblem, appointmentDate: date, status: "pending" })
        .returning();

      nextStep = STEPS.DONE;
      isComplete = true;
      appointment = serializeAppt(newAppt as unknown as Record<string, unknown>);
      botMessage = `Your appointment has been booked successfully!\n\nSummary:\n- Name: ${patientName}\n- Phone: ${patientPhone}\n- Concern: ${patientProblem}\n- Date: ${date}\n- Status: Pending\n\nThe clinic will confirm your appointment shortly. Thank you for choosing us!`;
      break;
    }

    default: {
      nextStep = STEPS.DONE;
      botMessage = "Your appointment has already been booked. Is there anything else I can help you with?";
    }
  }

  const response: Record<string, unknown> = { sessionId, step: nextStep!, botMessage: botMessage!, isComplete };
  if (appointment) response.appointment = appointment;

  res.json(SendChatMessageResponse.parse(response));
});

export default router;
