import { db, usersTable, clinicsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

export async function seedAdminUsersIfEmpty(): Promise<void> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable);

  if (count === 0) {
    const clinics = await db.select().from(clinicsTable).orderBy(clinicsTable.id);
    if (clinics.length > 0) {
      logger.info("No admin users found — seeding default admin accounts");

      for (const clinic of clinics) {
        const slug = clinic.name.toLowerCase().replace(/\s+/g, "").slice(0, 20);
        const email = `admin@${slug}.clinic`;
        const password = "admin123";
        const passwordHash = await bcrypt.hash(password, 12);

        await db.insert(usersTable).values({
          clinicId: clinic.id,
          email,
          passwordHash,
          role: "admin",
        });

        logger.info({ email, password, clinicId: clinic.id }, "Created admin user");
      }
    }
  }

  // Ensure jha753430@gmail.com exists so the user can test Forgot Password
  const [testUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "jha753430@gmail.com"));

  if (!testUser) {
    const clinics = await db.select().from(clinicsTable).orderBy(clinicsTable.id);
    if (clinics.length > 0) {
      const clinic = clinics[0];
      const password = "admin123";
      const passwordHash = await bcrypt.hash(password, 12);

      await db.insert(usersTable).values({
        clinicId: clinic.id,
        email: "jha753430@gmail.com",
        passwordHash,
        role: "admin",
      });

      logger.info(
        { email: "jha753430@gmail.com", password, clinicId: clinic.id },
        "Created test admin user jha753430@gmail.com for Forgot Password testing"
      );
    } else {
      logger.warn("Cannot seed test user: no clinics exist in the database");
    }
  }
}
