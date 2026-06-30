import { db, appointmentsTable, blockedSlotsTable, blockedDaysTable } from "../../lib/db/src/index.ts";
import { eq } from "drizzle-orm";

async function main() {
  const clinicId = 9;
  const appts = await db.select().from(appointmentsTable).where(eq(appointmentsTable.clinicId, clinicId));
  const slots = await db.select().from(blockedSlotsTable).where(eq(blockedSlotsTable.clinicId, clinicId));
  const days = await db.select().from(blockedDaysTable).where(eq(blockedDaysTable.clinicId, clinicId));

  console.log("\n=== APPOINTMENTS ===");
  appts.forEach(a => console.log(`ID: ${a.id}, Patient: ${a.patientName}, Date: ${a.appointmentDate}, Slot: ${a.selectedTimeSlot}, Status: ${a.status}, Source: ${a.appointmentSource}`));

  console.log("\n=== BLOCKED SLOTS ===");
  slots.forEach(s => console.log(`ID: ${s.id}, Date: ${s.date}, Start: ${s.startTime}, End: ${s.endTime}, Reason: ${s.reason}`));

  console.log("\n=== BLOCKED DAYS ===");
  days.forEach(d => console.log(`ID: ${d.id}, Date: ${d.date}, Reason: ${d.reason}`));
}

main().catch(console.error).finally(() => process.exit(0));
