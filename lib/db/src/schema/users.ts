import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
