import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
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
  appointmentSource: text("appointment_source").notNull().default("Online"),
  patientAge: integer("patient_age"),
  patientGender: text("patient_gender"),
  visitType: text("visit_type"),
  notes: text("notes"),
  doctorId: integer("doctor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("appointments_clinic_date_idx").on(table.clinicId, table.appointmentDate),
  index("appointments_clinic_status_idx").on(table.clinicId, table.status),
  index("appointments_clinic_patient_phone_idx").on(table.clinicId, table.patientPhone),
]);

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ id: true, createdAt: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
