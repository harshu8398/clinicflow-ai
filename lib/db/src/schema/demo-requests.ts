import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const demoRequestsTable = pgTable("demo_requests", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  clinicName: text("clinic_name").notNull(),
  mobileNumber: text("mobile_number").notNull(),
  email: text("email").notNull(),
  city: text("city").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("New"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DemoRequest = typeof demoRequestsTable.$inferSelect;
export type NewDemoRequest = typeof demoRequestsTable.$inferInsert;
