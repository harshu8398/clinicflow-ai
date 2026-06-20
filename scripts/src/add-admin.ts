import { db, usersTable, clinicsTable } from "../../lib/db/src/index.ts";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  const email = "admin@harshjha.clinic";
  const clinicId = 1; // Harsh Jha clinic
  const password = "admin123";

  // Check if clinic exists
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
  if (!clinic) {
    console.error(`Clinic ID ${clinicId} not found in database.`);
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Check if user already exists
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (user) {
    await db
      .update(usersTable)
      .set({
        clinicId,
        passwordHash,
        role: "admin",
      })
      .where(eq(usersTable.id, user.id));
    console.log(`Successfully updated admin user ${email} for Harsh Jha clinic.`);
  } else {
    await db.insert(usersTable).values({
      clinicId,
      email,
      passwordHash,
      role: "admin",
    });
    console.log(`Successfully created admin user ${email} for Harsh Jha clinic with password: ${password}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
