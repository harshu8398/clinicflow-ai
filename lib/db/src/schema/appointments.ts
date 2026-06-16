import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "cascade" }),
  sessionId: text("session_id"),
  patientName: text("patient_name").notNull(),
  patientPhone: text("patient_mobile").notNull(),
  patientProblem: text("problem").notNull(),
  appointmentDate: text("booking_date").notNull(),
  selectedTimeSlot: text("booking_time"),
  calendarEventId: text("google_event_id"),
  status: text("status").notNull().default("pending_slot_selection"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ id: true, createdAt: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
