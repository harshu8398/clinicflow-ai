import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";

export const blockedDaysTable = pgTable("blocked_days", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "cascade" }),
  doctorId: integer("doctor_id"),
  date: text("date").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
