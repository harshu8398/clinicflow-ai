import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { usersTable } from "./users";

export const subscriptionSettingsTable = pgTable("subscription_settings", {
  id: serial("id").primaryKey(),
  upiId: text("upi_id").notNull().default("8178141497@jio"),
  upiQrCodeUrl: text("upi_qr_code_url"),
  monthlyPrice: text("monthly_price").notNull().default("999"),
  quarterlyPrice: text("quarterly_price").notNull().default("2699"),
  yearlyPrice: text("yearly_price").notNull().default("8999"),
  supportContact: text("support_contact").notNull().default("+91 8178141497"),
  supportWhatsapp: text("support_whatsapp").notNull().default("+91 8178141497"),
});

export const subscriptionRequestsTable = pgTable("subscription_requests", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id, { onDelete: "cascade" }),
  planType: text("plan_type").notNull(),
  amount: text("amount").notNull(),
  screenshotUrl: text("screenshot_url").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("Pending Verification"), // Pending Verification, Approved, Rejected
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  action: text("action").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  details: text("details"),
});
