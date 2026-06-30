import { db, usersTable, clinicsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  const email = "harsh.jha2024@vitstudent.ac.in";
  const clinicId = 9; // clove dental clinic
  const password = "admin123";

  // Check if clinic exists
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId));
  if (!clinic) {
    console.error(`Clinic ID ${clinicId} not found in database.`);
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Find user
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (user) {
    // Update user
    await db
      .update(usersTable)
      .set({
        clinicId,
        passwordHash,
      })
      .where(eq(usersTable.id, user.id));
    console.log(`Successfully updated user ${email} to clinic ID ${clinicId} (${clinic.name}) and reset password.`);
  } else {
    // Insert user
    await db.insert(usersTable).values({
      clinicId,
      email,
      passwordHash,
      role: "admin",
    });
    console.log(`User ${email} did not exist. Successfully created user for clinic ID ${clinicId} (${clinic.name}).`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
