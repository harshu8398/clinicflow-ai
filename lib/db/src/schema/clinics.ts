import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clinicsTable = pgTable("clinics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  address: text("address").notNull(),
  fee: text("fee").notNull(),
  timings: text("timings").notNull(),
  logoUrl: text("logo_url"),
  doctorName: text("doctor_name"),
  doctorQualification: text("doctor_qualification"),
  doctorSpecialization: text("doctor_specialization"),
  phone: text("phone"),
  calendarId: text("calendar_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  workingDays: text("working_days"),
  openingTime: text("opening_time"),
  closingTime: text("closing_time"),
  slotDuration: integer("slot_duration"),
  googleConnected: boolean("google_connected").default(false),
  googleConnectedEmail: text("google_connected_email"),
  googleCalendarId: text("google_calendar_id"),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  googleTokenExpiresAt: timestamp("google_token_expires_at"),
  googleLastSyncAt: timestamp("google_last_sync_at"),
  planType: text("plan_type").default("Demo").notNull(),
  subscriptionStatus: text("subscription_status").default("Trial").notNull(),
  startDate: timestamp("subscription_start_date", { withTimezone: true }),
  expiryDate: timestamp("subscription_expiry_date", { withTimezone: true }),
  lastPaymentReference: text("last_payment_reference"),
  subscriptionNotes: text("subscription_notes"),
});

export const insertClinicSchema = createInsertSchema(clinicsTable).omit({ id: true, createdAt: true });
export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type Clinic = typeof clinicsTable.$inferSelect;
