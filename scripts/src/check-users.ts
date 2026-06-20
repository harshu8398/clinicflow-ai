import { db, usersTable, clinicsTable } from "../../lib/db/src/index.ts";
import { eq } from "drizzle-orm";

async function main() {
  const clinics = await db.select().from(clinicsTable).orderBy(clinicsTable.id);
  console.log("\n=== CLINICS IN DATABASE ===");
  for (const c of clinics) {
    console.log(`ID: ${c.id}, Name: ${c.name}, Email: ${c.email}, Doctor: ${c.doctorName}`);
  }
  console.log("===========================");

  const users = await db.select().from(usersTable).orderBy(usersTable.id);
  console.log("\n=== USERS IN DATABASE ===");
  for (const u of users) {
    const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, u.clinicId));
    console.log(`ID: ${u.id}, Email: ${u.email}, Role: ${u.role}, Clinic ID: ${u.clinicId} (${clinic?.name || "Unknown"})`);
  }
  console.log("=========================\n");
}

main().catch(console.error).finally(() => process.exit(0));
