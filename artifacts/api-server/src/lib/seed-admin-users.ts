import { db, usersTable, clinicsTable, subscriptionSettingsTable } from "@workspace/db";
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

  // Ensure a user with role system_owner exists
  const [ownerUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, "system_owner"));

  if (!ownerUser) {
    const clinics = await db.select().from(clinicsTable).orderBy(clinicsTable.id);
    if (clinics.length > 0) {
      const clinic = clinics[0];
      const password = "1qaz1qaz!@#$Q";
      const passwordHash = await bcrypt.hash(password, 12);

      await db.insert(usersTable).values({
        clinicId: clinic.id,
        email: "jha753430@gmail.com",
        passwordHash,
        role: "system_owner",
      });

      logger.info(
        { email: "jha753430@gmail.com", clinicId: clinic.id },
        "Created System Owner user jha753430@gmail.com"
      );
    } else {
      logger.warn("Cannot seed owner user: no clinics exist in the database");
    }
  }

  // Ensure default subscription settings exist
  const [settings] = await db.select().from(subscriptionSettingsTable).limit(1);
  if (!settings) {
    await db.insert(subscriptionSettingsTable).values({
      upiId: "8178141497@jio",
      monthlyPrice: "999",
      quarterlyPrice: "2699",
      yearlyPrice: "8999",
      supportContact: "+91 8178141497",
      supportWhatsapp: "+91 8178141497",
    });
    logger.info("Seeded default subscription settings");
  }

  // Initialize subscription details for existing clinics that don't have them
  const allClinics = await db.select().from(clinicsTable);
  for (const c of allClinics) {
    if (!c.expiryDate) {
      const now = new Date();
      const expiry = new Date();
      expiry.setDate(now.getDate() + 14); // 14 days from now

      await db
        .update(clinicsTable)
        .set({
          planType: c.planType || "Demo",
          subscriptionStatus: c.subscriptionStatus || "Trial",
          startDate: c.startDate || now,
          expiryDate: expiry,
        })
        .where(eq(clinicsTable.id, c.id));
      
      logger.info({ clinicId: c.id }, "Initialized subscription fields for existing clinic");
    }
  }
}

