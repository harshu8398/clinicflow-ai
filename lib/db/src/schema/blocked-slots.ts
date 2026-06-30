import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";

export const blockedSlotsTable = pgTable("blocked_slots", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "cascade" }),
  doctorId: integer("doctor_id"),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
