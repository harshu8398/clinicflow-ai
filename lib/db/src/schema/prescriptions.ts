import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { appointmentsTable } from "./appointments";

export const prescriptionsTable = pgTable("prescriptions", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "cascade" }),
  appointmentId: integer("appointment_id").notNull().references(() => appointmentsTable.id, { onDelete: "cascade" }),
  patientName: text("patient_name").notNull(),
  patientPhone: text("patient_phone").notNull(),
  diagnosis: text("diagnosis"),
  chiefComplaint: text("chief_complaint"),
  medicines: text("medicines").notNull(), // JSON string representing array of medicines
  additionalAdvice: text("additional_advice"),
  followUpDate: text("follow_up_date"),
  doctorNotes: text("doctor_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const medicineTemplatesTable = pgTable("medicine_templates", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dosage: text("dosage"),
  frequency: text("frequency"),
  duration: text("duration"),
  instructions: text("instructions"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPrescriptionSchema = createInsertSchema(prescriptionsTable).omit({ id: true, createdAt: true });
export type InsertPrescription = z.infer<typeof insertPrescriptionSchema>;
export type Prescription = typeof prescriptionsTable.$inferSelect;

export const insertMedicineTemplateSchema = createInsertSchema(medicineTemplatesTable).omit({ id: true, createdAt: true });
export type InsertMedicineTemplate = z.infer<typeof insertMedicineTemplateSchema>;
export type MedicineTemplate = typeof medicineTemplatesTable.$inferSelect;
