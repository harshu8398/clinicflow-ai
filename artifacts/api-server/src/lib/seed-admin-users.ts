import { db, usersTable, clinicsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

export async function seedAdminUsersIfEmpty(): Promise<void> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable);

  if (count > 0) return;

  const clinics = await db.select().from(clinicsTable).orderBy(clinicsTable.id);
  if (clinics.length === 0) return;

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
