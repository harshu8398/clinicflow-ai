import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
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
  calendarId: text("calendar_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClinicSchema = createInsertSchema(clinicsTable).omit({ id: true, createdAt: true });
export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type Clinic = typeof clinicsTable.$inferSelect;
