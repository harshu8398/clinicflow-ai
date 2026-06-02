import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";

export const chatSessionsTable = pgTable("chat_sessions", {
  sessionId: text("session_id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChatSession = typeof chatSessionsTable.$inferSelect;
